import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { listenShortcut } from "../utils/shortcut";

export async function registerPrefsScripts(_window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
  ensureStringPref("filenameSkipRenameRules");
  ensureStringPref("filenameSkipAutoMoveRenameRules");
  ensureBooleanPref("autoRenameOnModifyDebounceEnabled", true);
  ensureNumberPref("autoRenameOnModifyDebounceMs", 1000);
  ensureBooleanPref("autoRenameOnModifyDelayEnabled", false);
  ensureNumberPref("autoRenameOnModifyDelayMs", 0);
  updatePrefsUI();
  bindPrefEvents(_window);
}

async function updatePrefsUI() {
  const doc = addon.data.prefs!.window.document;
  const destSettingBox = doc.querySelector("#dest-setting") as XUL.GroupBox;
  if (getPref("attachType") == "importing") {
    destSettingBox.style.opacity = ".6";
  } else {
    destSettingBox.style.opacity = "1";
  }
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
}

/**
 * 快捷键勾选框未勾选时，对应输入框置灰禁用
 */
function updateShortcutRows() {
  const doc = addon.data.prefs!.window.document;
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
  setPref(key, getNonNegativeIntegerPref(key, fallback));
}

function bindNumberPrefInput(
  selector: string,
  key: string,
  fallback: number,
  doc: Document,
) {
  const inputNode = doc.querySelector(selector) as HTMLInputElement | null;
  inputNode?.addEventListener("change", () => {
    const normalized = normalizeNonNegativeInteger(inputNode.value, fallback);
    inputNode.value = `${normalized}`;
    setPref(key, normalized);
  });
}

function bindPrefEvents(_window: Window) {
  // 选择源目录
  const doc = addon.data.prefs!.window.document;
  doc
    .querySelector("#file-renaming-button")
    ?.addEventListener("command", () => {
      // @ts-ignore Zotero exposes this preferences controller at runtime.
      _window.Zotero_Preferences.General.openFileRenamingDialog()
    })
  doc
    .querySelector("#choose-source-dir")
    ?.addEventListener("command", async () => {
      let oldPath = getPref("sourceDir") as string;
      try { PathUtils.normalize(oldPath) } catch { oldPath = "" }

      // @ts-ignore _window
      const fp = new window.FilePicker();
      if (oldPath) {
        fp.displayDirectory = PathUtils.normalize(oldPath)
      }
      fp.init(window, "Select Source Directory", fp.modeGetFolder);
      fp.appendFilters(fp.filterAll);
      if ((await fp.show()) != fp.returnOK) {
        return false;
      }
      const newPath = PathUtils.normalize(fp.file);
      if (newPath) {
        setPref("sourceDir", newPath);
      }
    });
  // 选择目标目录
  doc
    .querySelector("#choose-dest-dir")
    ?.addEventListener("command", async () => {
      let oldPath = getPref("destDir") as string;
      try { PathUtils.normalize(oldPath) } catch { oldPath  = ""}
      // @ts-ignore _window
      const fp = new window.FilePicker();
      if (oldPath) {
        fp.displayDirectory = PathUtils.normalize(oldPath)
      }
      fp.init(window, "Select Destination Directory", fp.modeGetFolder);
      fp.appendFilters(fp.filterAll);
      if ((await fp.show()) != fp.returnOK) {
        return false;
      }
      const newPath = PathUtils.normalize(fp.file);
      if (newPath) {
        setPref("destDir", newPath);
      }
    });
  doc.querySelector("#attach-type")?.addEventListener("command", async () => {
    await updatePrefsUI();
  });
  const autoRenameOnModifyCheckbox = doc.querySelector(
    "#auto-rename-on-modify",
  ) as XUL.Checkbox | null;
  autoRenameOnModifyCheckbox?.addEventListener("command", async () => {
    setPref("autoRenameOnModify", autoRenameOnModifyCheckbox.checked);
    await updatePrefsUI();
  });
  doc
    .querySelectorAll(
      "#auto-rename-on-modify-debounce, #auto-rename-on-modify-delay",
    )
    // @ts-ignore forEach
    .forEach((checkbox: XUL.Checkbox) => {
      checkbox.addEventListener("command", async () => {
        const enabledKey = checkbox.id.endsWith("-debounce")
          ? "autoRenameOnModifyDebounceEnabled"
          : "autoRenameOnModifyDelayEnabled";
        setPref(enabledKey, checkbox.checked);
        await updatePrefsUI();
      });
    });
  bindNumberPrefInput(
    "#auto-rename-on-modify-debounce-ms",
    "autoRenameOnModifyDebounceMs",
    1000,
    doc,
  );
  bindNumberPrefInput(
    "#auto-rename-on-modify-delay-ms",
    "autoRenameOnModifyDelayMs",
    0,
    doc,
  );
  doc
    .querySelector('[preference$=".moveWithoutDeleting"]')
    ?.addEventListener("command", () => {
      addon.data.menu?.refreshItemMenu();
    });

  doc
    .querySelectorAll(".shortcut")
    // @ts-ignore forEach
    .forEach((inputNode: HTMLInputElement) => {
      listenShortcut(inputNode, (shortcut: string) => {
        Zotero.Prefs.set(
          inputNode.getAttribute("preference") as string,
          shortcut,
          true,
        );
        // 同步更新右键菜单中的快捷键提示
        addon.data.menu?.refreshItemMenu();
      });
    });

  doc
    .querySelectorAll("checkbox.shortcut-enable")
    // @ts-ignore forEach
    .forEach((checkbox: XUL.Checkbox) => {
      checkbox.addEventListener("command", () => {
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
