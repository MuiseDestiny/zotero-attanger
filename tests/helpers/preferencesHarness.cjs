const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
const { createHarness, PREF_PREFIX } = require("./menuHarness.cjs");

let bundledPreferences;

function loadPreferences() {
  if (!bundledPreferences) {
    bundledPreferences = esbuild.buildSync({
      entryPoints: [
        path.join(process.cwd(), "src/modules/preferenceScript.ts"),
      ],
      bundle: true,
      platform: "node",
      format: "cjs",
      write: false,
      logLevel: "silent",
    }).outputFiles[0].text;
  }
  const module = { exports: {} };
  new Function("module", "exports", "require", bundledPreferences)(
    module,
    module.exports,
    require,
  );
  return module.exports;
}

class MockEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, callback, options = {}) {
    const listeners = this.listeners.get(type) || new Map();
    if (!listeners.has(callback)) listeners.set(callback, options);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }

  async emit(type, properties = {}) {
    const event = {
      type,
      target: this,
      preventDefault() {},
      stopPropagation() {},
      ...properties,
    };
    const pending = [];
    for (const [callback, options] of [
      ...(this.listeners.get(type)?.entries() || []),
    ]) {
      if (options?.once) this.removeEventListener(type, callback);
      pending.push(callback(event));
    }
    await Promise.all(pending);
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size || 0;
  }
}

class MockElement extends MockEventTarget {
  constructor(tagName, attributes, document) {
    super();
    this.tagName = tagName;
    this.attributes = new Map(Object.entries(attributes));
    this.ownerDocument = document;
    this.children = [];
    this.parentElement = null;
    this.style = {};
    this.textContent = "";
    this.value = attributes.value || "";
    this.hidden = attributes.hidden === "true";
    this.checked = false;
    this.disabled = false;
    this.open = Object.prototype.hasOwnProperty.call(attributes, "open");
  }

  get id() {
    return this.getAttribute("id") || "";
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  matches(selector) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    const attribute = selector.match(
      /^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/,
    );
    if (attribute) {
      return attribute[2] === undefined
        ? this.attributes.has(attribute[1])
        : this.getAttribute(attribute[1]) === attribute[2];
    }
    const [tagName, ...classes] = selector.split(".");
    const ownClasses = (this.getAttribute("class") || "").split(/\s+/);
    return (
      (!tagName || this.tagName === tagName) &&
      classes.every((name) => ownClasses.includes(name))
    );
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map((part) => part.trim());
    const matches = [];
    for (const child of this.children) {
      if (selectors.some((part) => child.matches(part))) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  closest(selector) {
    for (let element = this; element; element = element.parentElement) {
      if (element.matches(selector)) return element;
    }
    return null;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
}

// Read the actual settings controls; styling and localization are not DOM stubs.
function createDocument() {
  const document = {
    activeElement: null,
    createXULElement(tagName) {
      return new MockElement(tagName, {}, document);
    },
    createElementNS(_namespace, tagName) {
      return new MockElement(tagName, {}, document);
    },
    querySelector(selector) {
      return this.root.querySelector(selector);
    },
    querySelectorAll(selector) {
      return this.root.querySelectorAll(selector);
    },
  };
  document.root = new MockElement("document", {}, document);
  const stack = [document.root];
  const source = fs
    .readFileSync("addon/chrome/content/preferences.xhtml", "utf8")
    .replace(/<html:style>[\s\S]*?<\/html:style>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  for (const token of source.matchAll(/<([^>]+)>/g)) {
    if (token[1].startsWith("/")) {
      stack.pop();
      continue;
    }
    if (token[1].startsWith("!")) continue;
    const tagName = token[1].match(/^[^\s/]+/)[0].replace(/^.*:/, "");
    const attributes = {};
    for (const match of token[1].matchAll(/([\w:-]+)="([^"]*)"/g)) {
      attributes[match[1]] = match[2].replaceAll(
        "__addonRef__",
        "zoteroattanger",
      );
    }
    const element = new MockElement(tagName, attributes, document);
    element.parentElement = stack.at(-1);
    element.parentElement.children.push(element);
    if (!token[1].endsWith("/")) stack.push(element);
  }
  const search = new MockElement("input", { id: "prefs-search" }, document);
  search.parentElement = document.root;
  document.root.children.push(search);
  const nativeSection = new MockElement(
    "details",
    { id: "native-pref-section" },
    document,
  );
  nativeSection.parentElement = document.root;
  document.root.children.push(nativeSection);
  return document;
}

function deferred() {
  let resolve;
  const promise = new Promise((callback) => {
    resolve = callback;
  });
  return { promise, resolve };
}

function createPreferencesHarness(options = {}) {
  const previousChromeUtils = global.ChromeUtils;
  const previousServices = global.Services;
  const harness = createHarness({
    ...options,
    directories: ["/source", "/dest", ...(options.directories || [])],
    prefs: {
      workMode: "stored",
      deleteSourceAfterImport: true,
      ...options.prefs,
    },
  });
  const baseCleanup = harness.cleanup;
  harness.prefObservers = new Map();
  harness.prefWrites = [];
  harness.removedPrefObservers = [];
  harness.pickerCalls = [];
  harness.pickerResults = [];
  harness.directoryCreationCalls = [];
  harness.existsCalls = [];
  harness.menuRefreshes = 0;
  harness.renameDialogCalls = [];
  harness.renamePaneCalls = [];
  harness.nativeWindowCalls = [];
  harness.joinRelativeCalls = [];
  harness.windows = [];
  const originalJoinRelative = global.PathUtils.joinRelative;
  global.PathUtils.joinRelative = (base, ...relativeParts) => {
    harness.joinRelativeCalls.push([base, ...relativeParts]);
    if (!path.posix.isAbsolute(base)) {
      throw new Error("PathUtils.joinRelative requires an absolute base path");
    }
    return originalJoinRelative(base, ...relativeParts);
  };

  function prefStorageKey(key, globalPref) {
    return globalPref &&
      key.startsWith("extensions.zotero.") &&
      !key.startsWith(`${PREF_PREFIX}.`)
      ? key.slice("extensions.zotero.".length)
      : key;
  }

  function observerKey(key, globalPref) {
    return globalPref ? key : `extensions.zotero.${key}`;
  }

  global.Zotero.Prefs = {
    get(key, globalPref = false) {
      return harness.prefs.get(prefStorageKey(key, globalPref));
    },
    set(key, value, globalPref = false) {
      const storageKey = prefStorageKey(key, globalPref);
      const changed = harness.prefs.get(storageKey) !== value;
      harness.prefs.set(storageKey, value);
      harness.prefWrites.push({ key: storageKey, value });
      if (changed) {
        for (const observer of harness.prefObservers.values()) {
          if (observer.key === observerKey(key, globalPref)) {
            observer.callback();
          }
        }
      }
      return value;
    },
    registerObserver(key, callback, globalPref = false) {
      const id = Symbol(key);
      harness.prefObservers.set(id, {
        key: observerKey(key, globalPref),
        callback,
      });
      return id;
    },
    unregisterObserver(id) {
      harness.removedPrefObservers.push(id);
      harness.prefObservers.delete(id);
    },
  };
  harness.setPref = (key, value) =>
    global.Zotero.Prefs.set(`${PREF_PREFIX}.${key}`, value, true);
  harness.getPref = (key) => harness.prefs.get(`${PREF_PREFIX}.${key}`);
  const originalPathToFile = global.Zotero.File.pathToFile;
  global.Zotero.File.pathToFile = (filePath) => {
    const file = originalPathToFile(filePath);
    file.isWritable = () =>
      !(options.readOnlyDirectories || []).includes(file.path);
    return file;
  };
  const originalCreateDirectory =
    global.Zotero.File.createDirectoryIfMissingAsync;
  global.Zotero.File.createDirectoryIfMissingAsync = (filePath) => {
    harness.directoryCreationCalls.push(filePath);
    return originalCreateDirectory(filePath);
  };
  const originalExists = global.IOUtils.exists;
  global.IOUtils.exists = (filePath) => {
    harness.existsCalls.push(filePath);
    return options.exists
      ? options.exists(filePath, () => originalExists(filePath))
      : originalExists(filePath);
  };
  global.Zotero.Item.prototype.setCreators = function (creators) {
    this.creators = creators;
  };
  global.Zotero.Attachments.getFileBaseNameFromItem = (
    item,
    formatting = {},
  ) => {
    if (options.formatFilename) return options.formatFilename(item, formatting);
    const year = item.getField("date").slice(0, 4);
    const title = item.getField("title");
    const author = item.creators?.[0]?.lastName || "";
    return formatting.formatString
      ? formatting.formatString
          .replaceAll("{{year}}", year)
          .replaceAll("{{title}}", title)
          .replaceAll("{{firstCreator}}", author)
      : `${author} - ${year} - ${title}`;
  };
  global.addon.data.menu = {
    refreshItemMenu() {
      harness.menuRefreshes++;
    },
  };
  global.Services = {
    ww: {
      openWindow(owner, url, name, features, arguments_) {
        harness.nativeWindowCalls.push({
          owner,
          url,
          name,
          features,
          arguments_,
        });
      },
    },
  };

  harness.createWindow = () => {
    const window = new MockEventTarget();
    window.setTimeout = harness.clock.setTimeout.bind(harness.clock);
    window.clearTimeout = harness.clock.clearTimeout.bind(harness.clock);
    window.document = createDocument();
    window.document.defaultView = window;
    window.FilePicker = class {
      constructor() {
        this.returnOK = 0;
        this.returnCancel = 1;
        this.modeGetFolder = 2;
        this.filterAll = 1;
        this.displayDirectory = "";
        harness.pickerCalls.push(this);
      }

      init(owner, title, mode) {
        this.owner = owner;
        this.title = title;
        this.mode = mode;
      }

      appendFilters(filter) {
        this.filter = filter;
      }

      async show() {
        this.shown = true;
        const result = await (harness.pickerResults.shift() || {
          cancelled: true,
        });
        this.file = result.path;
        return result.cancelled ? this.returnCancel : this.returnOK;
      }
    };
    window.Zotero_Preferences = {
      panes: new Map(),
      navigateToPane(pane, options) {
        harness.renamePaneCalls.push({ window, pane, options });
      },
      General: {
        openFileRenamingDialog() {
          harness.renameDialogCalls.push(window);
        },
      },
    };
    harness.windows.push(window);
    return window;
  };
  harness.window = harness.createWindow();
  harness.addNativeControl = (
    tagName,
    attributes,
    parent,
    window = harness.window,
  ) => {
    const document = window.document;
    const control = new MockElement(tagName, attributes, document);
    control.parentElement = parent || document.root;
    control.parentElement.children.unshift(control);
    return control;
  };
  harness.preferences = loadPreferences();
  harness.node = (id, window = harness.window) => {
    const node = window.document.querySelector(`#${id}`);
    if (!node) throw new Error(`Missing preferences node: ${id}`);
    return node;
  };
  harness.settle = () => harness.clock.settle();
  harness.register = (window = harness.window) =>
    harness.preferences.registerPrefsScripts(window);
  harness.chooseMode = async (mode, window = harness.window) => {
    const radioGroup = harness.node("work-mode", window);
    radioGroup.value = mode;
    await radioGroup.emit("command");
    await harness.settle();
  };
  harness.state = (window = harness.window) => {
    const title = harness.node("work-mode-status-title", window);
    return {
      ready: harness
        .node("work-mode-status", window)
        .getAttribute("data-ready"),
      title: title.getAttribute("data-l10n-id"),
      detail: harness
        .node("work-mode-status-detail", window)
        .getAttribute("data-l10n-id"),
    };
  };
  harness.cleanup = () => {
    harness.preferences.unregisterPrefsScripts();
    baseCleanup();
    if (previousChromeUtils === undefined) delete global.ChromeUtils;
    else global.ChromeUtils = previousChromeUtils;
    if (previousServices === undefined) delete global.Services;
    else global.Services = previousServices;
  };
  return harness;
}

module.exports = { createPreferencesHarness, deferred, PREF_PREFIX };
