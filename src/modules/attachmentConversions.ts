import { isZoteroStoragePath, sameFiles } from "./attachmentFiles";

export type AttachmentConversionOptions = {
  shouldCancel?: () => boolean;
  onCreated?: (attachment: Zotero.Item) => void;
};

function attachmentJSON(attachment: Zotero.Item) {
  const json = { ...(attachment.toJSON() as any) };
  delete json.key;
  delete json.version;
  delete json.md5;
  delete json.mtime;
  delete json.deleted;
  return json;
}

async function saveInTransaction(item: Zotero.Item) {
  if (typeof item.save === "function") await item.save();
  else await item.saveTx();
}

/**
 * Replace a stored attachment with a linked one that points at an already
 * verified external file. Annotations (including trashed or external ones),
 * child notes, relations, tags, the attachment note and the full-text index
 * move to the replacement before the stored item and its file are erased.
 */
export async function convertStoredAttachmentToLinked(
  attachment: Zotero.Item,
  targetPath: string,
  options: AttachmentConversionOptions = {},
) {
  if (!attachment.isImportedAttachment()) {
    throw new Error("Attachment is not stored");
  }
  if (isZoteroStoragePath(targetPath)) {
    throw new Error("Linked target must be outside Zotero storage");
  }
  const sourcePath = (await attachment.getFilePathAsync()) as string;
  if (!sourcePath || (await sameFiles(sourcePath, targetPath))) {
    throw new Error("Linked attachment requires an independent target file");
  }
  const json = attachmentJSON(attachment);
  json.linkMode = "linked_file";
  json.path = targetPath;
  delete json.filename;
  const replacement = new Zotero.Item("attachment");
  replacement.libraryID = attachment.libraryID;
  replacement.fromJSON(json);
  await replacement.saveTx();
  options.onCreated?.(replacement);
  try {
    if (options.shouldCancel?.()) throw new Error("Conversion cancelled");
    const children = (
      await Zotero.Items.getAll(attachment.libraryID, false, true)
    ).filter((item) => item.parentItemID === attachment.id);
    await Zotero.DB.executeTransaction(async () => {
      for (const child of children) {
        child.parentItemID = replacement.id;
        await saveInTransaction(child);
      }
      await Zotero.Relations.copyObjectSubjectRelations(
        attachment,
        replacement,
      );
      await Zotero.Fulltext.transferItemIndex(attachment, replacement);
    });
  } catch (error) {
    // Erasing a linked attachment never deletes its external file.
    await replacement.eraseTx();
    throw error;
  }
  await attachment.eraseTx();
  return replacement;
}
