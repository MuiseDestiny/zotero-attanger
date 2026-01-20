import { config } from "../../package.json";

export function registerShortcut(value: string, callback: Function, type: "prefKey" | "key" = "prefKey") {
  let shortcutString = (type == "prefKey" ? Zotero.Prefs.get(`${config.addonRef}.${value}`) as string : value)
    .replace(/\s\+\s/g, ",")
    .toLowerCase()

  shortcutString = shortcutString.replace("ctrl", "control")
  ztoolkit.Keyboard.register(async (ev, options) => {
    const _shortcutString = shortcutString.slice(0, -1) + shortcutString.slice(-1)[0].toUpperCase()
    if (options.keyboard && options.keyboard.equals(shortcutString) || options.keyboard && options.keyboard.equals(_shortcutString)) {
      ztoolkit.log(shortcutString)
      callback();
    }
  })
}


export function listenShortcut(inputNode: HTMLInputElement, callback: (shortcut: string) => void) {
  inputNode.addEventListener("keydown", (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shortcut: any = {}
    shortcut.control = e.ctrlKey;
    shortcut.meta = e.metaKey;
    shortcut.shift = e.shiftKey;
    shortcut.alt = e.altKey;
    if (
      !["Shift", "Meta", "Ctrl", "Alt", "Control"].includes(e.key)
    ) {
      shortcut.key = e.key.toUpperCase();
    }
    let keys = []
    if (shortcut.control) {
      keys.push("Ctrl")
    }
    if (shortcut.meta) {
      keys.push("Meta")
    }
    if (shortcut.shift) {
      keys.push("Shift")
    }
    if (shortcut.alt) {
      keys.push("Alt")
    }
    window.setTimeout(() => {
      inputNode.value = [...keys, ...[shortcut.key]].filter(Boolean).join(" + ")
      ztoolkit.log(keys, shortcut, inputNode.value)
      callback(inputNode.value)
    })
  })
}