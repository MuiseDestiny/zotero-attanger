import { KeyModifier } from "zotero-plugin-toolkit/dist/managers/keyboard";
import { config } from "../../package.json";

export function registerShortcut(
  prefKey: string,
  callback: () => Promise<void>,
) {
  let shortcutString = (
    Zotero.Prefs.get(`${config.addonRef}.${prefKey}`) as string
  )
    .replace(/\s\+\s/g, ",")
    .toLowerCase();

  shortcutString = shortcutString.replace("ctrl", "control");
  ztoolkit.Keyboard.register(async (ev, options) => {
    const _shortcutString =
      shortcutString.slice(0, -1) + shortcutString.slice(-1)[0].toUpperCase();
    if (
      (options.keyboard && options.keyboard.equals(shortcutString)) ||
      (options.keyboard && options.keyboard.equals(_shortcutString))
    ) {
      ztoolkit.log(shortcutString);
      callback();
    }
  });
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
