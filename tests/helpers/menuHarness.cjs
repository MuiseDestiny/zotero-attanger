const path = require("node:path");
const esbuild = require("esbuild");

const PREF_PREFIX = "extensions.zotero.zoteroattanger";

let bundledMenuCode;

function getBundledMenuCode() {
  if (!bundledMenuCode) {
    const result = esbuild.buildSync({
      entryPoints: [path.join(process.cwd(), "src/modules/menu.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      write: false,
      logLevel: "silent",
    });
    bundledMenuCode = result.outputFiles[0].text;
  }
  return bundledMenuCode;
}

class FakeClock {
  constructor() {
    this.now = 0;
    this.nextID = 0;
    this.tasks = new Map();
    this.cleared = [];
  }

  setTimeout(callback, delay = 0) {
    const id = this.nextID++;
    this.tasks.set(id, {
      callback,
      at: this.now + Math.max(0, Number(delay) || 0),
    });
    return id;
  }

  clearTimeout(id) {
    this.cleared.push(id);
    this.tasks.delete(id);
  }

  async settle() {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
    await new Promise((resolve) => setImmediate(resolve));
  }

  async runAll(limit = 100) {
    let runs = 0;
    while (this.tasks.size) {
      if (++runs > limit) throw new Error("Fake clock exceeded task limit");
      const [id, task] = [...this.tasks.entries()].sort(
        ([leftID, left], [rightID, right]) =>
          left.at - right.at || leftID - rightID,
      )[0];
      this.tasks.delete(id);
      this.now = task.at;
      await task.callback();
      await this.settle();
    }
    await this.settle();
  }
}

function createHarness(options = {}) {
  const clock = new FakeClock();
  const items = new Map();
  const observers = new Map();
  const menuRegistrations = [];
  const keyboardRegistrations = [];
  const logs = [];
  const delays = [];
  const activeIntervals = new Set();
  let nextIntervalID = 0;
  const files = new Set(options.files || []);
  const directories = new Set(options.directories || ["/source", "/dest"]);
  const calls = {
    copy: [],
    copyFallback: [],
    importFromFile: [],
    linkFromFile: [],
    remove: [],
    unregister: [],
    newItems: [],
  };
  let nextObserverID = 1;
  let nextItemID = 10000;

  const defaultPrefs = {
    attachType: "linking",
    autoMove: false,
    autoRemoveEmptyFolder: false,
    autoRenameOnModify: false,
    autoRenameOnModifyDebounceEnabled: true,
    autoRenameOnModifyDebounceMs: 1000,
    autoRenameOnModifyDelayEnabled: false,
    autoRenameOnModifyDelayMs: 0,
    destDir: "/dest",
    fileTypes: "pdf,doc,docx,txt,rtf,djvu,epub",
    filenameAsPrefixRules: "",
    filenameSkipAutoMoveRenameRules: "",
    filenameSkipRenameRules: "",
    moveWithoutDeleting: false,
    readPDFtitle: "nonCJK",
    sourceDir: "/source",
    subfolderFormat: "",
    syncAttachmentTitle: false,
  };
  const prefs = new Map();
  for (const [key, value] of Object.entries({
    ...defaultPrefs,
    ...(options.prefs || {}),
  })) {
    prefs.set(`${PREF_PREFIX}.${key}`, value);
  }
  prefs.set("autoRenameFiles", options.autoRenameFiles || false);

  const harness = {
    calls,
    clock,
    delays,
    directories,
    files,
    items,
    keyboardRegistrations,
    logs,
    menuRegistrations,
    observers,
    prefs,
    selectedCollection: undefined,
    selectedItems: [],
  };

  function fileObject(filePath) {
    const normalized = path.posix.normalize(filePath);
    return {
      path: normalized,
      leafName: path.posix.basename(normalized),
      parent: fileObjectParent(normalized),
      exists: () => files.has(normalized) || directories.has(normalized),
      isDirectory: () => directories.has(normalized),
      isFile: () => files.has(normalized),
      isHidden: () => path.posix.basename(normalized).startsWith("."),
      copyTo: (parent, leafName) => {
        const destination = path.posix.join(parent.path, leafName);
        calls.copyFallback.push([normalized, destination]);
        if (options.copyFallback) {
          return options.copyFallback(normalized, destination);
        }
        files.add(destination);
      },
      remove: () => {
        calls.remove.push(normalized);
        files.delete(normalized);
        directories.delete(normalized);
      },
      get directoryEntries() {
        return {
          hasMoreElements: () => false,
          getNext: () => undefined,
        };
      },
    };
  }

  function fileObjectParent(filePath) {
    const parentPath = path.posix.dirname(filePath);
    return {
      path: parentPath,
      leafName: path.posix.basename(parentPath),
      exists: () => directories.has(parentPath),
      isDirectory: () => directories.has(parentPath),
      isFile: () => files.has(parentPath),
    };
  }

  class MockCreatedItem {
    constructor(itemType) {
      this.id = nextItemID++;
      this.itemType = itemType;
      this.fields = {};
      this.tags = [];
      this.note = "";
      calls.newItems.push(this);
    }

    fromJSON(json) {
      this.json = { ...json };
      this.parentItemID = json.parentItemID || json.parentItem || undefined;
      this.parentItem = this.parentItemID
        ? items.get(this.parentItemID)
        : undefined;
      this.currentPath = json.path;
      this.fields.title = json.title || path.posix.basename(json.path || "");
    }

    async saveTx() {
      items.set(this.id, this);
      this.saveCount = (this.saveCount || 0) + 1;
      return this.id;
    }

    async eraseTx() {
      items.delete(this.id);
      this.erased = true;
    }

    setTags(tags) {
      this.tags = tags;
    }

    setNote(note) {
      this.note = note;
    }

    isAttachment() {
      return true;
    }

    isLinkedFileAttachment() {
      return true;
    }

    async getFilePathAsync() {
      return this.currentPath;
    }

    getField(name) {
      return this.fields[name] || "";
    }

    getDisplayTitle() {
      return this.fields.title || "";
    }

    getImageSrc() {
      return "attachment-pdflink";
    }

    isTopLevelItem() {
      return !this.parentItemID;
    }
  }

  const ProgressWindow = class {
    static setIconURI() {}

    constructor() {
      this.lines = [];
    }

    createLine(line) {
      this.lines.push({ ...line, _hbox: { style: {} } });
      return this;
    }

    show() {
      return this;
    }

    addDescription() {
      return this;
    }

    close() {}

    startCloseTimer() {}
  };

  global.window = {
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
    confirm: () => false,
    prompt: () => "",
  };
  global.document = {};
  global.PathUtils = {
    filename: (value) => path.posix.basename(value),
    joinRelative: (...parts) => path.posix.join(...parts),
    normalize: (value) => path.posix.normalize(value),
    parent: (value) => path.posix.dirname(value),
    split: (value) => value.split(/[\\/]/),
  };
  global.IOUtils = {
    exists: async (value) => files.has(value) || directories.has(value),
    copy: async (source, destination) => {
      calls.copy.push([source, destination]);
      if (options.ioCopy) {
        await options.ioCopy(source, destination, harness);
      } else {
        files.add(destination);
      }
    },
    remove: async (value) => {
      calls.remove.push(value);
      files.delete(value);
      directories.delete(value);
    },
    read: async () => new Uint8Array(),
  };
  global.Components = {
    interfaces: { nsIFile: class {} },
  };
  global.OS = { File: {} };
  global.addon = {
    data: {
      alive: true,
      folderSep: "/",
      icons: {},
      notifierID: "",
    },
  };
  global.ztoolkit = {
    Keyboard: {
      register: (callback) => keyboardRegistrations.push(callback),
    },
    Menu: {
      register: (type, config) => menuRegistrations.push({ type, config }),
      unregisterAll: async () => {},
    },
    ProgressWindow,
    getGlobal: (name) => {
      if (name === "setInterval") {
        return (callback) => {
          const id = nextIntervalID++;
          activeIntervals.add(id);
          queueMicrotask(() => {
            if (activeIntervals.has(id)) callback();
          });
          return id;
        };
      }
      if (name === "clearInterval") {
        return (id) => activeIntervals.delete(id);
      }
      return global[name];
    },
    log: (...args) => logs.push(args),
  };
  global.ZoteroPane = {
    convertLinkedFilesToStoredFiles: async () => {},
    getCollectionTreeRow: () => ({ isCollection: () => true }),
    getSelectedCollection: () => harness.selectedCollection,
    getSelectedItems: () => harness.selectedItems,
    getSelectedLibraryID: () => 1,
    viewAttachment: async () => {},
  };
  global.Zotero = {
    Attachments: {
      getFileBaseNameFromItem: (item) =>
        options.baseName || item.fileBaseName || "renamed",
      importFromFile: async (input) => {
        calls.importFromFile.push(input);
        return options.importedItem;
      },
      linkFromFile: async (input) => {
        calls.linkFromFile.push(input);
        return options.linkedItem;
      },
    },
    Collections: {
      get: (id) => items.get(id),
    },
    DB: {
      executeTransaction: async (callback) => callback(),
    },
    File: {
      createDirectoryIfMissingAsync: async (value) => directories.add(value),
      getExtension: (value) => path.posix.extname(value).slice(1),
      getValidFileName: (value) => value,
      iterateDirectory: async () => {},
      pathToFile: fileObject,
    },
    Fulltext: {
      transferItemIndex: async () => {},
    },
    Item: MockCreatedItem,
    Items: {
      get: (ids) => {
        if (Array.isArray(ids)) return ids.map((id) => items.get(Number(id)));
        return items.get(Number(ids));
      },
      getAsync: async (id) => items.get(Number(id)),
      moveChildItems: async () => {},
    },
    Notifier: {
      registerObserver: (observer) => {
        const id = `observer-${nextObserverID++}`;
        observers.set(id, observer);
        return id;
      },
      unregisterObserver: (id) => {
        calls.unregister.push(id);
        observers.delete(id);
      },
    },
    PDFWorker: {
      _enqueue: async (callback) => callback(),
      _query: async () => ({}),
    },
    Prefs: {
      clear: (key) => prefs.delete(key),
      get: (key) => prefs.get(key),
      set: (key, value) => {
        prefs.set(key, value);
        return value;
      },
    },
    Promise: {
      defer: () => {
        let resolve;
        const promise = new Promise((res) => {
          resolve = res;
        });
        return { promise, resolve };
      },
      delay: async (milliseconds) => {
        delays.push(milliseconds);
        if (options.delay) await options.delay(milliseconds);
      },
    },
    RecognizeDocument: {
      recognizeItems: async () => {},
    },
    Relations: {
      copyObjectSubjectRelations: async () => {},
    },
    Utilities: {
      Internal: {
        md5: (file) =>
          options.md5 ? options.md5(file.path) : `md5:${file.path}`,
      },
    },
    getMainWindows: () => [],
    getStorageDirectory: () => ({ path: "/storage" }),
    isWin: false,
  };

  const module = { exports: {} };
  new Function("module", "exports", "require", getBundledMenuCode())(
    module,
    module.exports,
    require,
  );
  harness.module = module.exports;

  harness.setPref = (key, value) => prefs.set(`${PREF_PREFIX}.${key}`, value);
  harness.notify = async (event, ids) => {
    for (const observer of [...observers.values()]) {
      await observer.notify(event, "item", ids, {});
    }
  };
  harness.cleanup = () => {
    delete global.window;
    delete global.document;
    delete global.PathUtils;
    delete global.IOUtils;
    delete global.Components;
    delete global.OS;
    delete global.addon;
    delete global.ztoolkit;
    delete global.ZoteroPane;
    delete global.Zotero;
  };
  return harness;
}

function createRegularItem(harness, options = {}) {
  const fields = { title: options.title || "Parent" };
  const item = {
    id: options.id || 1,
    deleted: options.deleted || false,
    fileBaseName: options.fileBaseName || "renamed",
    libraryID: options.libraryID || 1,
    attachmentIDs: options.attachmentIDs || [],
    collectionIDs: options.collectionIDs || [],
    getAttachments() {
      return [...this.attachmentIDs];
    },
    getCollections() {
      return [...this.collectionIDs];
    },
    getDisplayTitle() {
      return fields.title;
    },
    getField(name) {
      return fields[name] || "";
    },
    getImageSrc() {
      return "item-icon";
    },
    isAttachment() {
      return false;
    },
    isRegularItem() {
      return true;
    },
    isTopLevelItem() {
      return true;
    },
  };
  harness.items.set(item.id, item);
  return item;
}

function createAttachment(harness, options = {}) {
  let currentPath = options.path || `/source/${options.filename || "old.pdf"}`;
  let title = options.title || path.posix.basename(currentPath);
  const calls = {
    erase: 0,
    pathReads: 0,
    rename: [],
    save: 0,
    setField: [],
  };
  const parent = options.parent;
  const attachment = {
    id: options.id || 2,
    deleted: options.deleted || false,
    libraryID: options.libraryID || 1,
    parentItemID: parent?.id,
    parentItem: parent,
    topLevelItem: parent || undefined,
    attachmentContentType: options.contentType || "application/pdf",
    get attachmentFilename() {
      return path.posix.basename(currentPath);
    },
    calls,
    async eraseTx() {
      calls.erase++;
      if (options.onErase) await options.onErase(this);
      harness.items.delete(this.id);
    },
    async fileExists() {
      if (options.fileExists) return options.fileExists(this);
      return options.exists !== false;
    },
    async getFilePathAsync() {
      calls.pathReads++;
      return currentPath;
    },
    getDisplayTitle() {
      return title;
    },
    getField(name) {
      return name === "title" ? title : "";
    },
    getImageSrc() {
      return "attachment-pdflink";
    },
    getNote() {
      return options.note || "";
    },
    getTags() {
      return options.tags || [];
    },
    isAttachment() {
      return true;
    },
    isImportedAttachment() {
      return options.mode === "imported";
    },
    isLinkedFileAttachment() {
      return options.mode === "linked";
    },
    isRegularItem() {
      return false;
    },
    isTopLevelItem() {
      return !parent;
    },
    async renameAttachmentFile(newName) {
      calls.rename.push(newName);
      if (options.renameResult === false) return false;
      currentPath = path.posix.join(path.posix.dirname(currentPath), newName);
      return true;
    },
    async saveTx() {
      calls.save++;
      if (options.onSave) await options.onSave(this);
      return this.id;
    },
    setField(name, value) {
      calls.setField.push([name, value]);
      if (name === "title") title = value;
    },
    toJSON() {
      return {
        linkMode: options.mode === "linked" ? "linked_file" : "imported_file",
        parentItemID: parent?.id,
        title,
      };
    },
  };
  harness.items.set(attachment.id, attachment);
  if (parent && !parent.attachmentIDs.includes(attachment.id)) {
    parent.attachmentIDs.push(attachment.id);
  }
  return attachment;
}

module.exports = {
  PREF_PREFIX,
  createAttachment,
  createHarness,
  createRegularItem,
};
