import { config } from "../../package.json";

export function registerShortcut(
  prefKey: string,
  callback: () => Promise<void>,
) {
  const shortcutArr = (
    Zotero.Prefs.get(`${config.addonRef}.${prefKey}`) as string
  ).split(" + ");
  const allModifiers = ["Shift", "Meta", "Ctrl", "Alt", "Control"];
  const modifiers = shortcutArr
    .filter((i) => allModifiers.includes(i))
    .map((i) => i.toLowerCase());

  ztoolkit.Shortcut.register("event", {
    id: prefKey.replace(/\./g, "-"),
    modifiers: modifiers.join(",").replace("ctrl", "control"),
    key: shortcutArr.slice(-1)[0].toLowerCase(),
    callback: (e) => {
      callback();
    },
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
