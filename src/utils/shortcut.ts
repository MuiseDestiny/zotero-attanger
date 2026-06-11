import { getPref } from "./prefs";

/**
 * 快捷键是否启用（设置面板中的勾选框，未勾选表示不启用）
 */
export function isShortcutEnabled(prefKey: string) {
  return getPref(`${prefKey}.enable`) !== false;
}

/**
 * 读取快捷键的显示文本，如 "Ctrl + I"；未设置返回空字符串
 */
export function getShortcutText(prefKey: string) {
  const shortcut = getPref(prefKey);
  return typeof shortcut === "string" ? shortcut.trim() : "";
}

export function registerShortcut(prefKey: string, callback: Function) {
  ztoolkit.Keyboard.register(async (ev, options) => {
    if (!options.keyboard) return;
    if (!isShortcutEnabled(prefKey)) return;
    // 按键时实时读取，修改设置后无需重启即可生效
    const raw = getShortcutText(prefKey);
    if (!raw) return;
    const shortcutString = raw
      .replace(/\s\+\s/g, ",")
      .toLowerCase()
      .replace("ctrl", "control");
    const _shortcutString = shortcutString.slice(0, -1) + shortcutString.slice(-1)[0].toUpperCase()
    if (options.keyboard.equals(shortcutString) || options.keyboard.equals(_shortcutString)) {
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
    let keys: string[] = []
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
