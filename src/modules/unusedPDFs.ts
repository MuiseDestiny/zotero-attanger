import { getPref } from "../utils/prefs";
import { getWorkMode } from "../utils/workMode";
import { windowsTrashScript } from "./windowsTrash";
import {
  fingerprintFile,
  isZoteroStoragePath,
  normalizeAttachmentPath,
  runAttachmentOperation,
  type FileFingerprint,
} from "./attachmentFiles";

export type UnusedPDF = {
  path: string;
  relativePath: string;
  fingerprint: FileFingerprint;
};

export type UnusedPDFScan = {
  root: string;
  files: UnusedPDF[];
  skipped: number;
  foreignReferences: number;
};

type AttachmentReferences = {
  paths: Set<string>;
  foreignNames: Set<string>;
  foreignCount: number;
};

/** Classify before calling native APIs: nsIFile rejects other OS path formats. */
function isForeignAbsolutePath(path: string) {
  const windowsPath = /^(?:[a-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/i.test(
    path,
  );
  const unixPath = path.startsWith("/") && !path.startsWith("//");
  return Zotero.isWin ? unixPath : windowsPath;
}

function filenameKey(path: string) {
  // Do not use PathUtils.filename(): this path may use another OS's separators.
  return path.split(/[\\/]/).pop()!.normalize("NFC").toLowerCase();
}

function lexicalKey(path: string) {
  const key = normalizeAttachmentPath(path);
  // On case-sensitive macOS volumes this deliberately overprotects files.
  return Zotero.isMac ? key.toLowerCase() : key;
}

function pathKey(path: string) {
  const file = Zotero.File.pathToFile(path);
  file.normalize();
  const parts: string[] = [];
  let current = file.path;
  for (let depth = 0; depth < 256; depth++) {
    const ancestor = Zotero.File.pathToFile(current);
    if (ancestor.isSymlink()) {
      const target = ancestor.target;
      if (!target || target === current)
        throw new Error("Unresolved symbolic link");
      current = target;
      continue;
    }
    const parent = PathUtils.parent(current) as string | null;
    if (!parent || parent === current) {
      return lexicalKey(
        parts.length
          ? PathUtils.joinRelative(
              current,
              parts.reverse().join(Zotero.isWin ? "\\" : "/"),
            )
          : current,
      );
    }
    parts.push(PathUtils.filename(current));
    current = parent;
  }
  throw new Error("Cannot resolve attachment path");
}

function hasSymlink(path: string) {
  let current: string | null = path;
  while (current) {
    if (Zotero.File.pathToFile(current).isSymlink()) return true;
    const parent = PathUtils.parent(current) as string | null;
    if (!parent || parent === current) break;
    current = parent;
  }
  return false;
}

function validateRoot(root: string) {
  const directory = Zotero.File.pathToFile(root);
  const parent = PathUtils.parent(root);
  if (
    !root ||
    !directory.isDirectory() ||
    !directory.isWritable() ||
    hasSymlink(root) ||
    isZoteroStoragePath(root) ||
    !parent ||
    parent === root
  ) {
    throw new Error("Unsafe PDF cleanup directory");
  }
  return pathKey(root);
}

function isInside(path: string, rootKey: string) {
  const separator = Zotero.isWin ? "\\" : "/";
  return pathKey(path).startsWith(rootKey.replace(/[\\/]+$/, "") + separator);
}

/** A failed or unresolved reference aborts cleanup, never means 'unused'. */
async function collectReferences() {
  const references: AttachmentReferences = {
    paths: new Set(),
    foreignNames: new Set(),
    foreignCount: 0,
  };
  const protectForeignPath = (path: string) => {
    const name = filenameKey(path);
    if (!name || name === "." || name === "..") {
      throw new Error("Cannot resolve foreign attachment filename");
    }
    // No guessed drive/base-directory mapping: retain every same-named file.
    references.foreignNames.add(name);
    references.foreignCount++;
  };
  const libraries = Zotero.Libraries.getAll();
  if (!libraries.length) throw new Error("Cannot enumerate Zotero libraries");
  for (const library of libraries) {
    const items = await Zotero.Items.getAll(library.libraryID, false, true);
    for (const item of items) {
      if (!item.isFileAttachment()) continue;
      const rawPath = item.attachmentPath;
      if (
        item.attachmentLinkMode === Zotero.Attachments.LINK_MODE_LINKED_FILE &&
        typeof rawPath === "string" &&
        isForeignAbsolutePath(rawPath)
      ) {
        protectForeignPath(rawPath);
        continue;
      }
      // Unlike getFilePathAsync(), getFilePath() does not require file existence.
      const path = item.getFilePath();
      if (!path) throw new Error("Cannot resolve attachment path");
      if (isForeignAbsolutePath(path)) {
        protectForeignPath(path);
        continue;
      }
      const file = Zotero.File.pathToFile(path);
      // Missing files cannot be scan candidates, but retain their lexical path.
      references.paths.add(lexicalKey(path));
      if (file.exists()) references.paths.add(pathKey(path));
    }
  }
  return references;
}

function isReferenced(path: string, references: AttachmentReferences) {
  return (
    references.foreignNames.has(filenameKey(path)) ||
    references.paths.has(lexicalKey(path)) ||
    references.paths.has(pathKey(path))
  );
}

export async function scanUnusedPDFs(
  root: string,
  isActive = () => true,
): Promise<UnusedPDFScan> {
  const rootKey = validateRoot(root);
  const references = await collectReferences();
  const scan: UnusedPDFScan = {
    root,
    files: [],
    skipped: 0,
    foreignReferences: references.foreignCount,
  };
  const pending = [root];
  let visited = 0;
  while (pending.length) {
    if (!isActive()) throw new Error("PDF scan cancelled");
    const directory = pending.pop()!;
    if (
      hasSymlink(directory) ||
      (directory !== root && !isInside(directory, rootKey))
    ) {
      scan.skipped++;
      continue;
    }
    // Directory read failures abort the scan instead of presenting partial results.
    const entries = Zotero.File.pathToFile(directory).directoryEntries;
    while (entries.hasMoreElements()) {
      if (++visited % 100 === 0) await Zotero.Promise.delay(0);
      if (!isActive()) throw new Error("PDF scan cancelled");
      const file = entries
        .getNext()
        .QueryInterface(Components.interfaces.nsIFile);
      if (file.isSymlink() || file.isHidden()) {
        scan.skipped++;
        continue;
      }
      if (file.isDirectory()) {
        if (!isZoteroStoragePath(file.path)) pending.push(file.path);
        else scan.skipped++;
      } else if (file.isFile() && /\.pdf$/i.test(file.leafName)) {
        if (!isInside(file.path, rootKey) || isZoteroStoragePath(file.path)) {
          scan.skipped++;
          continue;
        }
        if (!isReferenced(file.path, references)) {
          scan.files.push({
            path: file.path,
            relativePath: file.path.slice(
              root.replace(/[\\/]+$/, "").length + 1,
            ),
            fingerprint: await fingerprintFile(file.path),
          });
        }
      }
    }
  }
  scan.files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  return scan;
}

/** Native recycling only: there is intentionally no permanent-delete fallback. */
export async function movePDFToTrash(path: string) {
  let command: string;
  let args: string[];
  if (Zotero.isMac) {
    command = "/usr/bin/osascript";
    args = [
      "-l",
      "JavaScript",
      "-e",
      'ObjC.import("Foundation"); function run(argv) { if (!$.NSFileManager.defaultManager.trashItemAtURLResultingItemURLError($.NSURL.fileURLWithPath($(argv[0])), null, null)) throw new Error("Cannot move file to Trash"); }',
      path,
    ];
  } else if (Zotero.isWin) {
    const system = Services.dirsvc.get(
      "SysD",
      Components.interfaces.nsIFile,
    ) as nsIFile;
    command = PathUtils.joinRelative(
      system.path,
      "WindowsPowerShell\\v1.0\\powershell.exe",
    );
    // Literal quoting, not shell interpolation; never invoke cmd.exe.
    const literal = path.replace(/'/g, "''");
    args = [
      "-NoProfile",
      "-NonInteractive",
      "-STA",
      "-Command",
      `$ErrorActionPreference='Stop'\nAdd-Type -TypeDefinition @'\n${windowsTrashScript}\n'@\n[AttangerTrash]::Recycle('${literal}')`,
    ];
  } else {
    command =
      ["/usr/bin/gio", "/bin/gio"].find((candidate) =>
        Zotero.File.pathToFile(candidate).exists(),
      ) || "";
    if (!command) throw new Error("System Trash is unavailable");
    args = ["trash", "--", path];
  }
  const result = await Zotero.Utilities.Internal.exec(command, args);
  if (result !== true || (await IOUtils.exists(path))) {
    throw new Error("File was not moved to system Trash");
  }
}

export async function trashUnusedPDFs(
  scan: UnusedPDFScan,
  selected: UnusedPDF[],
  isActive = () => true,
) {
  return runAttachmentOperation(async () => {
    const result = { moved: 0, skipped: 0, failed: 0 };
    const rootKey = validateRoot(scan.root);
    for (const candidate of new Set(selected)) {
      if (
        !isActive() ||
        getWorkMode() !== "linked" ||
        getPref("destDir") !== scan.root
      )
        break;
      try {
        if (
          !scan.files.includes(candidate) ||
          hasSymlink(candidate.path) ||
          !isInside(candidate.path, rootKey) ||
          isZoteroStoragePath(candidate.path)
        ) {
          result.skipped++;
          continue;
        }
        const fingerprint = await fingerprintFile(candidate.path);
        if (
          Object.keys(fingerprint).some(
            (key) =>
              fingerprint[key as keyof FileFingerprint] !==
              candidate.fingerprint[key as keyof FileFingerprint],
          )
        ) {
          result.skipped++;
          continue;
        }
        // Recheck every library after preview, including trashed attachments.
        const references = await collectReferences();
        if (isReferenced(candidate.path, references)) {
          result.skipped++;
          continue;
        }
        if (
          !isActive() ||
          getWorkMode() !== "linked" ||
          getPref("destDir") !== scan.root
        )
          break;
        validateRoot(scan.root);
        if (hasSymlink(candidate.path) || !isInside(candidate.path, rootKey))
          throw new Error("Path changed during cleanup");
        const finalFingerprint = await fingerprintFile(candidate.path);
        if (
          finalFingerprint.hash !== fingerprint.hash ||
          finalFingerprint.size !== fingerprint.size ||
          finalFingerprint.modified !== fingerprint.modified
        ) {
          result.skipped++;
          continue;
        }
        if (
          !isActive() ||
          getWorkMode() !== "linked" ||
          getPref("destDir") !== scan.root
        )
          break;
        if (hasSymlink(candidate.path) || !isInside(candidate.path, rootKey)) {
          result.skipped++;
          continue;
        }
        await movePDFToTrash(candidate.path);
        result.moved++;
      } catch (error) {
        result.failed++;
        ztoolkit.log(
          "Unused PDF retained or recycling failed",
          candidate.path,
          error,
        );
      }
    }
    return result;
  });
}
