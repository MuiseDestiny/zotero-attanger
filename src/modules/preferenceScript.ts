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
}

function bindPrefEvents(_window: Window) {
  // 选择源目录
  const doc = addon.data.prefs!.window.document;
  doc
    .querySelector("#choose-source-dir")
    ?.addEventListener("command", async () => {
      var oldPath = getPref("sourceDir") as string
      // @ts-ignore
      var fp = new _window.FilePicker();
      if (oldPath) {
        fp.displayDirectory = PathUtils.normalize(oldPath);
      }
      fp.init(window, "Select Source Directory", fp.modeGetFolder);
      fp.appendFilters(fp.filterAll);
      if (await fp.show() != fp.returnOK) {
        return false;
      }
      var newPath = PathUtils.normalize(fp.file);
      if (newPath) {
        setPref("sourceDir", newPath);
      }
    });
  // 选择目标目录
  doc
    .querySelector("#choose-dest-dir")
    ?.addEventListener("command", async () => {
      var oldPath = getPref("destDir") as string
      // @ts-ignore
      var fp = new _window.FilePicker();
      if (oldPath) {
        fp.displayDirectory = PathUtils.normalize(oldPath);
      }
      fp.init(window, "Select Destination Directory", fp.modeGetFolder);
      fp.appendFilters(fp.filterAll);
      if (await fp.show() != fp.returnOK) {
        return false;
      }
      var newPath = PathUtils.normalize(fp.file);
      if (newPath) {
        setPref("destDir", newPath);
      }
    });
  doc.querySelector("#attach-type")?.addEventListener("command", async () => {
    await updatePrefsUI();
  });

  doc.querySelectorAll(".shortcut")
    // @ts-ignore
    .forEach((inputNode: HTMLInputElement) => {
      listenShortcut(inputNode, (shortcut: string) => {
        Zotero.Prefs.set(inputNode.getAttribute("preference") as string, shortcut, true)
      })
    })
}
