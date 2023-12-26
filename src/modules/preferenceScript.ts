import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";

export async function registerPrefsScripts(_window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
  updatePrefsUI();
  bindPrefEvents();
}

async function updatePrefsUI() {
  const doc = addon.data
    .prefs!.window.document
  const destSettingBox = doc.querySelector("#dest-setting") as XUL.GroupBox
  if (getPref("attachType") == "importing") {
    destSettingBox.style.display = "none"
  } else {
    destSettingBox.style.display = ""
  }
}

function bindPrefEvents() {
  // 选择源目录
  const doc = addon.data
    .prefs!.window.document
  doc.querySelector("#choose-source-dir")
    ?.addEventListener("command", async () => {
      const sourceDir = await new ztoolkit.FilePicker(
        "Select Source Directory",
        "folder"
      ).open();
      if (sourceDir) {
        setPref("sourceDir", sourceDir)
      }
    })
  // 选择目标目录
  doc.querySelector("#choose-dest-dir")
    ?.addEventListener("command", async () => {
      const destDir = await new ztoolkit.FilePicker(
        "Select Destination Directory",
        "folder"
      ).open();
      if (destDir) {
        setPref("destDir", destDir)
      }
    })
  doc.querySelector("#attach-type")
    ?.addEventListener("command", async () => {
      await updatePrefsUI()
    })
}
