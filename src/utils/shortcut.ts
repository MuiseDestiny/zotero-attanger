import { KeyModifier } from "zotero-plugin-toolkit/dist/managers/keyboard";
import { config } from "../../package.json";

export function registerShortcut(
  prefKey: string,
  callback: () => Promise<void>,
) {
  const shortcutArr = (
    Zotero.Prefs.get(`${config.addonRef}.${prefKey}`) as string
  ).split(" + ");
  let shortcutString = (Zotero.Prefs.get(`${config.addonRef}.${prefKey}`) as string).replace(" + ", ",")
  const allModifiers = ["Shift", "Meta", "Ctrl", "Alt", "Control"];
  // for (let modifier of allModifiers) {
  //   shortcutString = shortcutString.replace(modifier, modifier.toLowerCase())
  // }
  shortcutString = shortcutString.replace("ctrl", "control")
  ztoolkit.Keyboard.register(async (ev, options) => {
    const k1 = options.keyboard!
    const k2 = options.keyboard!
    k1.key = k1.key.toLowerCase()
    k2.key = k2.key.toUpperCase()
    if (k1.equals(shortcutString) || k2.equals(shortcutString)) {
      callback();
    }
  })
}

export function listenShortcut(
  inputNode: HTMLInputElement,
  callback: (shortcut: string) => void,
) {
  inputNode.addEventListener("keydown", (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shortcut: any = {};
    shortcut.control = e.ctrlKey;
    shortcut.meta = e.metaKey;
    shortcut.shift = e.shiftKey;
    shortcut.alt = e.altKey;
    if (!["Shift", "Meta", "Ctrl", "Alt", "Control"].includes(e.key)) {
      shortcut.key = e.key.toUpperCase();
    }
    const keys = [];
    if (shortcut.control) {
      keys.push("Ctrl");
    }
    if (shortcut.meta) {
      keys.push("Meta");
    }
    if (shortcut.shift) {
      keys.push("Shift");
    }
    if (shortcut.alt) {
      keys.push("Alt");
    }
    inputNode.value = [...keys, ...[shortcut.key]].filter(Boolean).join(" + ");
    callback(inputNode.value);
  });
}
