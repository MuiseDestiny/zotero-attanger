const assert = require("node:assert/strict");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const esbuild = require("esbuild");

const XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

function loadModule() {
  const output = esbuild.buildSync({
    entryPoints: [path.join(process.cwd(), "src/utils/toolkitMenu.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    logLevel: "silent",
  }).outputFiles[0].text;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(
    module,
    module.exports,
    require,
  );
  return module.exports;
}

class FakeElement {
  constructor(doc, localName, namespaceURI = XUL) {
    this.ownerDocument = doc;
    this.localName = localName;
    this.namespaceURI = namespaceURI;
    this.nodeType = 1;
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      contains: (name) => classes.has(name),
    };
  }
  get id() {
    return this.getAttribute("id") || "";
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      list.filter((entry) => entry !== listener),
    );
  }
  emit(type) {
    for (const listener of this.listeners.get(type) || []) listener({ type });
  }
  *walk() {
    yield this;
    for (const child of this.children) yield* child.walk();
  }
}

function createDocument() {
  const doc = {};
  doc.documentElement = new FakeElement(doc, "window");
  doc.createElementNS = (namespace, name) =>
    new FakeElement(doc, name, namespace);
  doc.getElementById = (id) => {
    for (const node of doc.documentElement.walk())
      if (node.id === id) return node;
    return null;
  };
  return doc;
}

// Mirrors zotero-plugin-toolkit 5.0.1 MenuManager.register: it writes
// hidden/disabled/checked as "false" strings and re-applies them on showing.
function createToolkit(doc, popup) {
  const ui = {
    createElement(_doc, tag, props) {
      const node = new FakeElement(doc, tag);
      if (props.id) node.setAttribute("id", props.id);
      for (const [key, value] of Object.entries(props.attributes || {}))
        if (value !== undefined) node.setAttribute(key, String(value));
      return node;
    },
  };
  const manager = {
    ui,
    getGlobal: () => doc,
    register(_target, options) {
      const build = (option) => {
        const node = this.ui.createElement(doc, option.tag, {
          id: option.id,
          attributes: {
            label: option.label || "",
            hidden: Boolean(option.hidden),
            disabled: Boolean(option.disabled),
            ...(option.tag === "menuitem"
              ? { type: option.type || "", checked: option.checked || false }
              : {}),
          },
        });
        if (option.onShowing)
          popup.addEventListener("popupshowing", () => option.onShowing(node));
        if (option.tag === "menu") {
          const subPopup = this.ui.createElement(doc, "menupopup", {});
          for (const child of option.children || [])
            subPopup.appendChild(build(child));
          node.appendChild(subPopup);
        }
        return node;
      };
      popup.appendChild(build(options));
    },
    unregisterAll() {
      popup.children.length = 0;
    },
  };
  return { Menu: manager };
}

function setup(zotero) {
  global.Zotero = zotero;
  const doc = createDocument();
  const popup = new FakeElement(doc, "menupopup");
  popup.setAttribute("id", "zotero-itemmenu");
  doc.documentElement.appendChild(popup);
  const toolkit = createToolkit(doc, popup);
  const { installToolkitMenuCompatibility } = loadModule();
  installToolkitMenuCompatibility(toolkit);
  return { doc, popup, toolkit };
}

afterEach(() => {
  delete global.Zotero;
});

test("registered menus drop false-valued attributes so Zotero 11 keeps them visible and enabled", () => {
  const { doc, popup, toolkit } = setup({ isMac: false, version: "11.0" });
  toolkit.Menu.register("item", {
    tag: "menu",
    id: "attanger-menu",
    label: "Attanger",
    children: [
      { tag: "menuitem", label: "Attach" },
      { tag: "menuitem", label: "Disabled", disabled: true },
      { tag: "menuseparator" },
    ],
  });
  const menu = doc.getElementById("attanger-menu");
  const items = [...menu.walk()].filter((node) =>
    ["menu", "menuitem", "menuseparator"].includes(node.localName),
  );
  assert.equal(items.length, 4);
  for (const node of items) {
    assert.ok(node.id, "every node gets an id");
    for (const attribute of ["hidden", "checked"])
      assert.equal(node.hasAttribute(attribute), false);
    assert.notEqual(node.getAttribute("type"), "");
  }
  assert.equal(items[1].hasAttribute("disabled"), false);
  assert.equal(items[2].getAttribute("disabled"), "true");
  assert.equal(popup.children.length, 1);
});

test("false values written again on popupshowing are removed", () => {
  const { doc, popup, toolkit } = setup({ isMac: false, version: "11.0" });
  toolkit.Menu.register("item", {
    tag: "menuitem",
    id: "late",
    onShowing: (node) => node.setAttribute("hidden", "false"),
  });
  popup.emit("popupshowing");
  assert.equal(doc.getElementById("late").hasAttribute("hidden"), false);
});

test("Zotero 11 on macOS scopes menu icons by id; Zotero 7-10 add no stylesheet", () => {
  for (const [zotero, expected] of [
    [{ isMac: true, version: "11.0.0" }, true],
    [{ isMac: true, version: "7.0.15" }, false],
    [{ isMac: false, version: "11.0.0" }, false],
  ]) {
    const { doc, toolkit } = setup(zotero);
    toolkit.Menu.register("item", {
      tag: "menu",
      id: "iconic",
      icon: "chrome://zoteroattanger/content/icons/favicon.png",
      children: [{ tag: "menuitem", label: "Plain" }],
    });
    const styles = doc.documentElement.children.filter(
      (node) => node.localName === "style",
    );
    assert.equal(styles.length, expected ? 1 : 0, zotero.version);
    if (expected) {
      assert.match(styles[0].textContent, /#iconic\{list-style-image:url\(/);
      assert.match(styles[0].textContent, /--menuitem-icon/);
      assert.ok(doc.getElementById("iconic").classList.contains("menu-iconic"));
      toolkit.Menu.unregisterAll();
      assert.equal(
        doc.documentElement.children.some((node) => node.localName === "style"),
        false,
      );
    }
  }
});
