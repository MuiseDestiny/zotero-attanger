import { getPref, setPref } from "./prefs";

/**
 * The primary download folder stays in `sourceDir` so existing profiles and
 * older plugin versions keep working; extra folders are stored separately.
 */
export function parseSourceDirList(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is string =>
            typeof entry === "string" && Boolean(entry.trim()),
        )
      : [];
  } catch {
    return [];
  }
}

function sourceDirKey(path: string) {
  const key = path.replace(/[\\/]+$/, "");
  return Zotero.isWin ? key.toLowerCase() : key;
}

function uniqueSourceDirs(paths: string[]) {
  const seen = new Set<string>();
  return paths.filter((path) => {
    const key = sourceDirKey(path);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getExtraSourceDirs() {
  const primary = getPref("sourceDir");
  const primaryKey = typeof primary === "string" ? sourceDirKey(primary) : "";
  return uniqueSourceDirs(
    parseSourceDirList(getPref("extraSourceDirs")),
  ).filter((path) => sourceDirKey(path) !== primaryKey);
}

export function setExtraSourceDirs(paths: string[]) {
  setPref("extraSourceDirs", JSON.stringify(uniqueSourceDirs(paths)));
}

/** Primary folder first, then extra folders in the order they were added. */
export function getConfiguredSourceDirs() {
  const primary = getPref("sourceDir");
  return uniqueSourceDirs([
    ...(typeof primary === "string" && primary.trim() ? [primary] : []),
    ...getExtraSourceDirs(),
  ]);
}

/** Adds a folder, filling the primary slot first. Returns false for duplicates. */
export function addSourceDir(path: string) {
  const key = sourceDirKey(path);
  if (!key) return false;
  if (getConfiguredSourceDirs().some((dir) => sourceDirKey(dir) === key)) {
    return false;
  }
  const primary = getPref("sourceDir");
  if (typeof primary !== "string" || !primary.trim()) {
    setPref("sourceDir", path);
  } else {
    setExtraSourceDirs([...getExtraSourceDirs(), path]);
  }
  return true;
}

export function removeExtraSourceDir(path: string) {
  const key = sourceDirKey(path);
  setExtraSourceDirs(
    getExtraSourceDirs().filter((dir) => sourceDirKey(dir) !== key),
  );
}
