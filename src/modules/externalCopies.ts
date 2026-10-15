import {
  AttachmentCopyOptions,
  AttachmentFileConflict,
  AttachmentOperationCancelled,
  FileFingerprint,
  attachmentFileStat,
  attachmentPathExists,
  copyAttachmentFile,
  discardAttachmentCopy,
  fingerprintFile,
  fingerprintMatches,
  hasAttachmentFileReferences,
  isZoteroStoragePath,
  matchingFileContent,
  moveAttachmentFileNoOverwrite,
  newAttachmentTemporaryPath,
  normalizeAttachmentPath,
  prepareAttachmentCopy,
  publishAttachmentCopy,
  removeVerifiedAttachmentFile,
  sameFiles,
  throwIfAttachmentCancelled,
} from "./attachmentFiles";

const REGISTRY_FILENAME = "attanger-external-copies.json";

/** One mirror per stored attachment: where it was meant to go and what we wrote. */
export type ExternalCopyRecord = {
  libraryID: number;
  key: string;
  desiredPath: string;
  path: string;
  fingerprint: FileFingerprint;
  source: FileFingerprint;
  updatedAt: number;
};

type ExternalCopyRegistry = {
  version: 1;
  copies: Record<string, ExternalCopyRecord>;
};

export type ExternalCopyResult = {
  status:
    | "created"
    | "updated"
    | "moved"
    | "unchanged"
    | "conflict"
    | "cancelled";
  path?: string;
  /** A previous copy deleted after the destination changed. */
  removedPath?: string;
  /** A previous copy kept because it was edited or is used by Zotero. */
  retainedPath?: string;
};

export type ExternalCopyOptions = AttachmentCopyOptions & {
  /** Trust unchanged sizes and times; used by automatic notifications. */
  fastCheck?: boolean;
};

let registry: ExternalCopyRegistry | undefined;

function registryPath() {
  return PathUtils.joinRelative(Zotero.DataDirectory.dir, REGISTRY_FILENAME);
}

function attachmentIdentity(attachment: Zotero.Item) {
  return `${attachment.libraryID}:${attachment.key}`;
}

async function readRegistry(): Promise<ExternalCopyRegistry> {
  if (registry) return registry;
  const path = registryPath();
  if (!(await attachmentPathExists(path, "file"))) {
    registry = { version: 1, copies: {} };
    return registry;
  }
  // A corrupt registry must not turn existing files into deletion candidates.
  const parsed = JSON.parse(String(await IOUtils.readUTF8(path)));
  if (
    parsed?.version !== 1 ||
    !parsed.copies ||
    typeof parsed.copies !== "object" ||
    Array.isArray(parsed.copies)
  ) {
    throw new Error("Unsupported Attanger external copy registry");
  }
  registry = parsed as ExternalCopyRegistry;
  return registry;
}

async function saveRecord(
  attachment: Zotero.Item,
  record?: ExternalCopyRecord,
) {
  const current = await readRegistry();
  const next: ExternalCopyRegistry = {
    version: 1,
    copies: { ...current.copies },
  };
  const identity = attachmentIdentity(attachment);
  if (record) next.copies[identity] = record;
  else delete next.copies[identity];
  const path = registryPath();
  await IOUtils.writeUTF8(path, JSON.stringify(next), {
    tmpPath: `${path}.tmp`,
  });
  registry = next;
}

function makeRecord(
  attachment: Zotero.Item,
  desiredPath: string,
  path: string,
  fingerprint: FileFingerprint,
  source: FileFingerprint,
): ExternalCopyRecord {
  return {
    libraryID: attachment.libraryID,
    key: attachment.key,
    desiredPath,
    path,
    fingerprint,
    source,
    updatedAt: Date.now(),
  };
}

export async function getExternalCopy(attachment: Zotero.Item) {
  if (!attachment?.key) return;
  const record = (await readRegistry()).copies[attachmentIdentity(attachment)];
  return record ? { ...record } : undefined;
}

async function samePath(left: string, right: string) {
  return (
    normalizeAttachmentPath(left) === normalizeAttachmentPath(right) ||
    (await sameFiles(left, right))
  );
}

async function publishNewCopy(
  attachment: Zotero.Item,
  sourcePath: string,
  desiredPath: string,
  options: ExternalCopyOptions,
) {
  const copied = await copyAttachmentFile(sourcePath, desiredPath, options);
  try {
    await saveRecord(
      attachment,
      makeRecord(
        attachment,
        desiredPath,
        copied.path,
        copied.fingerprint,
        copied.sourceFingerprint,
      ),
    );
  } catch (error) {
    // An unregistered copy would be duplicated by the next sync.
    await removeVerifiedAttachmentFile(copied.path, copied.fingerprint);
    throw error;
  }
  return copied.path;
}

/**
 * Adopts a file already at the destination when it has exactly the source's
 * content, e.g. after importing it back from the copy directory. Without this
 * the mirror would write a second "name_1" file next to it.
 */
async function adoptExistingCopy(
  attachment: Zotero.Item,
  sourcePath: string,
  desiredPath: string,
) {
  if (
    isZoteroStoragePath(desiredPath) ||
    !(await attachmentPathExists(desiredPath, "file")) ||
    (await hasAttachmentFileReferences(desiredPath, attachment))
  ) {
    return false;
  }
  const [target, source] = await Promise.all([
    fingerprintFile(desiredPath),
    fingerprintFile(sourcePath),
  ]);
  if (!matchingFileContent(target, source)) return false;
  await saveRecord(
    attachment,
    makeRecord(attachment, desiredPath, desiredPath, target, source),
  );
  return true;
}

/** Deletes an old copy only when its bytes are still exactly what Attanger wrote. */
async function removePreviousCopy(
  attachment: Zotero.Item,
  previous: ExternalCopyRecord,
) {
  if (!(await attachmentPathExists(previous.path, "file"))) return true;
  if (
    isZoteroStoragePath(previous.path) ||
    !(await fingerprintMatches(previous.path, previous.fingerprint)) ||
    (await hasAttachmentFileReferences(previous.path, attachment))
  ) {
    return false;
  }
  return removeVerifiedAttachmentFile(previous.path, previous.fingerprint);
}

async function refreshCopy(
  attachment: Zotero.Item,
  previous: ExternalCopyRecord,
  sourcePath: string,
  options: ExternalCopyOptions,
): Promise<ExternalCopyResult> {
  if (!(await attachmentPathExists(previous.path, "file"))) {
    // The user removed the copy outside Zotero; write it again.
    const path = await publishNewCopy(
      attachment,
      sourcePath,
      previous.desiredPath,
      options,
    );
    return { status: "created", path };
  }
  if (options.fastCheck) {
    const [source, target] = await Promise.all([
      attachmentFileStat(sourcePath),
      attachmentFileStat(previous.path),
    ]);
    if (
      source.size === previous.source.size &&
      source.modified === previous.source.modified &&
      target.size === previous.fingerprint.size &&
      target.modified === previous.fingerprint.modified
    ) {
      return { status: "unchanged", path: previous.path };
    }
  }
  const current = await fingerprintFile(previous.path);
  if (!matchingFileContent(current, previous.fingerprint)) {
    return { status: "conflict", path: previous.path };
  }
  const source = await fingerprintFile(sourcePath);
  if (matchingFileContent(current, source)) {
    if (
      current.modified !== previous.fingerprint.modified ||
      source.modified !== previous.source.modified
    ) {
      await saveRecord(attachment, {
        ...previous,
        fingerprint: current,
        source,
        updatedAt: Date.now(),
      });
    }
    return { status: "unchanged", path: previous.path };
  }
  if (await hasAttachmentFileReferences(previous.path, attachment)) {
    // A Zotero attachment links to the copy, so it is no longer only a mirror.
    return { status: "conflict", path: previous.path };
  }

  const prepared = await prepareAttachmentCopy(
    sourcePath,
    previous.path,
    options,
  );
  const backupPath = await newAttachmentTemporaryPath(previous.path, "bak");
  let backedUp = false;
  let published: { path: string; fingerprint: FileFingerprint } | undefined;
  try {
    throwIfAttachmentCancelled(options);
    await moveAttachmentFileNoOverwrite(previous.path, backupPath);
    backedUp = true;
    if (!(await fingerprintMatches(backupPath, previous.fingerprint))) {
      throw new AttachmentFileConflict(previous.path);
    }
    published = await publishAttachmentCopy(prepared, previous.path, options);
    await saveRecord(attachment, {
      ...previous,
      fingerprint: published.fingerprint,
      source: prepared.sourceFingerprint,
      updatedAt: Date.now(),
    });
    await removeVerifiedAttachmentFile(backupPath, previous.fingerprint);
    return { status: "updated", path: previous.path };
  } catch (error) {
    try {
      if (published) {
        await removeVerifiedAttachmentFile(
          published.path,
          published.fingerprint,
        );
      }
      if (backedUp && !(await attachmentPathExists(previous.path))) {
        await moveAttachmentFileNoOverwrite(backupPath, previous.path);
      }
      await discardAttachmentCopy(prepared);
    } catch (restoreError) {
      ztoolkit.log(
        "External copy rollback failed",
        previous.path,
        restoreError,
      );
    }
    throw error;
  }
}

/**
 * One-way mirror from a stored Zotero attachment to the external directory.
 * The destination follows the current rules; an older copy is removed only if
 * nobody edited it, and a copy edited outside Zotero is never overwritten.
 */
export async function syncExternalCopy(
  attachment: Zotero.Item,
  desiredPath: string,
  options: ExternalCopyOptions = {},
): Promise<ExternalCopyResult> {
  try {
    throwIfAttachmentCancelled(options);
    if (!attachment.isImportedAttachment()) {
      throw new Error("External copies require a stored attachment");
    }
    const sourcePath = (await attachment.getFilePathAsync()) as string;
    if (!sourcePath) throw new Error("Attachment file is unavailable");
    if (
      isZoteroStoragePath(desiredPath) ||
      (await sameFiles(sourcePath, desiredPath))
    ) {
      return { status: "conflict", path: desiredPath };
    }
    const previous = await getExternalCopy(attachment);
    if (previous && (await samePath(previous.desiredPath, desiredPath))) {
      return await refreshCopy(attachment, previous, sourcePath, options);
    }
    const adopted = await adoptExistingCopy(
      attachment,
      sourcePath,
      desiredPath,
    );
    const path = adopted
      ? desiredPath
      : await publishNewCopy(attachment, sourcePath, desiredPath, options);
    if (!previous) return { status: "created", path };
    if (await samePath(previous.path, path)) {
      return { status: "moved", path };
    }
    const removed = await removePreviousCopy(attachment, previous);
    return removed
      ? { status: "moved", path, removedPath: previous.path }
      : { status: "moved", path, retainedPath: previous.path };
  } catch (error) {
    if (error instanceof AttachmentOperationCancelled) {
      return { status: "cancelled" };
    }
    if (error instanceof AttachmentFileConflict) {
      return { status: "conflict", path: error.path };
    }
    throw error;
  }
}
