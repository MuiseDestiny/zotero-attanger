import { config } from "../../package.json";
import { getPref, setPref } from "../utils/prefs";
import { listenShortcut } from "../utils/shortcut";
import {
  getWorkMode,
  initializeWorkMode,
  setWorkMode,
} from "../utils/workMode";
import {
  addSourceDir,
  getExtraSourceDirs,
  removeExtraSourceDir,
} from "../utils/sourceDirs";
import { attachmentPathExists, isZoteroStoragePath } from "./attachmentFiles";
import {
  getSubfolderPath,
  isFilenameMatched,
  removeFilenameDiacritics,
} from "./menu";

type PrefsSession = {
  window: Window;
  revision: number;
  disposed: boolean;
  customSubfolder: boolean;
  disposers: (() => void)[];
  searchSections: Map<HTMLDetailsElement, boolean>;
  cleanup: () => void;
};

type PrefsDocument = Pick<
  Document,
  "querySelector" | "querySelectorAll" | "activeElement"
>;

let prefsSession: PrefsSession | undefined;

function getPrefsDocument(session: PrefsSession): PrefsDocument {
  const doc = session.window.document;
  const root = doc.querySelector(`#zotero-prefpane-${config.addonRef}`) || doc;
  return {
    querySelector: root.querySelector.bind(root),
    querySelectorAll: root.querySelectorAll.bind(root),
    get activeElement() {
      return doc.activeElement;
    },
  };
}

export function unregisterPrefsScripts() {
  prefsSession?.cleanup();
}

export async function registerPrefsScripts(_window: Window) {
  prefsSession?.cleanup();
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
  initializeWorkMode();
  ensureStringPref("filenameSkipRenameRules");
  ensureStringPref("filenameSkipAutoMoveRenameRules");
  ensureBooleanPref("autoRecognizeImportedPDF", true);
  ensureBooleanPref("deleteSourceAfterImport", true);
  ensureBooleanPref("autoRenameOnModifyDebounceEnabled", true);
  ensureNumberPref("autoRenameOnModifyDebounceMs", 1000);
  ensureBooleanPref("autoRenameOnModifyDelayEnabled", false);
  ensureNumberPref("autoRenameOnModifyDelayMs", 0);
  const observers: symbol[] = [];
  const session: PrefsSession = {
    window: _window,
    revision: 0,
    disposed: false,
    customSubfolder: false,
    disposers: [],
    searchSections: new Map(),
    cleanup: () => {
      if (session.disposed) return;
      session.disposed = true;
      session.revision++;
      session.disposers.splice(0).forEach((dispose) => dispose());
      session.searchSections.forEach((open, section) => {
        section.open = open;
      });
      session.searchSections.clear();
      observers.forEach((id) => Zotero.Prefs.unregisterObserver(id));
      _window.removeEventListener?.("focus", refresh);
      _window.removeEventListener?.("unload", session.cleanup);
      if (prefsSession === session) prefsSession = undefined;
    },
  };
  const refresh = () => {
    if (!session.disposed && prefsSession === session) {
      updateSearchSections(session);
      void updatePrefsUI().catch((error) =>
        ztoolkit.log("Settings refresh failed", error),
      );
    }
  };
  prefsSession = session;
  bindPrefEvents(session);
  updateSearchSections(session);
  onPrefsEvent(
    session,
    _window.document.querySelector(`#zotero-prefpane-${config.addonRef}`),
    "showing",
    refresh,
  );
  _window.addEventListener?.("focus", refresh);
  _window.addEventListener?.("unload", session.cleanup, { once: true });
  if (typeof Zotero.Prefs.registerObserver === "function") {
    const keys = [
      "workMode",
      "destDir",
      "sourceDir",
      "extraSourceDirs",
      "subfolderFormat",
      "slashAsSubfolderDelimiter",
      "fileTypes",
      "removeDiacritics",
      "filenameAsPrefixRules",
      "filenameSkipRenameRules",
      "filenameSkipAutoMoveRenameRules",
      "autoRenameOnModify",
      "autoRenameOnModifyDebounceEnabled",
      "autoRenameOnModifyDebounceMs",
      "autoRenameOnModifyDelayEnabled",
      "autoRenameOnModifyDelayMs",
    ].map((key) => `${config.prefsPrefix}.${key}`);
    keys.push(
      "extensions.zotero.autoRenameFiles",
      "extensions.zotero.attachmentRenameTemplate",
      "extensions.zotero.attachmentRenameFormatString",
    );
    keys.forEach((key) =>
      observers.push(Zotero.Prefs.registerObserver(key, refresh, true)),
    );
    // Linked-mode menu labels switch between move and copy with this option.
    observers.push(
      Zotero.Prefs.registerObserver(
        `${config.prefsPrefix}.moveWithoutDeleting`,
        () => {
          if (isPrefsSessionActive(session)) addon.data.menu?.refreshItemMenu();
        },
        true,
      ),
    );
  }
  await updatePrefsUI();
}

async function updatePrefsUI() {
  const session = prefsSession;
  if (!session || session.disposed) return;
  const revision = ++session.revision;
  const doc = getPrefsDocument(session);
  const mode = getWorkMode();
  const workMode = doc.querySelector("#work-mode") as XUL.RadioGroup | null;
  if (workMode) {
    workMode.value = mode;
  }
  doc.querySelectorAll("[data-mode-card]").forEach((card) => {
    card.setAttribute(
      "data-selected",
      String(card.getAttribute("data-mode-card") === mode),
    );
  });
  const destSettingBox = doc.querySelector(
    "#dest-setting",
  ) as HTMLElement | null;
  if (destSettingBox) {
    destSettingBox.hidden = mode === "stored";
  }
  const targetLayout = doc.querySelector(
    "#target-layout-settings",
  ) as HTMLElement | null;
  if (targetLayout) {
    targetLayout.hidden = mode === "stored";
  }
  doc.querySelectorAll<HTMLElement>("[data-work-mode]").forEach((element) => {
    element.hidden = element.getAttribute("data-work-mode") !== mode;
  });
  doc
    .querySelectorAll<HTMLInputElement>("#dest-dir, #source-dir")
    .forEach((input) => {
      const value = getPref(input.id === "dest-dir" ? "destDir" : "sourceDir");
      input.value = typeof value === "string" ? value : "";
    });
  renderExtraSourceDirs(session, doc);
  setLocalizedText(
    doc,
    "#dest-dir-label",
    mode === "copy" ? "work-mode-copy-directory" : "work-mode-linked-directory",
  );
  const cleanup = doc.querySelector(
    "#auto-remove-empty-folder",
  ) as HTMLElement | null;
  if (cleanup) cleanup.hidden = mode === "stored";
  updateOrganizingRules(doc, session);
  const autoRenameOnModify = Boolean(getPref("autoRenameOnModify"));
  const autoRenameOptions = doc.querySelector(
    "#auto-rename-on-modify-options",
  ) as HTMLElement | null;
  if (autoRenameOptions) {
    autoRenameOptions.hidden = !autoRenameOnModify;
  }
  const timedSettings = [
    {
      id: "auto-rename-on-modify-debounce",
      enabledKey: "autoRenameOnModifyDebounceEnabled",
      valueKey: "autoRenameOnModifyDebounceMs",
      fallback: 1000,
    },
    {
      id: "auto-rename-on-modify-delay",
      enabledKey: "autoRenameOnModifyDelayEnabled",
      valueKey: "autoRenameOnModifyDelayMs",
      fallback: 0,
    },
  ];
  for (const setting of timedSettings) {
    const checkbox = doc.querySelector(`#${setting.id}`) as XUL.Checkbox;
    const input = doc.querySelector(`#${setting.id}-ms`) as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = Boolean(getPref(setting.enabledKey));
    }
    if (input) {
      input.value = `${getNonNegativeIntegerPref(
        setting.valueKey,
        setting.fallback,
      )}`;
      input.disabled = !checkbox?.checked;
    }
  }
  updateShortcutRows();
  if (doc.querySelector("#work-mode-status-title")) {
    const status = doc.querySelector("#work-mode-status");
    if (mode !== "stored") {
      status?.setAttribute("data-ready", "false");
      setLocalizedText(
        doc,
        "#work-mode-status-title",
        "work-mode-status-checking",
      );
      setLocalizedText(doc, "#work-mode-summary", `work-mode-summary-${mode}`, {
        state: "checking",
      });
      const detail = doc.querySelector("#work-mode-status-detail");
      detail?.removeAttribute("data-l10n-id");
      detail?.removeAttribute("data-l10n-args");
      if (detail) detail.textContent = "";
    }
    const state = mode === "stored" ? "ready" : await getDestinationState(mode);
    if (
      session.disposed ||
      prefsSession !== session ||
      revision !== session.revision
    )
      return;
    status?.setAttribute("data-ready", String(state === "ready"));
    const rename = Boolean(Zotero.Prefs.get("autoRenameFiles"));
    const titleKey =
      mode === "stored"
        ? "work-mode-status-stored"
        : state === "ready"
          ? "work-mode-status-ready"
          : `work-mode-status-${state}`;
    const detailKey =
      mode === "stored"
        ? rename
          ? "work-mode-stored-renaming"
          : "work-mode-stored-original-name"
        : state === "ready"
          ? `work-mode-${mode}-ready-note`
          : `work-mode-${state}-note`;
    setLocalizedText(doc, "#work-mode-status-title", titleKey);
    setLocalizedText(doc, "#work-mode-status-detail", detailKey);
    setLocalizedText(doc, "#work-mode-summary", `work-mode-summary-${mode}`, {
      state,
    });
  }
}

type DestinationState = "ready" | "missing" | "invalid" | "unsafe" | "readonly";

async function getDestinationState(mode: string): Promise<DestinationState> {
  if (mode === "stored") return "ready";
  const path = getPref("destDir");
  if (typeof path !== "string" || !path.trim()) return "missing";
  if (!(await attachmentPathExists(path, "directory"))) return "invalid";
  if (isZoteroStoragePath(path)) return "unsafe";
  try {
    if (!Zotero.File.pathToFile(path).isWritable()) return "readonly";
  } catch {
    return "invalid";
  }
  return "ready";
}

function setLocalizedText(
  doc: PrefsDocument,
  selector: string,
  key: string,
  args?: Record<string, string>,
) {
  const element = doc.querySelector(selector);
  if (!element) return;
  // The packaging step prefixes static Fluent IDs; dynamic IDs need the same prefix.
  element.setAttribute("data-l10n-id", `${config.addonRef}-${key}`);
  if (args) element.setAttribute("data-l10n-args", JSON.stringify(args));
  else element.removeAttribute("data-l10n-args");
}

/** Rebuilds the extra download-folder rows; the primary row is static XHTML. */
function renderExtraSourceDirs(session: PrefsSession, doc: PrefsDocument) {
  const list = doc.querySelector("#extra-source-dirs") as HTMLElement | null;
  if (!list) return;
  const dirs = getExtraSourceDirs();
  if (list.getAttribute("data-dirs") === JSON.stringify(dirs)) return;
  list.setAttribute("data-dirs", JSON.stringify(dirs));
  list.replaceChildren();
  list.hidden = dirs.length === 0;
  const ownerDocument = session.window.document as any;
  for (const dir of dirs) {
    const row = ownerDocument.createXULElement("hbox");
    row.setAttribute("align", "center");
    row.setAttribute("class", "attanger-path-row");
    const input = ownerDocument.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "input",
    );
    input.setAttribute("type", "text");
    input.setAttribute("readonly", "true");
    input.setAttribute("flex", "1");
    input.value = dir;
    input.setAttribute("title", dir);
    const remove = ownerDocument.createXULElement("button");
    remove.setAttribute("data-source-dir", dir);
    // Same prefix as static IDs; the list listener handles removal.
    remove.setAttribute("data-l10n-id", `${config.addonRef}-remove-source-dir`);
    row.append(input, remove);
    list.append(row);
  }
}

function getSubfolderLayout(template: string) {
  if (template === "{{collection}}") return "collection";
  if (template === "{{year}}") return "year";
  if (!template) return "flat";
  return "custom";
}

function updateOrganizingRules(doc: PrefsDocument, session: PrefsSession) {
  const rawTemplate = getPref("subfolderFormat");
  const template = typeof rawTemplate === "string" ? rawTemplate : "";
  const layout = session.customSubfolder
    ? "custom"
    : getSubfolderLayout(template);
  const selector = doc.querySelector(
    "#subfolder-layout",
  ) as XUL.MenuList | null;
  if (selector) selector.value = layout;
  const custom = doc.querySelector(
    "#subfolder-custom-settings",
  ) as HTMLElement | null;
  if (custom) custom.hidden = layout !== "custom";
  const input = doc.querySelector(
    "#subfolder-format",
  ) as HTMLInputElement | null;
  if (input && doc.activeElement !== input) input.value = template;
  const rename = Boolean(Zotero.Prefs.get("autoRenameFiles"));
  const renameCheckbox = doc.querySelector(
    "#auto-rename",
  ) as XUL.Checkbox | null;
  if (renameCheckbox) renameCheckbox.checked = rename;
  setLocalizedText(
    doc,
    "#organizing-rules-summary",
    "organizing-rules-summary",
    {
      mode: getWorkMode(),
      layout,
      rename: rename ? "enabled" : "disabled",
      template,
    },
  );
  updateRulePreview(doc, rename);
}

function updateRulePreview(doc: PrefsDocument, rename: boolean) {
  const value = doc.querySelector("#rule-preview-value");
  if (!value) return;
  const mode = getWorkMode();
  try {
    // An unsaved example item uses Zotero's actual formatter without touching library data.
    const item = new Zotero.Item("journalArticle");
    item.libraryID = Zotero.Libraries.userLibraryID;
    item.setField("title", "Learning representations");
    item.setField("date", "2026");
    item.setCreators([
      { firstName: "Mei", lastName: "Wang", creatorType: "author" },
    ]);
    const original = "paper-2026";
    const types = String(getPref("fileTypes") || "");
    const supportsPDF =
      !types ||
      types
        .toLowerCase()
        .split(",")
        .some((type) => type.trim().replace(/^\./, "") === "pdf");
    const skipAutomatic =
      isFilenameMatched("filenameSkipAutoMoveRenameRules", original) ||
      !supportsPDF;
    setLocalizedText(
      doc,
      "#rule-preview-title",
      mode === "stored" || skipAutomatic
        ? "rules-preview-filename"
        : "rules-preview-path",
    );
    setLocalizedText(
      doc,
      "#rule-preview-note",
      skipAutomatic ? "rules-preview-skipped" : "rules-preview-note",
    );
    let filename = original;
    if (
      rename &&
      !skipAutomatic &&
      !isFilenameMatched("filenameSkipRenameRules", original)
    ) {
      // Older zotero-types declare only a string format argument.
      filename = Zotero.Attachments.getFileBaseNameFromItem(item, {
        attachmentTitle: "PDF",
      } as any);
      if (isFilenameMatched("filenameAsPrefixRules", original))
        filename = `${original}_${filename}`;
      filename = removeFilenameDiacritics(filename);
    }
    filename += ".pdf";
    let subfolder = "";
    if (mode !== "stored" && !skipAutomatic) {
      subfolder = getSubfolderPath(item, () => "Machine Learning");
    }
    const target = String(getPref("destDir") || "");
    if (mode !== "stored" && !skipAutomatic) {
      const relative = subfolder
        ? `${subfolder}${addon.data.folderSep}${filename}`
        : filename;
      if (target) {
        value.removeAttribute("data-l10n-id");
        value.removeAttribute("data-l10n-args");
        value.textContent = PathUtils.joinRelative(target, relative);
      } else {
        setLocalizedText(
          doc,
          "#rule-preview-value",
          "rules-preview-unconfigured",
          { path: relative },
        );
      }
    } else {
      value.removeAttribute("data-l10n-id");
      value.removeAttribute("data-l10n-args");
      value.textContent = filename;
    }
  } catch (error) {
    ztoolkit.log("Cannot render attachment rule preview", error);
    setLocalizedText(
      doc,
      "#rule-preview-title",
      mode === "stored" ? "rules-preview-filename" : "rules-preview-path",
    );
    setLocalizedText(doc, "#rule-preview-note", "rules-preview-note");
    setLocalizedText(doc, "#rule-preview-value", "rules-preview-unavailable");
  }
}

/**
 * 快捷键勾选框未勾选时，对应输入框置灰禁用
 */
function updateShortcutRows() {
  if (!prefsSession) return;
  const doc = getPrefsDocument(prefsSession);
  doc
    .querySelectorAll("checkbox.shortcut-enable")
    // @ts-ignore forEach
    .forEach((checkbox: XUL.Checkbox) => {
      const input = checkbox
        .closest("hbox")
        ?.querySelector("input.shortcut") as HTMLInputElement | null;
      if (!input) return;
      const prefName = checkbox.getAttribute("preference") as string;
      const enabled = Zotero.Prefs.get(prefName, true) !== false;
      input.disabled = !enabled;
      input.style.opacity = enabled ? "1" : "0.5";
    });
}

function ensureStringPref(key: string) {
  const value = getPref(key);
  if (typeof value !== "string") {
    setPref(key, "");
  }
}

function ensureBooleanPref(key: string, fallback: boolean) {
  if (typeof getPref(key) !== "boolean") {
    setPref(key, fallback);
  }
}

function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function getNonNegativeIntegerPref(key: string, fallback: number) {
  return normalizeNonNegativeInteger(getPref(key), fallback);
}

function ensureNumberPref(key: string, fallback: number) {
  const value = getNonNegativeIntegerPref(key, fallback);
  if (getPref(key) !== value) setPref(key, value);
}

function bindNumberPrefInput(
  selector: string,
  key: string,
  fallback: number,
  session: PrefsSession,
) {
  const doc = getPrefsDocument(session);
  const inputNode = doc.querySelector(selector) as HTMLInputElement | null;
  onPrefsEvent(session, inputNode, "change", () => {
    if (!inputNode) return;
    const normalized = normalizeNonNegativeInteger(inputNode.value, fallback);
    inputNode.value = `${normalized}`;
    setPref(key, normalized);
  });
}

function isPrefsSessionActive(session: PrefsSession) {
  return !session.disposed && prefsSession === session;
}

function updateSearchSections(session: PrefsSession) {
  const doc = session.window.document;
  const search = doc.querySelector("#prefs-search") as HTMLInputElement | null;
  if (search?.value?.trim()) {
    const root = doc.querySelector(`#zotero-prefpane-${config.addonRef}`);
    root?.querySelectorAll<HTMLDetailsElement>("details").forEach((section) => {
      if (!session.searchSections.has(section))
        session.searchSections.set(section, section.open);
      section.open = true;
    });
  } else {
    session.searchSections.forEach((open, section) => {
      section.open = open;
    });
    session.searchSections.clear();
  }
}

function onPrefsEvent(
  session: PrefsSession,
  node: Element | null,
  type: string,
  callback: (event: Event) => unknown,
  options?: AddEventListenerOptions,
) {
  if (!node) return;
  const listener = (event: Event) => {
    if (!isPrefsSessionActive(session)) return;
    return callback(event);
  };
  node.addEventListener(type, listener, options);
  session.disposers.push(() =>
    node.removeEventListener?.(type, listener, options),
  );
}

function createPrefsFilePicker(_window: Window) {
  if (typeof ChromeUtils !== "undefined" && ChromeUtils.importESModule) {
    const { FilePicker } = ChromeUtils.importESModule(
      "chrome://zotero/content/modules/filePicker.mjs",
    );
    return new FilePicker();
  }
  const FilePicker = (_window as any).FilePicker || (window as any).FilePicker;
  return new FilePicker();
}

async function openNativeFileRenaming(_window: Window) {
  const prefs = (_window as any).Zotero_Preferences;
  // Zotero 7/8 use a preferences subpane; newer versions open a separate dialog.
  if (prefs?.panes?.has("zotero-subpane-file-renaming")) {
    await prefs.navigateToPane("zotero-subpane-file-renaming");
    return;
  }
  const general =
    prefs?.General ||
    prefs?.getScope?.("zotero-prefpane-general")?.Zotero_Preferences?.General;
  if (general?.openFileRenamingDialog) {
    general.openFileRenamingDialog();
    return;
  }
  Services.ww.openWindow(
    _window,
    "chrome://zotero/content/fileRenamingDialog.xhtml",
    "zotero-file-renaming-dialog",
    "chrome,dialog=no,titlebar,centerscreen,resizable=yes",
    null,
  );
}

function bindPrefEvents(session: PrefsSession) {
  const _window = session.window;
  // 选择源目录
  const doc = getPrefsDocument(session);
  const search = _window.document.querySelector("#prefs-search");
  for (const type of ["input", "command"]) {
    onPrefsEvent(session, search, type, () => updateSearchSections(session), {
      capture: true,
    });
  }
  onPrefsEvent(
    session,
    doc.querySelector("#attanger-file-renaming-button"),
    "command",
    () => openNativeFileRenaming(_window),
  );
  onPrefsEvent(
    session,
    doc.querySelector("#choose-source-dir"),
    "command",
    async () => {
      let oldPath = getPref("sourceDir") as string;
      try {
        oldPath = PathUtils.normalize(oldPath);
      } catch {
        oldPath = "";
      }

      const fp = createPrefsFilePicker(_window);
      if (oldPath) {
        fp.displayDirectory = oldPath;
      }
      fp.init(_window, "Select Source Directory", fp.modeGetFolder);
      fp.appendFilters(fp.filterAll);
      if ((await fp.show()) != fp.returnOK) {
        return false;
      }
      if (!isPrefsSessionActive(session)) return;
      const newPath = PathUtils.normalize(fp.file);
      if (newPath) {
        setPref("sourceDir", newPath);
        await updatePrefsUI();
      }
    },
  );
  onPrefsEvent(
    session,
    doc.querySelector("#extra-source-dirs"),
    "command",
    async (event) => {
      const dir = (event.target as Element | null)?.getAttribute?.(
        "data-source-dir",
      );
      if (!dir) return;
      removeExtraSourceDir(dir);
      await updatePrefsUI();
    },
  );
  onPrefsEvent(
    session,
    doc.querySelector("#add-source-dir"),
    "command",
    async () => {
      const fp = createPrefsFilePicker(_window);
      fp.init(_window, "Add Download Folder", fp.modeGetFolder);
      fp.appendFilters(fp.filterAll);
      if ((await fp.show()) != fp.returnOK) return false;
      if (!isPrefsSessionActive(session)) return;
      const newPath = PathUtils.normalize(fp.file);
      if (newPath && addSourceDir(newPath)) await updatePrefsUI();
    },
  );
  // 选择目标目录
  onPrefsEvent(
    session,
    doc.querySelector("#choose-dest-dir"),
    "command",
    async () => {
      let oldPath = getPref("destDir") as string;
      try {
        oldPath = PathUtils.normalize(oldPath);
      } catch {
        oldPath = "";
      }
      const fp = createPrefsFilePicker(_window);
      if (oldPath) {
        fp.displayDirectory = oldPath;
      }
      fp.init(_window, "Select Destination Directory", fp.modeGetFolder);
      fp.appendFilters(fp.filterAll);
      if ((await fp.show()) != fp.returnOK) {
        return false;
      }
      if (!isPrefsSessionActive(session)) return;
      const newPath = PathUtils.normalize(fp.file);
      if (newPath) {
        setPref("destDir", newPath);
        await updatePrefsUI();
      }
    },
  );
  const subfolderLayout = doc.querySelector(
    "#subfolder-layout",
  ) as XUL.MenuList | null;
  onPrefsEvent(session, subfolderLayout, "command", async () => {
    if (!subfolderLayout) return;
    const layout = subfolderLayout.value;
    session.customSubfolder = layout === "custom";
    const presets: Record<string, string> = {
      collection: "{{collection}}",
      year: "{{year}}",
      flat: "",
    };
    if (Object.prototype.hasOwnProperty.call(presets, layout)) {
      setPref("subfolderFormat", presets[layout]);
    }
    await updatePrefsUI();
    if (layout === "custom" && isPrefsSessionActive(session))
      subfolderInput?.focus();
  });
  const subfolderInput = doc.querySelector(
    "#subfolder-format",
  ) as HTMLInputElement | null;
  onPrefsEvent(session, subfolderInput, "change", async () => {
    if (!subfolderInput) return;
    setPref("subfolderFormat", subfolderInput.value);
    await updatePrefsUI();
  });
  const autoRename = doc.querySelector("#auto-rename") as XUL.Checkbox | null;
  onPrefsEvent(session, autoRename, "command", async () => {
    if (!autoRename) return;
    Zotero.Prefs.set("autoRenameFiles", autoRename.checked);
    await updatePrefsUI();
  });
  const workMode = doc.querySelector("#work-mode") as XUL.RadioGroup | null;
  doc.querySelectorAll("[data-mode-card]").forEach((card) => {
    onPrefsEvent(session, card, "click", async (event) => {
      if ((event.target as Element)?.closest("radio")) return;
      const mode = card.getAttribute("data-mode-card");
      if (mode !== "stored" && mode !== "linked" && mode !== "copy") return;
      setWorkMode(mode);
      await updatePrefsUI();
      if (isPrefsSessionActive(session)) addon.data.menu?.refreshItemMenu();
    });
  });
  onPrefsEvent(session, workMode, "command", async () => {
    if (!workMode) return;
    const mode = workMode.value;
    if (mode !== "stored" && mode !== "linked" && mode !== "copy") return;
    setWorkMode(mode);
    await updatePrefsUI();
    if (isPrefsSessionActive(session)) addon.data.menu?.refreshItemMenu();
  });
  const autoRenameOnModifyCheckbox = doc.querySelector(
    "#auto-rename-on-modify",
  ) as XUL.Checkbox | null;
  onPrefsEvent(session, autoRenameOnModifyCheckbox, "command", async () => {
    if (!autoRenameOnModifyCheckbox) return;
    setPref("autoRenameOnModify", autoRenameOnModifyCheckbox.checked);
    await updatePrefsUI();
  });
  doc
    .querySelectorAll(
      "#auto-rename-on-modify-debounce, #auto-rename-on-modify-delay",
    )
    // @ts-ignore forEach
    .forEach((checkbox: XUL.Checkbox) => {
      onPrefsEvent(
        session,
        checkbox as unknown as Element,
        "command",
        async () => {
          const enabledKey = checkbox.id.endsWith("-debounce")
            ? "autoRenameOnModifyDebounceEnabled"
            : "autoRenameOnModifyDelayEnabled";
          setPref(enabledKey, checkbox.checked);
          await updatePrefsUI();
        },
      );
    });
  bindNumberPrefInput(
    "#auto-rename-on-modify-debounce-ms",
    "autoRenameOnModifyDebounceMs",
    1000,
    session,
  );
  bindNumberPrefInput(
    "#auto-rename-on-modify-delay-ms",
    "autoRenameOnModifyDelayMs",
    0,
    session,
  );
  doc
    .querySelectorAll(".shortcut")
    // @ts-ignore forEach
    .forEach((inputNode: HTMLInputElement) => {
      session.disposers.push(
        listenShortcut(inputNode, (shortcut: string) => {
          if (!isPrefsSessionActive(session)) return;
          Zotero.Prefs.set(
            inputNode.getAttribute("preference") as string,
            shortcut,
            true,
          );
          // 同步更新右键菜单中的快捷键提示
          addon.data.menu?.refreshItemMenu();
        }),
      );
    });

  doc
    .querySelectorAll("checkbox.shortcut-enable")
    // @ts-ignore forEach
    .forEach((checkbox: XUL.Checkbox) => {
      onPrefsEvent(session, checkbox as unknown as Element, "command", () => {
        Zotero.Prefs.set(
          checkbox.getAttribute("preference") as string,
          checkbox.checked,
          true,
        );
        updateShortcutRows();
        addon.data.menu?.refreshItemMenu();
      });
    });
}
