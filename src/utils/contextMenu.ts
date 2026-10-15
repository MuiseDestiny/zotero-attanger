import type { MenuitemOptions, ZoteroToolkit } from "zotero-plugin-toolkit";

import { config } from "../../package.json";

/**
 * Context-menu registration that follows Zotero's own plugin API when present.
 *
 * Zotero 11 ships `Zotero.MenuManager` for item/collection context menus; it
 * owns element creation, grouping into "More" when the menu overflows, and
 * cleanup on plugin shutdown. Zotero 10 has no such API, so the toolkit path is
 * kept unchanged there.
 */
export type ContextMenuTarget = "item" | "collection";

const OFFICIAL_TARGETS: Record<ContextMenuTarget, string> = {
  item: "main/library/item",
  collection: "main/library/collection",
};
const CUSTOM_MENU_CLASS = "zotero-custom-menu-item";

interface OfficialMenuContext {
  readonly menuElem?: Element | null;
  setVisible(visible: boolean): void;
  setEnabled(enabled: boolean): void;
}

type MenuHook = (event: Event, context: OfficialMenuContext) => void;

export interface OfficialMenuData {
  menuType: "menuitem" | "separator" | "submenu";
  icon?: string;
  onShowing?: MenuHook;
  onCommand?: MenuHook;
  menus?: OfficialMenuData[];
}

export interface OfficialMenuManager {
  registerMenu(options: {
    menuID: string;
    pluginID: string;
    target: string;
    menus: OfficialMenuData[];
  }): string | false;
  unregisterMenu(key: string): boolean;
}

interface ZoteroHost {
  version?: unknown;
  isMac?: unknown;
  MenuManager?: Partial<OfficialMenuManager>;
}

function defaultHost(): ZoteroHost | undefined {
  return (globalThis as { Zotero?: ZoteroHost }).Zotero;
}

function majorVersion(host: ZoteroHost | undefined) {
  const major = parseInt(String(host?.version ?? "").split(".")[0], 10);
  return Number.isFinite(major) ? major : 0;
}

/** Zotero 11+ with a usable MenuManager; Zotero 10 returns undefined. */
export function getOfficialMenuManager(
  host: ZoteroHost | undefined = defaultHost(),
): OfficialMenuManager | undefined {
  const manager = host?.MenuManager;
  if (
    majorVersion(host) < 11 ||
    typeof manager?.registerMenu !== "function" ||
    typeof manager.unregisterMenu !== "function"
  )
    return undefined;
  return manager as OfficialMenuManager;
}

export function usesOfficialContextMenus(
  host: ZoteroHost | undefined = defaultHost(),
) {
  return Boolean(getOfficialMenuManager(host));
}

/**
 * Zotero 11 on macOS hides every icon in the item/collection context menus with
 * `list-style-image: none !important`, including MenuManager icons. Inline
 * `!important` declarations outrank that stylesheet rule.
 */
export function restoreMacMenuIcon(element: Element, icon: string) {
  const style = (element as Element & { style?: CSSStyleDeclaration }).style;
  if (!style) return;
  const url = `url(${JSON.stringify(icon)})`;
  element.classList.add(
    element.localName === "menu" ? "menu-iconic" : "menuitem-iconic",
  );
  style.setProperty("list-style-image", url, "important");
  style.setProperty("--menuitem-icon", url, "important");
  const box = Array.from(element.children).find((child) =>
    child.classList.contains("menu-icon"),
  ) as (Element & { style?: CSSStyleDeclaration }) | undefined;
  box?.style?.setProperty("display", "revert", "important");
}

type Predicate = (
  element: never,
  event: Event,
) => boolean | undefined | Promise<boolean | undefined>;

function resolvePredicate(
  predicate: Predicate | undefined,
  element: Element,
  event: Event,
  apply: (value: boolean) => void,
  report: (error: unknown) => void,
) {
  if (!predicate) return;
  const value = predicate(element as never, event);
  // Resolve synchronous predicates immediately: macOS snapshots the native menu
  // before a promise continuation could run.
  if (typeof value === "object" && value !== null) {
    void Promise.resolve(value).then((resolved) => {
      if (resolved !== undefined) apply(resolved);
    }, report);
  } else if (value !== undefined) apply(value);
}

function runCommand(
  listener: MenuitemOptions["commandListener"],
  event: Event,
) {
  if (typeof listener === "function") listener(event);
  else listener?.handleEvent(event);
}

/** Translate a toolkit menu descriptor into MenuManager menu data. */
export function toOfficialMenuData(
  options: MenuitemOptions,
  host: ZoteroHost | undefined = defaultHost(),
  report: (error: unknown) => void = () => {},
): OfficialMenuData {
  const menuType =
    options.tag === "menu"
      ? "submenu"
      : options.tag === "menuseparator"
        ? "separator"
        : "menuitem";
  // MenuitemOptions is a tag-discriminated union; read the optional fields
  // without narrowing on each branch.
  const loose = options as {
    children?: MenuitemOptions[];
    subElementOptions?: MenuitemOptions[];
    onShowing?: (element: Element, event: Event) => unknown;
  };
  const children = loose.children ?? loose.subElementOptions ?? [];
  const isMac = Boolean(host?.isMac);
  const data: OfficialMenuData = {
    menuType,
    // MenuData has no label field; labels are applied in onShowing. A label is
    // written only once so features may replace it like toolkit-owned menus.
    onShowing: (event, context) => {
      const element = context.menuElem;
      if (!element) return;
      try {
        if (options.id && element.id !== options.id) element.id = options.id;
        if (options.label && !element.hasAttribute("label"))
          element.setAttribute("label", options.label);
        if (options.icon && isMac) restoreMacMenuIcon(element, options.icon);
        if (options.hidden !== undefined) context.setVisible(!options.hidden);
        if (options.disabled !== undefined)
          context.setEnabled(!options.disabled);
        if (options.isHidden)
          resolvePredicate(
            options.isHidden as Predicate,
            element,
            event,
            (hidden) => context.setVisible(!hidden),
            report,
          );
        else
          resolvePredicate(
            options.getVisibility as Predicate | undefined,
            element,
            event,
            (visible) => context.setVisible(visible),
            report,
          );
        resolvePredicate(
          options.isDisabled as Predicate | undefined,
          element,
          event,
          (disabled) => context.setEnabled(!disabled),
          report,
        );
        // Toolkit semantics: onShowing belongs to leaf entries only.
        if (menuType !== "submenu" && loose.onShowing) {
          const result = loose.onShowing(element, event);
          void Promise.resolve(result).catch(report);
        }
      } catch (error) {
        report(error);
      }
    },
  };
  if (options.icon && menuType !== "separator") data.icon = options.icon;
  if (menuType === "menuitem" && options.commandListener) {
    const listener = options.commandListener;
    data.onCommand = (event) => runCommand(listener, event);
  }
  if (menuType === "submenu")
    data.menus = children.map((child: MenuitemOptions) =>
      toOfficialMenuData(child, host, report),
    );
  return data;
}

type ActiveRegistration = {
  key: string;
  options: MenuitemOptions;
};
const activeRegistrations = new Set<ActiveRegistration>();

/**
 * MenuManager elements have no DOM id until their popupshowing hook. Code that
 * inspects the popup right after Zotero builds it can call this first.
 */
export function prepareOfficialMenuElements(popup: Element) {
  // Zotero's typings expose this collection as nullable Nodes.
  const children = Array.from(
    popup.querySelectorAll(`.${CUSTOM_MENU_CLASS}`) as ArrayLike<unknown>,
  ) as Element[];
  for (const child of children) {
    for (const { key, options } of activeRegistrations) {
      // Zotero tags each top-level element with its registration key.
      if (!child.classList.contains(key)) continue;
      if (options.id) child.id = options.id;
      if (options.label && !child.hasAttribute("label"))
        child.setAttribute("label", options.label);
    }
  }
}

export interface ContextMenuHandle {
  /** Replace the registered menu, e.g. after its children changed. */
  update(options: MenuitemOptions): void;
  dispose(): void;
}

let generatedID = 0;

export interface ContextMenuDependencies {
  host?: ZoteroHost;
  toolkitMenu?: Pick<ZoteroToolkit["Menu"], "register" | "unregister">;
  report?: (error: unknown) => void;
}

/**
 * Register one top-level item/collection context-menu entry. Zotero 11+ uses
 * `Zotero.MenuManager`; Zotero 10 keeps `ztoolkit.Menu.register`.
 */
export function registerContextMenu(
  target: ContextMenuTarget,
  initial: MenuitemOptions,
  dependencies: ContextMenuDependencies = {},
): ContextMenuHandle {
  const host = dependencies.host ?? defaultHost();
  const report =
    dependencies.report ??
    ((error: unknown) => ztoolkit.log("Context menu hook failed", error));
  const manager = getOfficialMenuManager(host);
  let active = true;

  if (!manager) {
    const menu = dependencies.toolkitMenu ?? ztoolkit.Menu;
    let id = initial.id || `${config.addonRef}-context-menu-${++generatedID}`;
    const register = (options: MenuitemOptions) => {
      id = options.id || id;
      menu.unregister(id);
      if (menu.register(target, { ...options, id }) === false)
        throw new Error(`Unable to register context menu: ${id}`);
    };
    register(initial);
    return {
      update(options) {
        if (active) register(options);
      },
      dispose() {
        if (!active) return;
        active = false;
        menu.unregister(id);
      },
    };
  }

  if (initial.tag === "menuseparator")
    throw new Error("Zotero does not allow top-level context-menu separators.");
  const menuID = initial.id || `context-menu-${++generatedID}`;
  let registration: ActiveRegistration | undefined;
  const unregister = () => {
    if (!registration) return;
    manager.unregisterMenu(registration.key);
    activeRegistrations.delete(registration);
    registration = undefined;
  };
  const register = (options: MenuitemOptions) => {
    unregister();
    const key = manager.registerMenu({
      menuID,
      pluginID: config.addonID,
      target: OFFICIAL_TARGETS[target],
      menus: [toOfficialMenuData(options, host, report)],
    });
    if (key === false)
      throw new Error(`Unable to register context menu: ${menuID}`);
    registration = { key, options };
    activeRegistrations.add(registration);
  };
  register(initial);
  return {
    update(options) {
      if (active) register(options);
    },
    dispose() {
      if (!active) return;
      active = false;
      unregister();
    },
  };
}
