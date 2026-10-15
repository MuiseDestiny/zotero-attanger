import type {
  MenuitemOptions,
  UITool,
  ZoteroToolkit,
} from "zotero-plugin-toolkit";
import { config } from "../../package.json";

const XUL_NAMESPACE =
  "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const MENU_TAGS = new Set(["menu", "menuitem", "menuseparator"]);
const normalizedCreators = new WeakSet<object>();
const installedManagers = new WeakSet<object>();

type MenuManager = ZoteroToolkit["Menu"];

/**
 * Newer Gecko menus test attribute presence, so the toolkit's
 * hidden="false" / disabled="false" / checked="false" hide, disable, or check
 * the item. Only XUL menu nodes are touched.
 */
export function normalizeMenuAttributes(node: unknown): void {
  const element = node as Element | null;
  if (
    !element ||
    typeof element !== "object" ||
    element.nodeType !== 1 ||
    element.namespaceURI !== XUL_NAMESPACE ||
    !MENU_TAGS.has(element.localName)
  )
    return;
  for (const attribute of ["disabled", "checked", "hidden"]) {
    if (element.getAttribute(attribute) === "false")
      element.removeAttribute(attribute);
  }
  if (element.getAttribute("type") === "") element.removeAttribute("type");
}

function normalizeMenuCreator(ui: UITool): void {
  if (normalizedCreators.has(ui)) return;
  type CreateElement = (
    ...args: Parameters<UITool["createElement"]>
  ) => ReturnType<UITool["createElement"]>;
  const original = ui.createElement as CreateElement;
  ui.createElement = function (
    this: UITool,
    ...args: Parameters<CreateElement>
  ) {
    const node = original.apply(this, args);
    normalizeMenuAttributes(node);
    return node;
  } as UITool["createElement"];
  normalizedCreators.add(ui);
}

/**
 * Zotero 11 on macOS hides .menu-iconic/.menuitem-iconic icons in the item and
 * collection menus with `list-style-image: none !important`. Zotero's own
 * MenuManager scopes the icon to the element; mirror that by id. Zotero 7-10
 * keep the toolkit's original inline list-style-image.
 */
export function needsMacMenuIconFix(
  zotero = (globalThis as { Zotero?: typeof Zotero }).Zotero,
) {
  if (!zotero?.isMac) return false;
  const major = parseInt(String(zotero.version).split(".")[0], 10);
  return Number.isFinite(major) && major >= 11;
}

function applyMacMenuIconFix(
  doc: Document,
  entries: Array<{ element: Element; options: MenuitemOptions }>,
) {
  const rules: string[] = [];
  for (const { element, options } of entries) {
    if (!options.icon || !element.id) continue;
    // The toolkit skips these classes on macOS; Zotero's markup uses them.
    element.classList.add(
      options.tag === "menu" ? "menu-iconic" : "menuitem-iconic",
    );
    const url = `url(${JSON.stringify(options.icon)})`;
    rules.push(
      `#${element.id}{list-style-image:${url} !important;--menuitem-icon:${url}}`,
      `#${element.id}>.menu-icon{display:revert !important}`,
    );
  }
  if (!rules.length) return undefined;
  const style = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "style",
  ) as HTMLStyleElement;
  style.textContent = rules.join("\n");
  doc.documentElement.appendChild(style);
  return style;
}

/** Adapt this add-on's toolkit menus for Zotero 11 without changing 7-10. */
export function installToolkitMenuCompatibility(
  toolkit: Pick<ZoteroToolkit, "Menu">,
): void {
  const manager = toolkit.Menu;
  if (installedManagers.has(manager)) return;
  // register() builds nodes with the manager's private UITool.
  const menuUI = (manager as unknown as { ui?: UITool }).ui;
  if (menuUI && typeof menuUI.createElement === "function")
    normalizeMenuCreator(menuUI);

  const originalRegister = manager.register;
  const originalUnregisterAll = manager.unregisterAll;
  const cleanups = new Set<() => void>();
  let nextID = 0;

  manager.register = function (target, options, position, anchor) {
    const descriptors = new Map<string, MenuitemOptions>();
    // Every node needs an id so dynamic state and icons can be scoped to it.
    const prepare = (descriptor: MenuitemOptions): MenuitemOptions => {
      const id = descriptor.id || `${config.addonRef}-menu-${++nextID}`;
      descriptors.set(id, descriptor);
      if (descriptor.tag !== "menu") return { ...descriptor, id };
      return {
        ...descriptor,
        id,
        children: (
          descriptor.children ??
          descriptor.subElementOptions ??
          []
        ).map(prepare),
      };
    };
    const prepared = prepare(options);
    const result = originalRegister.call(
      this,
      target,
      prepared,
      position,
      anchor,
    );
    if (result === false) return result;
    const doc: Document =
      typeof target === "string"
        ? this.getGlobal("document")
        : target.ownerDocument;
    const root = doc.getElementById(prepared.id!);
    const popup = root?.parentElement;
    if (!root || !popup) return result;
    const entries: Array<{ element: Element; options: MenuitemOptions }> = [];
    for (const [id, descriptor] of descriptors) {
      const element = doc.getElementById(id);
      if (element) entries.push({ element, options: descriptor });
    }
    const style = needsMacMenuIconFix()
      ? applyMacMenuIconFix(doc, entries)
      : undefined;
    // onShowing callbacks may write "false" values again; this listener is
    // added after the toolkit's ones on the same popup, so it runs last.
    const normalize = () => {
      for (const { element } of entries) normalizeMenuAttributes(element);
    };
    popup.addEventListener("popupshowing", normalize);
    cleanups.add(() => {
      popup.removeEventListener("popupshowing", normalize);
      style?.remove();
    });
    return result;
  };
  manager.unregisterAll = function () {
    for (const cleanup of cleanups) cleanup();
    cleanups.clear();
    return originalUnregisterAll.call(this);
  };
  installedManagers.add(manager);
}
