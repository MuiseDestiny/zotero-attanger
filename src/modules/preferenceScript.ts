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
  ensureNumberPref("autoRenameOnModifyDebounceMs", 1000);
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
  const debounceInput = doc.querySelector(
    "#auto-rename-on-modify-debounce-ms",
  ) as HTMLInputElement | null;
  const delayInput = doc.querySelector(
    "#auto-rename-on-modify-delay-ms",
  ) as HTMLInputElement | null;
  if (debounceInput) {
    debounceInput.disabled = !autoRenameOnModify;
    debounceInput.value = `${getNonNegativeIntegerPref(
      "autoRenameOnModifyDebounceMs",
      1000,
    )}`;
  }
  if (delayInput) {
    delayInput.disabled = !autoRenameOnModify;
    delayInput.value = `${getNonNegativeIntegerPref(
      "autoRenameOnModifyDelayMs",
      0,
    )}`;
  }
  doc
    .querySelectorAll(".auto-rename-on-modify-setting")
    // @ts-ignore forEach
    .forEach((settingNode: HTMLElement) => {
      settingNode.style.opacity = autoRenameOnModify ? "1" : ".6";
    });
}

function ensureStringPref(key: string) {
  const value = getPref(key);
  if (typeof value !== "string") {
    setPref(key, "");
  }
}

function normalizeNonNegativeInteger(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.floor(parsed)
    : fallback;
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
  doc
    .querySelector("#auto-rename-on-modify")
    ?.addEventListener("command", async () => {
      await updatePrefsUI();
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
    .querySelectorAll(".shortcut")
    // @ts-ignore forEach
    .forEach((inputNode: HTMLInputElement) => {
      listenShortcut(inputNode, (shortcut: string) => {
        Zotero.Prefs.set(
          inputNode.getAttribute("preference") as string,
          shortcut,
          true,
        );
      });
    });
}
