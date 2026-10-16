import {
  attachmentFileStat,
  FileFingerprint,
  fingerprintFile,
  matchingFileContent,
  normalizeAttachmentPath,
} from "./attachmentFiles";
import { getPDFPrimaryDOIs } from "./attachmentMatching";

export type AttachmentFingerprintCache = Map<
  string,
  Promise<FileFingerprint | undefined>
>;

export function createAttachmentFingerprintCache(): AttachmentFingerprintCache {
  return new Map();
}

type PDFReader = (path: string) => Promise<unknown>;

export type PDFContentIdentity = {
  doi: string;
  totalPages: number;
  signature: string;
};

export type PDFVisualIdentity = {
  totalPages: number;
  pageHashes: string[];
};

type PDFVisualReader = (path: string, totalPages: number) => Promise<unknown>;

type PDFIdentityEntry = {
  fingerprint: FileFingerprint;
  identity: Promise<PDFContentIdentity | undefined>;
  fulltext?: Promise<string | undefined>;
  visuals?: Promise<PDFVisualIdentity | undefined>;
};

export type PDFIdentityCache = {
  readData: PDFReader;
  readFulltext: PDFReader;
  readVisuals?: PDFVisualReader;
  entries: Map<string, PDFIdentityEntry>;
};

const MAX_IDENTITY_FILE_SIZE = 64 * 1024 * 1024;
const MAX_IDENTITY_PAGES = 500;
export const MAX_PDF_VISUAL_PAGES = 100;
const MAX_IDENTITY_TEXT_LENGTH = 5_000_000;
const MAX_LAYOUT_WORDS = 50_000;

/** Native readers retain their own worker deadline and compatibility handling. */
export function createPDFIdentityCache(
  readData: PDFReader,
  readFulltext: PDFReader,
  readVisuals?: PDFVisualReader,
): PDFIdentityCache {
  return { readData, readFulltext, readVisuals, entries: new Map() };
}

function normalizedPDFText(text: string) {
  return text.normalize("NFC").replace(/[\s\u00ad]+/g, "");
}

function recognizerIdentity(data: any): PDFContentIdentity | undefined {
  const dois = getPDFPrimaryDOIs(data);
  const totalPages = data?.totalPages;
  if (
    dois.length !== 1 ||
    !Number.isInteger(totalPages) ||
    totalPages < 1 ||
    totalPages > MAX_IDENTITY_PAGES ||
    !Array.isArray(data.pages) ||
    data.pages.length !== Math.min(5, totalPages)
  ) {
    return;
  }
  let wordCount = 0;
  let textLength = 0;
  const pages: unknown[] = [];
  for (const page of data.pages) {
    if (
      !Array.isArray(page) ||
      !Number.isFinite(page[0]) ||
      !Number.isFinite(page[1]) ||
      page[0] <= 0 ||
      page[1] <= 0
    ) {
      return;
    }
    const words: unknown[] = [];
    let visited = 0;
    const visit = (node: unknown, depth: number) => {
      if (depth > 12 || ++visited > 100_000) {
        throw new Error("PDF layout exceeds identity limits");
      }
      if (!Array.isArray(node)) return;
      const text = node[node.length - 1];
      if (
        node.length >= 7 &&
        typeof text === "string" &&
        node.slice(0, 5).every((value) => Number.isFinite(value)) &&
        node[4] > 0
      ) {
        const normalized = normalizedPDFText(text);
        if (!normalized) return;
        if (
          ++wordCount > MAX_LAYOUT_WORDS ||
          textLength > MAX_IDENTITY_TEXT_LENGTH
        ) {
          throw new Error("PDF text exceeds identity limits");
        }
        textLength += normalized.length;
        // Font resource indices can change on re-encoding; geometry and style cannot.
        words.push([
          normalized,
          ...node.slice(0, 5),
          ...node.slice(6, Math.min(12, node.length - 1)),
        ]);
        return;
      }
      for (const child of node) visit(child, depth + 1);
    };
    visit(page[2], 0);
    if (!words.length) return;
    pages.push([page[0], page[1], words]);
  }
  if (textLength < 200) return;
  const signature = JSON.stringify(pages);
  if (signature.length > MAX_IDENTITY_TEXT_LENGTH) return;
  return { doi: dois[0], totalPages, signature };
}

async function matchesExpectedFingerprint(
  path: string,
  expected: FileFingerprint,
  cache: AttachmentFingerprintCache,
) {
  const current = await fingerprintForMatching(path, cache);
  return Boolean(
    current &&
      matchingFileContent(current, expected) &&
      sameFileStat(current, expected),
  );
}

/** Read only the DOI and opening-page identity; whole text remains lazy. */
export async function pdfIdentityForMatching(
  path: string,
  fingerprints: AttachmentFingerprintCache,
  cache: PDFIdentityCache,
): Promise<PDFContentIdentity | undefined> {
  const fingerprint = await fingerprintForMatching(path, fingerprints);
  if (!fingerprint || fingerprint.size > MAX_IDENTITY_FILE_SIZE) return;
  const key = normalizeAttachmentPath(path);
  let entry = cache.entries.get(key);
  if (
    !entry ||
    !matchingFileContent(entry.fingerprint, fingerprint) ||
    !sameFileStat(entry.fingerprint, fingerprint)
  ) {
    entry = {
      fingerprint,
      identity: (async () => {
        try {
          const identity = recognizerIdentity(await cache.readData(path));
          if (
            identity &&
            (await matchesExpectedFingerprint(path, fingerprint, fingerprints))
          ) {
            return identity;
          }
        } catch (error) {
          ztoolkit.log("Cannot read PDF content identity", path, error);
        }
        return undefined;
      })(),
    };
    cache.entries.set(key, entry);
  }
  const identity = await entry.identity;
  if (
    identity &&
    (await matchesExpectedFingerprint(path, entry.fingerprint, fingerprints))
  ) {
    return identity;
  }
  return undefined;
}

async function wholePDFText(
  path: string,
  identity: PDFContentIdentity,
  fingerprints: AttachmentFingerprintCache,
  cache: PDFIdentityCache,
) {
  const entry = cache.entries.get(normalizeAttachmentPath(path));
  if (!entry) return;
  if (!entry.fulltext) {
    entry.fulltext = (async () => {
      try {
        const result: any = await cache.readFulltext(path);
        if (
          result?.totalPages !== identity.totalPages ||
          result.extractedPages !== identity.totalPages ||
          typeof result.text !== "string" ||
          result.text.length > MAX_IDENTITY_TEXT_LENGTH
        ) {
          return;
        }
        // Preserve page boundaries, punctuation, case, and every scientific digit.
        const pages: string[] = result.text.split("\f").map(normalizedPDFText);
        if (
          pages.length !== identity.totalPages ||
          pages.some((page) => page.length < 20) ||
          pages.reduce((length, page) => length + page.length, 0) < 1000
        ) {
          return;
        }
        if (
          await matchesExpectedFingerprint(
            path,
            entry.fingerprint,
            fingerprints,
          )
        ) {
          return JSON.stringify(pages);
        }
      } catch (error) {
        ztoolkit.log("Cannot read whole PDF content identity", path, error);
      }
      return undefined;
    })();
  }
  return entry.fulltext;
}

async function wholePDFVisuals(
  path: string,
  identity: PDFContentIdentity,
  fingerprints: AttachmentFingerprintCache,
  cache: PDFIdentityCache,
) {
  const entry = cache.entries.get(normalizeAttachmentPath(path));
  if (
    !entry ||
    !cache.readVisuals ||
    identity.totalPages > MAX_PDF_VISUAL_PAGES
  ) {
    return;
  }
  if (!entry.visuals) {
    const readVisuals = cache.readVisuals;
    entry.visuals = (async () => {
      try {
        const result: any = await readVisuals(path, identity.totalPages);
        if (
          result?.totalPages !== identity.totalPages ||
          !Array.isArray(result.pageHashes) ||
          result.pageHashes.length !== identity.totalPages ||
          !Array.from(result.pageHashes).every(
            (hash: unknown) =>
              typeof hash === "string" && /^[a-f\d]{64}$/i.test(hash),
          )
        ) {
          return;
        }
        if (
          await matchesExpectedFingerprint(
            path,
            entry.fingerprint,
            fingerprints,
          )
        ) {
          return {
            totalPages: result.totalPages,
            pageHashes: result.pageHashes.map((hash: string) =>
              hash.toLowerCase(),
            ),
          };
        }
      } catch (error) {
        ztoolkit.log("Cannot read whole PDF visual identity", path, error);
      }
      return undefined;
    })();
  }
  return entry.visuals;
}

/** Re-encoded copies require matching DOI, layout, complete text and every page's visuals. */
export async function samePDFContent(
  leftPath: string,
  rightPath: string,
  fingerprints: AttachmentFingerprintCache,
  cache?: PDFIdentityCache,
): Promise<boolean> {
  const left = await fingerprintForMatching(leftPath, fingerprints);
  const right = await fingerprintForMatching(rightPath, fingerprints);
  if (!left || !right) return false;
  let same = matchingFileContent(left, right);
  if (!same && cache) {
    // This is a conservative re-encoding check, not version or DOI deduplication.
    if (
      !cache.readVisuals ||
      Math.abs(left.size - right.size) > Math.max(left.size, right.size) * 0.01
    ) {
      return false;
    }
    const leftIdentity = await pdfIdentityForMatching(
      leftPath,
      fingerprints,
      cache,
    );
    const rightIdentity = await pdfIdentityForMatching(
      rightPath,
      fingerprints,
      cache,
    );
    if (
      !leftIdentity ||
      !rightIdentity ||
      leftIdentity.doi !== rightIdentity.doi ||
      leftIdentity.totalPages !== rightIdentity.totalPages ||
      leftIdentity.totalPages > MAX_PDF_VISUAL_PAGES ||
      leftIdentity.signature !== rightIdentity.signature
    ) {
      return false;
    }
    const leftText = await wholePDFText(
      leftPath,
      leftIdentity,
      fingerprints,
      cache,
    );
    const rightText = await wholePDFText(
      rightPath,
      rightIdentity,
      fingerprints,
      cache,
    );
    if (leftText === undefined || leftText !== rightText) return false;
    const leftVisuals = await wholePDFVisuals(
      leftPath,
      leftIdentity,
      fingerprints,
      cache,
    );
    const rightVisuals = await wholePDFVisuals(
      rightPath,
      rightIdentity,
      fingerprints,
      cache,
    );
    same = Boolean(
      leftVisuals &&
        rightVisuals &&
        leftVisuals.pageHashes.every(
          (hash, index) => hash === rightVisuals.pageHashes[index],
        ),
    );
  }
  return Boolean(
    same &&
      (await matchesExpectedFingerprint(leftPath, left, fingerprints)) &&
      (await matchesExpectedFingerprint(rightPath, right, fingerprints)),
  );
}

function sameFileStat(
  left: { size: number; modified: number },
  right: { size: number; modified: number },
) {
  return left.size === right.size && left.modified === right.modified;
}

/** Keep this cache scoped to a command, and revalidate files before reuse. */
export async function fingerprintForMatching(
  path: string,
  cache: AttachmentFingerprintCache,
): Promise<FileFingerprint | undefined> {
  const key = normalizeAttachmentPath(path);
  const pending = cache.get(key);
  if (pending) {
    const fingerprint = await pending;
    try {
      if (
        fingerprint &&
        sameFileStat(fingerprint, await attachmentFileStat(path))
      ) {
        return fingerprint;
      }
    } catch (error) {
      ztoolkit.log("Cannot revalidate PDF fingerprint", path, error);
      if (cache.get(key) === pending) cache.delete(key);
      return;
    }
    if (cache.get(key) === pending) cache.delete(key);
    if (!fingerprint) return;
    return fingerprintForMatching(path, cache);
  }

  const operation = (async () => {
    try {
      const fingerprint = await fingerprintFile(path);
      // An unavailable or malformed digest must never make two files equal.
      if (
        !/^[a-f\d]{32}$/i.test(fingerprint.hash) ||
        !Number.isFinite(fingerprint.size) ||
        !Number.isFinite(fingerprint.modified) ||
        !sameFileStat(fingerprint, await attachmentFileStat(path))
      ) {
        throw new Error("Cannot obtain a stable PDF fingerprint");
      }
      return { ...fingerprint, hash: fingerprint.hash.toLowerCase() };
    } catch (error) {
      ztoolkit.log(
        "Cannot fingerprint PDF for duplicate detection",
        path,
        error,
      );
      return undefined;
    }
  })();
  cache.set(key, operation);
  const fingerprint = await operation;
  if (!fingerprint && cache.get(key) === operation) cache.delete(key);
  return fingerprint;
}

/** Compare local PDFs by bytes, optionally checking strong re-encoding evidence. */
export async function findDuplicatePDFAttachment(
  parent: Zotero.Item,
  sourcePath: string,
  cache: AttachmentFingerprintCache = createAttachmentFingerprintCache(),
  identityCache?: PDFIdentityCache,
): Promise<Zotero.Item | undefined> {
  if (
    parent.deleted ||
    !parent.isRegularItem() ||
    !/\.pdf$/i.test(sourcePath)
  ) {
    return;
  }
  let attachmentIDs: number[];
  try {
    attachmentIDs = parent.getAttachments();
  } catch (error) {
    ztoolkit.log("Cannot inspect parent PDF attachments", parent.id, error);
    return;
  }
  if (!attachmentIDs.length) return;
  const source = await fingerprintForMatching(sourcePath, cache);
  if (!source) return;

  for (const id of attachmentIDs) {
    try {
      const attachment = await Zotero.Items.getAsync(id);
      if (
        !attachment ||
        attachment.deleted ||
        !attachment.isAttachment() ||
        attachment.parentItemID !== parent.id ||
        attachment.libraryID !== parent.libraryID ||
        (!attachment.isImportedAttachment() &&
          !attachment.isLinkedFileAttachment())
      ) {
        continue;
      }
      const path = await attachment.getFilePathAsync();
      if (
        !path ||
        (attachment.attachmentContentType !== "application/pdf" &&
          !/\.pdf$/i.test(path))
      ) {
        continue;
      }
      const stat = await attachmentFileStat(path);
      if (stat.size !== source.size && !identityCache) continue;
      const existing = await fingerprintForMatching(path, cache);
      if (!existing) continue;
      if (
        !matchingFileContent(source, existing) &&
        !(
          identityCache &&
          (await samePDFContent(sourcePath, path, cache, identityCache))
        )
      ) {
        continue;
      }

      // The source may have changed while other attachment files were hashed.
      if (
        (await attachment.getFilePathAsync()) === path &&
        sameFileStat(source, await attachmentFileStat(sourcePath)) &&
        sameFileStat(existing, await attachmentFileStat(path)) &&
        !attachment.deleted &&
        attachment.parentItemID === parent.id &&
        attachment.libraryID === parent.libraryID &&
        !parent.deleted
      ) {
        return attachment;
      }
    } catch (error) {
      // A missing/remote/broken attachment must not hide a later local match.
      ztoolkit.log("Cannot compare existing PDF attachment", id, error);
    }
  }
  return undefined;
}
