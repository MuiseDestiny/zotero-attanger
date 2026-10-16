const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const esbuild = require("esbuild");
const {
  createAttachment,
  createHarness,
  createRegularItem,
} = require("./helpers/menuHarness.cjs");

const bundled = esbuild.buildSync({
  entryPoints: [
    path.join(process.cwd(), "src/modules/attachmentDuplicates.ts"),
  ],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  logLevel: "silent",
}).outputFiles[0].text;
const duplicateModule = { exports: {} };
new Function("module", "exports", "require", bundled)(
  duplicateModule,
  duplicateModule.exports,
  require,
);
const {
  createAttachmentFingerprintCache,
  findDuplicatePDFAttachment,
  fingerprintForMatching,
  createPDFIdentityCache,
  pdfIdentityForMatching,
  samePDFContent,
} = duplicateModule.exports;

let harness;

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
});

function digest(filePath) {
  return crypto
    .createHash("md5")
    .update(harness.fileContents.get(filePath))
    .digest("hex");
}

for (const mode of ["imported", "linked"]) {
  test(`finds identical bytes in a ${mode} PDF with a different filename`, async () => {
    const source = "/source/Downloaded paper (1).pdf";
    const existing = "/storage/AT000002/Renamed paper.pdf";
    harness = createHarness({
      fileContents: {
        [source]: "same PDF bytes",
        [existing]: "same PDF bytes",
      },
    });
    const parent = createRegularItem(harness);
    const attachment = createAttachment(harness, {
      mode,
      path: existing,
      parent,
    });

    assert.equal(await findDuplicatePDFAttachment(parent, source), attachment);
    assert.deepEqual(harness.calls.remove, []);
    assert.equal(attachment.calls.erase, 0);
    assert.equal(harness.files.has(source), true);
  });
}

test("same PDF filename and title with different bytes is not a duplicate", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  harness = createHarness({
    fileContents: { [source]: "new bytes", [existing]: "old bytes" },
  });
  const parent = createRegularItem(harness);
  createAttachment(harness, { parent, path: existing });

  assert.equal(await findDuplicatePDFAttachment(parent, source), undefined);
});

test("missing, remote and unreadable children do not block a later PDF match", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000005/Renamed.pdf";
  harness = createHarness({
    fileContents: { [source]: "same PDF", [existing]: "same PDF" },
  });
  const parent = createRegularItem(harness);
  createAttachment(harness, {
    id: 2,
    parent,
    path: "/storage/AT000002/missing.pdf",
  });
  const remote = createAttachment(harness, { id: 3, parent });
  remote.getFilePathAsync = async () => false;
  const unreadable = createAttachment(harness, { id: 4, parent });
  unreadable.getFilePathAsync = async () => {
    throw new Error("Unavailable attachment");
  };
  const attachment = createAttachment(harness, {
    id: 5,
    parent,
    path: existing,
  });

  assert.equal(await findDuplicatePDFAttachment(parent, source), attachment);
});

test("deleted, another parent's and another library's PDFs are not duplicates", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  harness = createHarness({
    fileContents: { [source]: "same PDF", [existing]: "same PDF" },
  });
  const parent = createRegularItem(harness);
  const otherParent = createRegularItem(harness, { id: 10 });
  createAttachment(harness, {
    id: 2,
    deleted: true,
    parent,
    path: existing,
  });
  const otherAttachment = createAttachment(harness, {
    id: 3,
    parent: otherParent,
    path: existing,
  });
  parent.attachmentIDs.push(otherAttachment.id);
  createAttachment(harness, {
    id: 4,
    parent,
    path: existing,
    libraryID: 2,
  });

  assert.equal(await findDuplicatePDFAttachment(parent, source), undefined);
});

test("linked URLs and local non-PDF children are not PDF duplicates", async () => {
  const source = "/source/Paper.pdf";
  const other = "/source/Paper.txt";
  harness = createHarness({
    fileContents: { [source]: "same bytes", [other]: "same bytes" },
  });
  const parent = createRegularItem(harness);
  const remote = createAttachment(harness, { id: 2, parent, path: source });
  remote.attachmentLinkMode = 3;
  createAttachment(harness, {
    id: 3,
    parent,
    path: other,
    contentType: "text/plain",
  });

  assert.equal(await findDuplicatePDFAttachment(parent, source), undefined);
  assert.equal(await findDuplicatePDFAttachment(parent, other), undefined);
});

test("PDF filename recognizes a local PDF with an uninformative content type", async () => {
  const source = "/source/Paper.PDF";
  const existing = "/storage/AT000002/Paper.pdf";
  harness = createHarness({
    fileContents: { [source]: "same PDF", [existing]: "same PDF" },
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, {
    parent,
    path: existing,
    contentType: "application/octet-stream",
  });

  assert.equal(await findDuplicatePDFAttachment(parent, source), attachment);
});

test("file size avoids hashing clearly different attachments", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  const hashes = [];
  harness = createHarness({
    fileContents: { [source]: "new PDF", [existing]: "old PDF much longer" },
    md5: (filePath) => {
      hashes.push(filePath);
      return digest(filePath);
    },
  });
  const parent = createRegularItem(harness);
  createAttachment(harness, { parent, path: existing });

  assert.equal(await findDuplicatePDFAttachment(parent, source), undefined);
  assert.deepEqual(hashes, [source]);
});

test("a source hash failure never reports a duplicate and is retried later", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  let fail = true;
  harness = createHarness({
    fileContents: { [source]: "same PDF", [existing]: "same PDF" },
    md5: (filePath) => {
      if (filePath === source && fail) throw new Error("File locked");
      return digest(filePath);
    },
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, { parent, path: existing });
  const cache = createAttachmentFingerprintCache();

  assert.equal(
    await findDuplicatePDFAttachment(parent, source, cache),
    undefined,
  );
  fail = false;
  assert.equal(
    await findDuplicatePDFAttachment(parent, source, cache),
    attachment,
  );
});

test("an invalid digest cannot make unrelated PDFs duplicates", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  harness = createHarness({
    fileContents: { [source]: "new bytes", [existing]: "old bytes" },
    md5: () => "",
  });
  const parent = createRegularItem(harness);
  createAttachment(harness, { parent, path: existing });

  assert.equal(await findDuplicatePDFAttachment(parent, source), undefined);
});

test("an existing attachment hash failure does not hide a later local duplicate", async () => {
  const source = "/source/Paper.pdf";
  const broken = "/storage/AT000002/broken.pdf";
  const existing = "/storage/AT000003/Paper.pdf";
  harness = createHarness({
    fileContents: {
      [source]: "same PDF",
      [broken]: "bad data",
      [existing]: "same PDF",
    },
    md5: (filePath) => {
      if (filePath === broken) throw new Error("File locked");
      return digest(filePath);
    },
  });
  const parent = createRegularItem(harness);
  createAttachment(harness, { id: 2, parent, path: broken });
  const attachment = createAttachment(harness, {
    id: 3,
    parent,
    path: existing,
  });

  assert.equal(await findDuplicatePDFAttachment(parent, source), attachment);
});

test("a source changed while hashing is never reported as a duplicate", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  const modifiedTimes = { [source]: 1 };
  harness = createHarness({
    fileContents: { [source]: "same PDF", [existing]: "same PDF" },
    modifiedTimes,
    md5: (filePath) => {
      const hash = digest(filePath);
      if (filePath === source) {
        harness.writeFile(source, "different PDF");
        modifiedTimes[source]++;
      }
      return hash;
    },
  });
  const parent = createRegularItem(harness);
  createAttachment(harness, { parent, path: existing });

  assert.equal(await findDuplicatePDFAttachment(parent, source), undefined);
});

test("a source changed while hashing an existing attachment is not skipped", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  const modifiedTimes = { [source]: 1 };
  harness = createHarness({
    fileContents: { [source]: "same PDF", [existing]: "same PDF" },
    modifiedTimes,
    md5: (filePath) => {
      if (filePath === existing) {
        harness.writeFile(source, "new data");
        modifiedTimes[source]++;
      }
      return digest(filePath);
    },
  });
  const parent = createRegularItem(harness);
  createAttachment(harness, { parent, path: existing });

  assert.equal(await findDuplicatePDFAttachment(parent, source), undefined);
});

test("an existing attachment changed while hashing is not a duplicate", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  const modifiedTimes = { [existing]: 1 };
  harness = createHarness({
    fileContents: { [source]: "same PDF", [existing]: "same PDF" },
    modifiedTimes,
    md5: (filePath) => {
      const hash = digest(filePath);
      if (filePath === existing) {
        harness.writeFile(existing, "new data");
        modifiedTimes[existing]++;
      }
      return hash;
    },
  });
  const parent = createRegularItem(harness);
  createAttachment(harness, { parent, path: existing });

  assert.equal(await findDuplicatePDFAttachment(parent, source), undefined);
});

test("a child moved or trashed while hashing is no longer a duplicate", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  let attachment;
  harness = createHarness({
    fileContents: { [source]: "same PDF", [existing]: "same PDF" },
    md5: (filePath) => {
      if (filePath === existing) {
        attachment.deleted = true;
        attachment.parentItemID = 10;
      }
      return digest(filePath);
    },
  });
  const parent = createRegularItem(harness);
  attachment = createAttachment(harness, { parent, path: existing });

  assert.equal(await findDuplicatePDFAttachment(parent, source), undefined);
});

test("an attachment relinked during hashing does not match its stale path", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  const replacement = "/source/other.pdf";
  let attachment;
  harness = createHarness({
    fileContents: {
      [source]: "same PDF",
      [existing]: "same PDF",
      [replacement]: "new data",
    },
    md5: (filePath) => {
      if (filePath === existing) attachment.attachmentPath = replacement;
      return digest(filePath);
    },
  });
  const parent = createRegularItem(harness);
  attachment = createAttachment(harness, { parent, path: existing });

  assert.equal(await findDuplicatePDFAttachment(parent, source), undefined);
});

test("one command's cache shares concurrent and repeated file hashes", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  const hashes = [];
  harness = createHarness({
    fileContents: { [source]: "same PDF", [existing]: "same PDF" },
    md5: (filePath) => {
      hashes.push(filePath);
      return digest(filePath);
    },
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, { parent, path: existing });
  const cache = createAttachmentFingerprintCache();

  const fingerprints = await Promise.all([
    fingerprintForMatching(source, cache),
    fingerprintForMatching(source, cache),
  ]);
  assert.deepEqual(fingerprints[0], fingerprints[1]);
  assert.equal(
    await findDuplicatePDFAttachment(parent, source, cache),
    attachment,
  );
  assert.equal(
    await findDuplicatePDFAttachment(parent, source, cache),
    attachment,
  );
  assert.deepEqual(hashes, [source, existing]);
});

test("cached fingerprints are recomputed when a file changes", async () => {
  const source = "/source/Paper.pdf";
  const existing = "/storage/AT000002/Paper.pdf";
  const modifiedTimes = { [source]: 1 };
  const hashes = [];
  harness = createHarness({
    fileContents: { [source]: "same PDF", [existing]: "same PDF" },
    modifiedTimes,
    md5: (filePath) => {
      hashes.push(filePath);
      return digest(filePath);
    },
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, { parent, path: existing });
  const cache = createAttachmentFingerprintCache();

  assert.equal(
    await findDuplicatePDFAttachment(parent, source, cache),
    attachment,
  );
  harness.writeFile(source, "new data");
  modifiedTimes[source]++;
  assert.equal(
    await findDuplicatePDFAttachment(parent, source, cache),
    undefined,
  );
  assert.deepEqual(hashes, [source, existing, source]);
});

const semanticSource = "/source/Reencoded paper (1).pdf";
const semanticExisting = "/storage/AT000002/Article.pdf";
const semanticText =
  "Scientific values remain exact: catalyst 2 yields 90.92 mg per gram at 1.2 V. ".repeat(
    24,
  );

function semanticData({ doi = "10.1002/ange.202504775", totalPages = 1 } = {}) {
  const word = [40, 50, 500, 65, 12, 0, 62, 0, 0, 0, 0, 0, 0, semanticText];
  const page = [595, 842, [[[[0, 0, 0, 0, [[[word]]]]]]]];
  return {
    metadata: { doi },
    totalPages,
    pages: Array.from({ length: Math.min(5, totalPages) }, () =>
      structuredClone(page),
    ),
  };
}

function semanticVisuals(totalPages = 1) {
  return {
    totalPages,
    pageHashes: Array.from({ length: totalPages }, (_, index) =>
      crypto
        .createHash("sha256")
        .update(`rendered page ${index}`)
        .digest("hex"),
    ),
  };
}

function semanticSetup(options = {}) {
  harness = createHarness({
    fileContents: {
      [semanticSource]: "reencoded source PDF " + "a".repeat(200),
      [semanticExisting]: "original article PDF " + "b".repeat(200),
    },
    ...options,
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, {
    parent,
    path: semanticExisting,
  });
  const data = {
    [semanticSource]: semanticData(),
    [semanticExisting]: semanticData(),
  };
  const fulltext = {
    [semanticSource]: { text: semanticText, totalPages: 1, extractedPages: 1 },
    [semanticExisting]: {
      text: semanticText,
      totalPages: 1,
      extractedPages: 1,
    },
  };
  const visuals = {
    [semanticSource]: semanticVisuals(),
    [semanticExisting]: semanticVisuals(),
  };
  const reads = { data: [], fulltext: [], visuals: [] };
  const identities = createPDFIdentityCache(
    async (filePath) => {
      reads.data.push(filePath);
      return data[filePath];
    },
    async (filePath) => {
      reads.fulltext.push(filePath);
      return fulltext[filePath];
    },
    async (filePath, totalPages) => {
      reads.visuals.push(filePath);
      assert.equal(totalPages, data[filePath].totalPages);
      return visuals[filePath];
    },
  );
  const fingerprints = createAttachmentFingerprintCache();
  return {
    parent,
    attachment,
    data,
    fulltext,
    visuals,
    reads,
    identities,
    fingerprints,
  };
}

test("re-encoded stored PDFs with different bytes and sizes need complete matching content", async () => {
  const setup = semanticSetup();
  harness.writeFile(
    semanticSource,
    harness.fileContents.get(semanticSource).toString() + "x",
  );
  assert.notEqual(
    harness.fileContents.get(semanticSource).length,
    harness.fileContents.get(semanticExisting).length,
  );
  assert.equal(
    await findDuplicatePDFAttachment(
      setup.parent,
      semanticSource,
      setup.fingerprints,
      setup.identities,
    ),
    setup.attachment,
  );
  assert.equal(harness.files.has(semanticSource), true);
  assert.equal(setup.attachment.calls.erase, 0);
  assert.deepEqual(harness.calls.remove, []);
  assert.equal(setup.reads.fulltext.length, 2);
  assert.equal(setup.reads.visuals.length, 2);
});

test("same PDF bytes do not require semantic readers", async () => {
  const setup = semanticSetup();
  harness.writeFile(semanticSource, harness.fileContents.get(semanticExisting));

  assert.equal(
    await samePDFContent(
      semanticSource,
      semanticExisting,
      setup.fingerprints,
      setup.identities,
    ),
    true,
  );
  assert.deepEqual(setup.reads, { data: [], fulltext: [], visuals: [] });
});

for (const changed of [
  "doi",
  "no-doi",
  "ambiguous-doi",
  "pages",
  "layout",
  "opening-text",
]) {
  test(`semantic identity rejects ${changed} before reading whole text`, async () => {
    const setup = semanticSetup();
    const existing = setup.data[semanticExisting];
    if (changed === "doi") existing.metadata.doi = "10.1002/ange.different";
    if (changed === "no-doi") delete existing.metadata.doi;
    if (changed === "ambiguous-doi") {
      existing.metadata.doi += " 10.1002/ange.related";
    }
    if (changed === "pages")
      setup.data[semanticExisting] = semanticData({ totalPages: 2 });
    if (changed === "layout") existing.pages[0][0]++;
    if (changed === "opening-text") {
      const word = existing.pages[0][2][0][0][0][4][0][0][0];
      word[word.length - 1] = semanticText.replace("90.92", "90.93");
    }

    assert.equal(
      await samePDFContent(
        semanticSource,
        semanticExisting,
        setup.fingerprints,
        setup.identities,
      ),
      false,
    );
    assert.deepEqual(setup.reads.fulltext, []);
    assert.deepEqual(setup.reads.visuals, []);
  });
}

for (const changed of [
  "digits",
  "punctuation",
  "case",
  "partial",
  "empty",
  "too-short",
]) {
  test(`same DOI and layout do not hide ${changed} changes in whole PDF text`, async () => {
    const setup = semanticSetup();
    const existing = setup.fulltext[semanticExisting];
    if (changed === "digits")
      existing.text = semanticText.replace("90.92", "90.93");
    if (changed === "punctuation")
      existing.text = semanticText.replace("1.2", "12");
    if (changed === "case")
      existing.text = semanticText.replace("Scientific", "scientific");
    if (changed === "partial") existing.extractedPages = 0;
    if (changed === "empty") existing.text = "";
    if (changed === "too-short")
      existing.text = "Same title with too little content.";

    assert.equal(
      await findDuplicatePDFAttachment(
        setup.parent,
        semanticSource,
        setup.fingerprints,
        setup.identities,
      ),
      undefined,
    );
    assert.equal(setup.parent.attachmentIDs.length, 1);
    assert.equal(harness.files.has(semanticSource), true);
    assert.deepEqual(setup.reads.visuals, []);
  });
}

test("12-page PDFs with equal first five pages but changed later content are not duplicates", async () => {
  const setup = semanticSetup();
  const text = Array(12).fill(semanticText).join("\f");
  for (const filePath of [semanticSource, semanticExisting]) {
    setup.data[filePath] = semanticData({ totalPages: 12 });
    setup.fulltext[filePath] = { text, totalPages: 12, extractedPages: 12 };
  }
  setup.fulltext[semanticExisting].text =
    text + "Changed conclusion on page twelve.";

  assert.equal(
    await samePDFContent(
      semanticSource,
      semanticExisting,
      setup.fingerprints,
      setup.identities,
    ),
    false,
  );
});

test("full-page extraction is mandatory when recognizer data contains only five of twelve pages", async () => {
  const setup = semanticSetup();
  for (const filePath of [semanticSource, semanticExisting]) {
    setup.data[filePath] = semanticData({ totalPages: 12 });
    setup.fulltext[filePath] = {
      text: Array(5).fill(semanticText).join("\f"),
      totalPages: 12,
      extractedPages: 5,
    };
  }

  assert.equal(
    await samePDFContent(
      semanticSource,
      semanticExisting,
      setup.fingerprints,
      setup.identities,
    ),
    false,
  );
});

test("semantic normalization only ignores whitespace and soft hyphens", async () => {
  const setup = semanticSetup();
  setup.fulltext[semanticExisting].text = semanticText.replace(
    / /g,
    " \n\t\u00ad",
  );

  assert.equal(
    await samePDFContent(
      semanticSource,
      semanticExisting,
      setup.fingerprints,
      setup.identities,
    ),
    true,
  );
});

for (const pageIndex of [0, 5, 11]) {
  test(`an image-only change on page ${pageIndex + 1} prevents semantic deduplication`, async () => {
    const setup = semanticSetup();
    for (const filePath of [semanticSource, semanticExisting]) {
      setup.data[filePath] = semanticData({ totalPages: 12 });
      setup.fulltext[filePath] = {
        text: Array(12).fill(semanticText).join("\f"),
        totalPages: 12,
        extractedPages: 12,
      };
      setup.visuals[filePath] = semanticVisuals(12);
    }
    setup.visuals[semanticExisting].pageHashes[pageIndex] = crypto
      .createHash("sha256")
      .update("a changed scientific figure with identical text")
      .digest("hex");

    assert.equal(
      await findDuplicatePDFAttachment(
        setup.parent,
        semanticSource,
        setup.fingerprints,
        setup.identities,
      ),
      undefined,
    );
    assert.equal(harness.files.has(semanticSource), true);
    assert.equal(setup.attachment.calls.erase, 0);
    assert.equal(setup.reads.visuals.length, 2);
  });
}

for (const invalid of [
  "missing",
  "wrong-total",
  "incomplete",
  "extra-page",
  "sparse",
  "invalid-hash",
  "wrong-digest-length",
  "non-string-hash",
]) {
  test(`semantic duplicates require complete valid visual signatures: ${invalid}`, async () => {
    const setup = semanticSetup();
    const result = setup.visuals[semanticExisting];
    if (invalid === "missing") setup.visuals[semanticExisting] = undefined;
    if (invalid === "wrong-total") result.totalPages = 2;
    if (invalid === "incomplete") result.pageHashes = [];
    if (invalid === "extra-page") result.pageHashes.push("a".repeat(64));
    if (invalid === "sparse") result.pageHashes = new Array(1);
    if (invalid === "invalid-hash") result.pageHashes[0] = "z".repeat(64);
    if (invalid === "wrong-digest-length")
      result.pageHashes[0] = "a".repeat(32);
    if (invalid === "non-string-hash") result.pageHashes[0] = 0;

    assert.equal(
      await samePDFContent(
        semanticSource,
        semanticExisting,
        setup.fingerprints,
        setup.identities,
      ),
      false,
    );
  });
}

test("a missing visual reader falls back to exact-byte duplicates only", async () => {
  const modifiedTimes = { [semanticSource]: 1 };
  const setup = semanticSetup({ modifiedTimes });
  setup.identities.readVisuals = undefined;

  assert.equal(
    await samePDFContent(
      semanticSource,
      semanticExisting,
      setup.fingerprints,
      setup.identities,
    ),
    false,
  );
  assert.deepEqual(setup.reads, { data: [], fulltext: [], visuals: [] });
  harness.writeFile(semanticSource, harness.fileContents.get(semanticExisting));
  modifiedTimes[semanticSource]++;
  assert.equal(
    await samePDFContent(
      semanticSource,
      semanticExisting,
      setup.fingerprints,
      setup.identities,
    ),
    true,
  );
  assert.deepEqual(setup.reads, { data: [], fulltext: [], visuals: [] });
});

test("more than 100 pages never triggers expensive whole-document readers", async () => {
  const setup = semanticSetup();
  for (const filePath of [semanticSource, semanticExisting]) {
    setup.data[filePath] = semanticData({ totalPages: 101 });
  }

  assert.equal(
    await samePDFContent(
      semanticSource,
      semanticExisting,
      setup.fingerprints,
      setup.identities,
    ),
    false,
  );
  assert.deepEqual(setup.reads.fulltext, []);
  assert.deepEqual(setup.reads.visuals, []);
});

test("SHA-256 visual digests are case-insensitive hex values", async () => {
  const setup = semanticSetup();
  setup.visuals[semanticExisting].pageHashes = setup.visuals[
    semanticExisting
  ].pageHashes.map((hash) => hash.toUpperCase());

  assert.equal(
    await samePDFContent(
      semanticSource,
      semanticExisting,
      setup.fingerprints,
      setup.identities,
    ),
    true,
  );
});

test("identity cache shares readers and invalidates when the file fingerprint changes", async () => {
  const modifiedTimes = { [semanticSource]: 1, [semanticExisting]: 1 };
  const setup = semanticSetup({ modifiedTimes });
  const compare = () =>
    samePDFContent(
      semanticSource,
      semanticExisting,
      setup.fingerprints,
      setup.identities,
    );

  assert.deepEqual(await Promise.all([compare(), compare()]), [true, true]);
  assert.equal(await compare(), true);
  assert.equal(setup.reads.data.length, 2);
  assert.equal(setup.reads.fulltext.length, 2);
  assert.equal(setup.reads.visuals.length, 2);
  harness.writeFile(semanticSource, "new article PDF bytes" + "c".repeat(200));
  modifiedTimes[semanticSource]++;
  setup.fulltext[semanticSource].text = semanticText.replace("90.92", "90.93");
  assert.equal(await compare(), false);
  assert.equal(setup.reads.data.length, 3);
  assert.equal(setup.reads.fulltext.length, 3);
  assert.equal(setup.reads.visuals.length, 2);
});

test("a changed file invalidates its cached visual identity even if text is unchanged", async () => {
  const modifiedTimes = { [semanticSource]: 1, [semanticExisting]: 1 };
  const setup = semanticSetup({ modifiedTimes });
  const compare = () =>
    samePDFContent(
      semanticSource,
      semanticExisting,
      setup.fingerprints,
      setup.identities,
    );

  assert.equal(await compare(), true);
  harness.writeFile(semanticSource, "changed image PDF    " + "c".repeat(200));
  modifiedTimes[semanticSource]++;
  setup.visuals[semanticSource].pageHashes[0] = crypto
    .createHash("sha256")
    .update("changed image")
    .digest("hex");
  assert.equal(await compare(), false);
  assert.equal(setup.reads.data.length, 3);
  assert.equal(setup.reads.fulltext.length, 3);
  assert.equal(setup.reads.visuals.length, 3);
});

for (const reader of ["recognizer", "whole-text", "visuals"]) {
  test(`failed ${reader} reader falls back to byte comparison only`, async () => {
    const setup = semanticSetup();
    if (reader === "recognizer") {
      setup.identities.readData = async () => {
        throw new Error("Cannot recognize PDF");
      };
    } else if (reader === "whole-text") {
      setup.identities.readFulltext = async () => {
        throw new Error("Cannot extract whole PDF text");
      };
    } else {
      setup.identities.readVisuals = async () => {
        throw new Error("Cannot render whole PDF");
      };
    }

    assert.equal(
      await samePDFContent(
        semanticSource,
        semanticExisting,
        setup.fingerprints,
        setup.identities,
      ),
      false,
    );
  });
}

test("a source changed during whole-text extraction is not a duplicate", async () => {
  const modifiedTimes = { [semanticSource]: 1 };
  const setup = semanticSetup({ modifiedTimes });
  const readFulltext = setup.identities.readFulltext;
  setup.identities.readFulltext = async (filePath) => {
    const data = await readFulltext(filePath);
    if (filePath === semanticExisting) {
      harness.writeFile(
        semanticSource,
        "modified source file " + "c".repeat(200),
      );
      modifiedTimes[semanticSource]++;
    }
    return data;
  };

  assert.equal(
    await findDuplicatePDFAttachment(
      setup.parent,
      semanticSource,
      setup.fingerprints,
      setup.identities,
    ),
    undefined,
  );
});

test("a source changed during page rendering is not a duplicate", async () => {
  const modifiedTimes = { [semanticSource]: 1 };
  const setup = semanticSetup({ modifiedTimes });
  const readVisuals = setup.identities.readVisuals;
  setup.identities.readVisuals = async (filePath, totalPages) => {
    const result = await readVisuals(filePath, totalPages);
    if (filePath === semanticExisting) {
      harness.writeFile(
        semanticSource,
        "modified source file " + "c".repeat(200),
      );
      modifiedTimes[semanticSource]++;
    }
    return result;
  };

  assert.equal(
    await findDuplicatePDFAttachment(
      setup.parent,
      semanticSource,
      setup.fingerprints,
      setup.identities,
    ),
    undefined,
  );
  assert.deepEqual(harness.calls.remove, []);
});

test("large files or uninformative page data do not trigger whole-text extraction", async () => {
  const setup = semanticSetup();
  const stat = IOUtils.stat;
  IOUtils.stat = async (filePath) => ({
    ...(await stat(filePath)),
    size: 65 * 1024 * 1024,
  });

  assert.equal(
    await pdfIdentityForMatching(
      semanticSource,
      setup.fingerprints,
      setup.identities,
    ),
    undefined,
  );
  assert.deepEqual(setup.reads, { data: [], fulltext: [], visuals: [] });
});
