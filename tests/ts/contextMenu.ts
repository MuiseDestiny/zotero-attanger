import assert from "node:assert/strict";
import test from "node:test";

import { config } from "../../package.json";
import {
  getOfficialMenuManager,
  prepareOfficialMenuElements,
  registerContextMenu,
  toOfficialMenuData,
  type OfficialMenuData,
  type OfficialMenuManager,
} from "../../src/utils/contextMenu";

class FakeElement {
  nodeType = 1;
  id = "";
  children: FakeElement[] = [];
  style = {
    values: new Map<string, string>(),
    setProperty(name: string, value: string) {
      this.values.set(name, value);
    },
  };
  private attributes = new Map<string, string>();
  private classes: Set<string>;
  classList = {
    add: (...names: string[]) => names.forEach((n) => this.classes.add(n)),
    contains: (name: string) => this.classes.has(name),
  };
  constructor(
    public localName: string,
    classes: string[] = [],
  ) {
    this.classes = new Set(classes);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  querySelectorAll(selector: string) {
    const cls = selector.replace(/^\./, "");
    return this.children.filter((child) => child.classList.contains(cls));
  }
}

const asElement = (element: FakeElement) => element as unknown as Element;

function fakeManager() {
  const registered = new Map<
    string,
    { target: string; menus: OfficialMenuData[]; pluginID: string }
  >();
  let next = 0;
  const manager: OfficialMenuManager = {
    registerMenu(options) {
      const key = `${options.menuID}-${++next}`;
      registered.set(key, options);
      return key;
    },
    unregisterMenu: (key) => registered.delete(key),
  };
  return { manager, registered };
}

function context(element: FakeElement) {
  return {
    menuElem: asElement(element),
    setVisible: (visible: boolean) =>
      visible
        ? element.removeAttribute("hidden")
        : element.setAttribute("hidden", "true"),
    setEnabled: (enabled: boolean) =>
      enabled
        ? element.removeAttribute("disabled")
        : element.setAttribute("disabled", "true"),
  };
}

const event = {} as Event;

test("only Zotero 11+ with MenuManager uses the official API", () => {
  const { manager } = fakeManager();
  assert.equal(
    getOfficialMenuManager({ version: "10.0.5", MenuManager: manager }),
    undefined,
  );
  assert.equal(getOfficialMenuManager({ version: "11.0" }), undefined);
  assert.equal(
    getOfficialMenuManager({ version: "11.0.1", MenuManager: manager }),
    manager,
  );
});

test("Zotero 10 keeps the toolkit registration path", () => {
  const calls: string[] = [];
  const handle = registerContextMenu(
    "item",
    { tag: "menuitem", id: "legacy", label: "Legacy" },
    {
      host: { version: "10.0.0" },
      toolkitMenu: {
        register: (target, options) => {
          calls.push(`register:${String(target)}:${options.id}`);
          return undefined;
        },
        unregister: (id) => calls.push(`unregister:${id}`),
      },
    },
  );
  handle.dispose();
  handle.dispose();
  assert.deepEqual(calls, [
    "unregister:legacy",
    "register:item:legacy",
    "unregister:legacy",
  ]);
});

test("Zotero 11 registers with MenuManager and disposes once", () => {
  const { manager, registered } = fakeManager();
  const handle = registerContextMenu(
    "collection",
    {
      tag: "menu",
      id: "plugin-menu",
      label: "Plugin",
      icon: "chrome://plugin/icon.png",
      children: [{ tag: "menuitem", label: "A" }, { tag: "menuseparator" }],
    },
    { host: { version: "11.0.0", MenuManager: manager } },
  );
  const [[, entry]] = registered;
  assert.equal(entry.target, "main/library/collection");
  assert.equal(entry.pluginID, config.addonID);
  assert.equal(entry.menus[0].menuType, "submenu");
  assert.equal(entry.menus[0].icon, "chrome://plugin/icon.png");
  assert.deepEqual(
    entry.menus[0].menus!.map((menu) => menu.menuType),
    ["menuitem", "separator"],
  );
  handle.dispose();
  handle.dispose();
  assert.equal(registered.size, 0);
});

test("menu data applies label, visibility, commands and the macOS icon fix", () => {
  const menu = new FakeElement("menu");
  const iconBox = new FakeElement("image", ["menu-icon"]);
  menu.children.push(iconBox);
  let visible = false;
  let commands = 0;
  const data = toOfficialMenuData(
    {
      tag: "menu",
      id: "plugin-menu",
      label: "Plugin",
      icon: "chrome://plugin/icon.png",
      getVisibility: () => visible,
      children: [
        { tag: "menuitem", label: "Run", commandListener: () => commands++ },
      ],
    },
    { version: "11.0.0", isMac: true },
  );
  data.onShowing!(event, context(menu));
  assert.equal(menu.id, "plugin-menu");
  assert.equal(menu.getAttribute("label"), "Plugin");
  assert.equal(menu.getAttribute("hidden"), "true");
  assert.ok(menu.classList.contains("menu-iconic"));
  assert.match(
    menu.style.values.get("list-style-image")!,
    /chrome:\/\/plugin\/icon\.png/,
  );
  assert.equal(iconBox.style.values.get("display"), "revert");
  visible = true;
  data.onShowing!(event, context(menu));
  assert.equal(menu.hasAttribute("hidden"), false);
  data.menus![0].onCommand!(event, context(menu));
  assert.equal(commands, 1);
});

test("official elements can be identified before their showing hook", () => {
  const { manager, registered } = fakeManager();
  const handle = registerContextMenu(
    "item",
    { tag: "menuitem", id: "manage", label: "Manage" },
    { host: { version: "11.0.0", MenuManager: manager } },
  );
  const [key] = registered.keys();
  const popup = new FakeElement("menupopup");
  const item = new FakeElement("menuitem", ["zotero-custom-menu-item", key]);
  popup.children.push(item);
  prepareOfficialMenuElements(asElement(popup));
  assert.equal(item.id, "manage");
  assert.equal(item.getAttribute("label"), "Manage");
  handle.dispose();
});
