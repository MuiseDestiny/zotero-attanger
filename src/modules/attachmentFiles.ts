export type FileFingerprint = {
  hash: string;
  size: number;
  modified: number;
};

export type AttachmentCopyOptions = {
  shouldCancel?: () => boolean;
};

export type PreparedAttachmentCopy = {
  temporaryPath: string;
  sourcePath: string;
  sourceFingerprint: FileFingerprint;
  fingerprint: FileFingerprint;
};

export class AttachmentOperationCancelled extends Error {
  constructor() {
    super("Attachment operation cancelled");
    this.name = "AttachmentOperationCancelled";
  }
}

export class AttachmentFileConflict extends Error {
  constructor(public path: string) {
    super(`Attachment file already exists or changed: ${path}`);
    this.name = "AttachmentFileConflict";
  }
}

let operationTail: Promise<unknown> = Promise.resolve();
let temporaryCounter = 0;

/** All import, rename, relocation and export entry points share this queue. */
export function runAttachmentOperation<T>(task: () => Promise<T>): Promise<T> {
  const operation = operationTail.then(task, task);
  operationTail = operation.catch(() => undefined);
  return operation;
}

/**
 * Lexical path normalization. PathUtils.normalize() goes through
 * nsIFile::Normalize, which throws NS_ERROR_FILE_NOT_FOUND for paths that do
 * not exist yet (such as a move destination), so it cannot be used here.
 */
function lexicalNormalize(path: string) {
  const windows = Zotero.isWin;
  const separator = windows ? "\\" : "/";
  let value = windows ? path.replace(/\//g, "\\") : path;
  let prefix = "";
  if (windows) {
    const match =
      /^(\\\\[?.]\\[a-z]:\\?|\\\\[^\\]+\\[^\\]+\\?|[a-z]:\\?|\\)/i.exec(value);
    if (match) {
      prefix = match[1].endsWith("\\") ? match[1] : match[1] + "\\";
      value = value.slice(match[1].length);
    }
  } else if (value.startsWith("/")) {
    prefix = "/";
  }
  const parts: string[] = [];
  for (const part of value.split(windows ? /\\+/ : /\/+/)) {
    if (!part || part === ".") continue;
    if (part === ".." && parts.length && parts[parts.length - 1] !== "..") {
      parts.pop();
    } else if (part !== ".." || !prefix) {
      parts.push(part);
    }
  }
  const joined = prefix + parts.join(separator);
  return joined || (prefix ? prefix : ".");
}

export function normalizeAttachmentPath(path: string) {
  let normalized = lexicalNormalize(path);
  if (Zotero.isWin) normalized = normalized.toLowerCase();
  return normalized;
}

function isAbsoluteAttachmentPath(path: string) {
  return /^(\/|[a-z]:[\\/]|\\\\)/i.test(path);
}

function attachmentPathIsInside(path: string, directory: string) {
  const base = normalizeAttachmentPath(directory).replace(/[\\/]+$/, "");
  const normalized = normalizeAttachmentPath(path);
  const separator = Zotero.isWin ? "\\" : "/";
  return normalized === base || normalized.startsWith(base + separator);
}

/** nsIFile type checks throw for missing paths instead of returning false. */
function nsIFileExists(file: nsIFile) {
  try {
    if (file.exists()) return true;
  } catch {
    // Fall through to type checks for mount points that misreport exists().
  }
  for (const check of [() => file.isDirectory(), () => file.isFile()]) {
    try {
      if (check()) return true;
    } catch {
      // Missing path.
    }
  }
  return false;
}

/**
 * Resolve symbolic links (for example ~/Dropbox on macOS) so that a target
 * reached through an alias is still compared with its real location.
 */
function canonicalAttachmentPath(path: string) {
  const suffix: string[] = [];
  let current = lexicalNormalize(path);
  let canonical: string | undefined;
  let inspectedRoot = false;
  for (let depth = 0; depth < 256; depth++) {
    const file = Zotero.File.pathToFile(current);
    const exists = nsIFileExists(file);
    if (exists && canonical === undefined) {
      let symlink = false;
      try {
        symlink = Boolean(file.isSymlink?.());
      } catch {
        symlink = false;
      }
      file.normalize?.();
      let target: string | undefined;
      if (symlink) {
        try {
          target = file.target;
        } catch {
          return;
        }
      }
      canonical = typeof target === "string" && target ? target : file.path;
    } else if (canonical === undefined) {
      suffix.unshift(PathUtils.filename(current));
    }
    const parent = PathUtils.parent(current) as string | null;
    if (!parent || parent === current) {
      inspectedRoot = true;
      break;
    }
    current = parent;
  }
  if (!canonical || !inspectedRoot) return;
  for (const part of suffix)
    canonical = PathUtils.joinRelative(canonical, part);
  return normalizeAttachmentPath(canonical);
}

/** Reject targets that are, or resolve into, Zotero storage. */
export function isZoteroStoragePath(path: string) {
  try {
    if (!isAbsoluteAttachmentPath(path)) return true;
    const storagePath = Zotero.getStorageDirectory().path;
    if (attachmentPathIsInside(path, storagePath)) return true;
    const storage = canonicalAttachmentPath(storagePath);
    const target = canonicalAttachmentPath(path);
    if (!storage || !target) return true;
    return attachmentPathIsInside(target, storage);
  } catch (error) {
    ztoolkit.log("Cannot verify attachment destination aliases", path, error);
    return true;
  }
}

export async function sameFiles(left: string, right: string) {
  if (!left || !right) return false;
  if (normalizeAttachmentPath(left) === normalizeAttachmentPath(right)) {
    return true;
  }
  try {
    const leftFile = Zotero.File.pathToFile(left);
    const rightFile = Zotero.File.pathToFile(right);
    leftFile.normalize?.();
    rightFile.normalize?.();
    return leftFile.equals?.(rightFile) || false;
  } catch {
    return false;
  }
}

export async function attachmentPathExists(
  path: string,
  kind?: "file" | "directory",
) {
  try {
    if (await IOUtils.exists(path)) {
      if (!kind) return true;
      const file = Zotero.File.pathToFile(path);
      return kind === "file" ? file.isFile() : file.isDirectory();
    }
  } catch (error) {
    ztoolkit.log("Attachment path check uses nsIFile fallback", path, error);
  }
  try {
    const file = Zotero.File.pathToFile(path);
    if (kind === "directory") return file.isDirectory();
    if (kind === "file") return file.isFile();
    return nsIFileExists(file);
  } catch {
    return false;
  }
}

export async function attachmentFileStat(path: string) {
  try {
    const stat = await IOUtils.stat(path);
    if (stat.type !== "regular") throw new Error(`Not a file: ${path}`);
    return { size: stat.size, modified: stat.lastModified };
  } catch (error) {
    const file = Zotero.File.pathToFile(path);
    if (!file.isFile()) throw error;
    const size = Number(file.fileSize);
    const modified = Number(file.lastModifiedTime);
    if (!Number.isFinite(size) || !Number.isFinite(modified)) throw error;
    return { size, modified };
  }
}

export async function fingerprintFile(path: string): Promise<FileFingerprint> {
  const before = await attachmentFileStat(path);
  const utilities = Zotero.Utilities.Internal;
  const hash = utilities.md5Async
    ? await utilities.md5Async(Zotero.File.pathToFile(path))
    : utilities.md5(Zotero.File.pathToFile(path));
  const after = await attachmentFileStat(path);
  if (before.size !== after.size || before.modified !== after.modified) {
    throw new AttachmentFileConflict(path);
  }
  return { hash, ...after };
}

export function matchingFileContent(
  left: FileFingerprint,
  right: FileFingerprint,
) {
  return left.hash === right.hash && left.size === right.size;
}

export async function fingerprintMatches(
  path: string,
  expected: FileFingerprint,
) {
  if (!(await attachmentPathExists(path, "file"))) return false;
  return matchingFileContent(await fingerprintFile(path), expected);
}

export async function ensureDirectoryForFile(path: string) {
  const pending: string[] = [];
  let directory = PathUtils.parent(path) as string | null;
  while (directory && !(await attachmentPathExists(directory, "directory"))) {
    if (await attachmentPathExists(directory)) {
      throw new AttachmentFileConflict(directory);
    }
    pending.push(directory);
    const parent = PathUtils.parent(directory) as string | null;
    if (parent === directory) break;
    directory = parent;
  }
  for (const missing of pending.reverse()) {
    await Zotero.File.createDirectoryIfMissingAsync(missing);
  }
}

export function throwIfAttachmentCancelled(options: AttachmentCopyOptions) {
  if (options.shouldCancel?.()) throw new AttachmentOperationCancelled();
}

export async function newAttachmentTemporaryPath(
  targetPath: string,
  suffix = "tmp",
) {
  const directory = PathUtils.parent(targetPath) as string;
  for (let attempt = 0; attempt < 100; attempt++) {
    const token = `${Date.now().toString(36)}-${++temporaryCounter}-${Math.random()
      .toString(36)
      .slice(2)}`;
    const path = PathUtils.joinRelative(
      directory,
      `.attanger-${token}.${suffix}`,
    );
    if (!(await attachmentPathExists(path))) return path;
  }
  throw new Error("Cannot allocate an attachment temporary file");
}

async function copyToTemporaryFile(sourcePath: string, temporaryPath: string) {
  if (await attachmentPathExists(temporaryPath)) {
    throw new AttachmentFileConflict(temporaryPath);
  }
  try {
    await IOUtils.copy(sourcePath, temporaryPath, { noOverwrite: true });
  } catch (error) {
    // Never retry a failed copy over a partial or concurrently-created file.
    if (await attachmentPathExists(temporaryPath)) throw error;
    ztoolkit.log("Attachment copy uses nsIFile fallback", sourcePath, error);
    const sourceFile = Zotero.File.pathToFile(sourcePath);
    const temporaryFile = Zotero.File.pathToFile(temporaryPath);
    sourceFile.copyTo(temporaryFile.parent, temporaryFile.leafName);
  }
}

export async function removeAttachmentFile(path: string) {
  try {
    await IOUtils.remove(path, { ignoreAbsent: true });
  } catch (error) {
    const file = Zotero.File.pathToFile(path);
    if (!file.exists()) return;
    if (!file.isFile()) throw error;
    file.remove(false);
  }
}

export async function removeVerifiedAttachmentFile(
  path: string,
  expected: FileFingerprint,
) {
  if (!(await fingerprintMatches(path, expected))) return false;
  await removeAttachmentFile(path);
  return true;
}

export async function prepareAttachmentCopy(
  sourcePath: string,
  targetPath: string,
  options: AttachmentCopyOptions = {},
): Promise<PreparedAttachmentCopy> {
  throwIfAttachmentCancelled(options);
  await ensureDirectoryForFile(targetPath);
  const sourceFingerprint = await fingerprintFile(sourcePath);
  const temporaryPath = await newAttachmentTemporaryPath(targetPath);
  let copied = false;
  try {
    await copyToTemporaryFile(sourcePath, temporaryPath);
    copied = true;
    throwIfAttachmentCancelled(options);
    const fingerprint = await fingerprintFile(temporaryPath);
    const currentSource = await fingerprintFile(sourcePath);
    if (
      !matchingFileContent(sourceFingerprint, fingerprint) ||
      !matchingFileContent(sourceFingerprint, currentSource) ||
      sourceFingerprint.modified !== currentSource.modified
    ) {
      throw new AttachmentFileConflict(sourcePath);
    }
    return { temporaryPath, sourcePath, sourceFingerprint, fingerprint };
  } catch (error) {
    if (copied) {
      try {
        await removeVerifiedAttachmentFile(temporaryPath, sourceFingerprint);
      } catch (cleanupError) {
        ztoolkit.log(
          "Failed to remove attachment temporary file",
          cleanupError,
        );
      }
    }
    throw error;
  }
}

/** nsIFile.moveTo overwrites destinations, so it is not a publication fallback. */
export async function moveAttachmentFileNoOverwrite(
  sourcePath: string,
  targetPath: string,
) {
  if (await attachmentPathExists(targetPath)) {
    throw new AttachmentFileConflict(targetPath);
  }
  try {
    await IOUtils.move(sourcePath, targetPath, { noOverwrite: true });
  } catch (error) {
    if (await attachmentPathExists(targetPath)) {
      throw new AttachmentFileConflict(targetPath);
    }
    const legacyFile = typeof OS !== "undefined" ? (OS.File as any) : undefined;
    if (!legacyFile?.move) throw error;
    await legacyFile.move(sourcePath, targetPath, { noOverwrite: true });
  }
}

export function suffixedAttachmentPath(path: string, suffix: number) {
  if (!suffix) return path;
  const filename = PathUtils.filename(path);
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : "";
  return PathUtils.joinRelative(
    PathUtils.parent(path) as string,
    `${stem}_${suffix}${extension}`,
  );
}

export async function publishAttachmentCopy(
  prepared: PreparedAttachmentCopy,
  targetPath: string,
  options: AttachmentCopyOptions & {
    unique?: boolean;
    beforePublish?: (path: string) => Promise<void>;
  } = {},
) {
  for (let suffix = 0; suffix < 10_000; suffix++) {
    throwIfAttachmentCancelled(options);
    const path = suffixedAttachmentPath(targetPath, suffix);
    if (await attachmentPathExists(path)) {
      if (options.unique) continue;
      throw new AttachmentFileConflict(path);
    }
    await options.beforePublish?.(path);
    try {
      await moveAttachmentFileNoOverwrite(prepared.temporaryPath, path);
    } catch (error) {
      if (
        options.unique &&
        (await attachmentPathExists(prepared.temporaryPath, "file")) &&
        (await attachmentPathExists(path))
      ) {
        continue;
      }
      throw error;
    }
    if (!(await fingerprintMatches(path, prepared.fingerprint))) {
      throw new AttachmentFileConflict(path);
    }
    return { path, fingerprint: await fingerprintFile(path) };
  }
  throw new Error("Cannot allocate a unique attachment filename");
}

export async function discardAttachmentCopy(prepared: PreparedAttachmentCopy) {
  await removeVerifiedAttachmentFile(
    prepared.temporaryPath,
    prepared.fingerprint,
  );
}

export async function copyAttachmentFile(
  sourcePath: string,
  targetPath: string,
  options: AttachmentCopyOptions = {},
) {
  const prepared = await prepareAttachmentCopy(sourcePath, targetPath, options);
  try {
    const copied = await publishAttachmentCopy(prepared, targetPath, {
      ...options,
      unique: true,
    });
    if (options.shouldCancel?.()) {
      await removeVerifiedAttachmentFile(copied.path, copied.fingerprint);
      throw new AttachmentOperationCancelled();
    }
    return { ...copied, sourceFingerprint: prepared.sourceFingerprint };
  } finally {
    await discardAttachmentCopy(prepared);
  }
}

/**
 * Attachment rows whose stored path ends with the same filename. Paths are
 * kept as absolute, "attachments:" or "storage:" strings, all ending in the
 * filename, so this narrows the candidates without loading every item.
 */
async function candidateAttachmentIDs(path: string) {
  const db = Zotero.DB as unknown as {
    columnQueryAsync?: (sql: string, params: unknown[]) => Promise<unknown[]>;
  };
  if (typeof db?.columnQueryAsync !== "function") return;
  const filename = PathUtils.filename(path).replace(/[\\%_]/g, "\\$&");
  const ids = await db.columnQueryAsync(
    "SELECT itemID FROM itemAttachments WHERE path LIKE ? ESCAPE '\\'",
    [`%${filename}`],
  );
  return ids.map((id) => Number(id)).filter((id) => Number.isInteger(id));
}

/** Includes trashed items: restoring them must not expose a missing file. */
export async function hasAttachmentFileReferences(
  path: string,
  attachment?: Zotero.Item,
  { ignoreItemID }: { ignoreItemID?: number } = {},
) {
  const isReference = async (item?: Zotero.Item) => {
    if (!item || item.id === ignoreItemID || !item.isAttachment()) {
      return false;
    }
    const referencedPath = await item.getFilePathAsync();
    return Boolean(referencedPath && (await sameFiles(path, referencedPath)));
  };
  try {
    const ids = await candidateAttachmentIDs(path);
    if (ids) {
      for (const id of ids) {
        if (await isReference(await Zotero.Items.getAsync(id))) return true;
      }
      return false;
    }
  } catch (error) {
    ztoolkit.log("Indexed attachment reference lookup failed", path, error);
  }
  const libraries = new Set<number>();
  if (attachment?.libraryID) libraries.add(attachment.libraryID);
  if (Zotero.Libraries?.getAll) {
    for (const library of Zotero.Libraries.getAll()) {
      libraries.add(library.libraryID);
    }
  }
  if (!libraries.size || !Zotero.Items.getAll) return true;
  try {
    for (const libraryID of libraries) {
      const items = await Zotero.Items.getAll(libraryID, false, true);
      for (const item of items) {
        if (await isReference(item)) return true;
      }
    }
    return false;
  } catch (error) {
    ztoolkit.log("Cannot verify attachment file references", path, error);
    return true;
  }
}
