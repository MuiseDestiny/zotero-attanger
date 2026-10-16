const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { afterEach, test } = require("node:test");
const {
  createAttachment,
  createHarness,
  createRegularItem,
} = require("./helpers/menuHarness.cjs");

let harness;

afterEach(() => {
  global.addon?.data.menu?.dispose();
  harness?.cleanup();
  harness = undefined;
});

function setup(options = {}) {
  harness = createHarness({
    ...options,
    prefs: {
      workMode: "stored",
      readPDFtitle: "never",
      deleteSourceAfterImport: false,
      ...options.prefs,
    },
  });
  Zotero.version = "11.0.0";
  new harness.module.default();
  return harness;
}

function command(id = "attanger-match-attachment") {
  const root = harness.menuRegistrations.find(
    ({ config }) => config.id === "attanger-menu",
  ).config;
  const entry = root.children.find((child) =>
    id === "exact"
      ? child.label === "zoteroattanger-match-attanger-attachment"
      : child.id === id,
  );
  assert.ok(entry, `Missing menu command: ${id}`);
  return entry.commandListener;
}

function recognizerPage(text, fontSize = 24) {
  const words = [[0, 0, 0, 0, fontSize, 0, text]];
  const lines = [[words]];
  const textBlock = [null, null, null, null, lines];
  return [[[[textBlock]]]];
}

function importedFiles() {
  return harness.calls.importFromFile.map(({ file, parentItemID }) => ({
    file,
    parentItemID,
  }));
}

function createArticle(options = {}) {
  const item = createRegularItem(harness, options);
  const getField = item.getField;
  item.getField = (field) =>
    field === "DOI" ? options.doi || "" : getField.call(item, field);
  return item;
}

const articleTitle =
  "High Performance Capacitive Deionization Cathode of Nickel Hexacyanoferrate Doped with Cobalt";

const semanticDOI = "10.1002/ange.202504775";

function encodedArticle(marker, extraBytes = 0) {
  return `%PDF-1.7 ${marker}\n${"x".repeat(6000 + extraBytes)}`;
}

function completeRecognizerData() {
  return {
    metadata: { title: `${articleTitle}!`, "WPS-ARTICLEDOI": semanticDOI },
    totalPages: 12,
    pages: Array.from({ length: 5 }, (_, index) => [
      595,
      842,
      [
        [
          [36, 50, 550, 80, 24, 1, 0, 0, 0, 0, 0, 0, 0, `${articleTitle}!`],
          [
            36,
            100,
            550,
            120,
            10,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            `Page ${index + 1}: Electrochemical desalination with stable nickel electrodes and selective ion adsorption.`,
          ],
        ],
      ],
    ]),
  };
}

function completeArticleText(changedLastPage = false) {
  return {
    text: Array.from({ length: 12 }, (_, index) => {
      const capacity = changedLastPage && index === 11 ? "91.02" : "90.92";
      return (
        `Page ${index + 1}. ${articleTitle}. ` +
        `The measured adsorption capacity was ${capacity} mg per gram at 1.2 V. ` +
        "Cycling stability remained 91 percent after 200 desalination cycles. " +
        "These reproducible results demonstrate selective ion adsorption and robust electrochemical performance."
      );
    }).join("\f"),
    extractedPages: 12,
    totalPages: 12,
  };
}

function semanticWorker({
  changedMarker,
  incompleteMarker,
  changedVisualMarker,
  changedVisualPage = 0,
  queries = [],
} = {}) {
  return async (action, { buf, pageIndex }) => {
    const bytes = Buffer.from(buf).toString();
    queries.push(action);
    if (/renderArea$/i.test(action)) {
      const changed =
        changedVisualMarker &&
        bytes.includes(changedVisualMarker) &&
        pageIndex === changedVisualPage;
      const png = Buffer.from(
        changed
          ? "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg=="
          : "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=",
        "base64",
      );
      return { buf: Uint8Array.from(png).buffer };
    }
    if (/getFulltext/i.test(action)) {
      const result = completeArticleText(
        Boolean(changedMarker && bytes.includes(changedMarker)),
      );
      if (incompleteMarker && bytes.includes(incompleteMarker)) {
        result.extractedPages = 5;
      }
      return result;
    }
    return completeRecognizerData();
  };
}

for (const mode of ["imported", "linked"]) {
  test(`matching skips a renamed duplicate of an existing ${mode} PDF without deleting the download`, async () => {
    const downloaded = `/source/${articleTitle} (1).pdf`;
    const existingPath =
      mode === "linked"
        ? "/dest/Wang2025.pdf"
        : "/storage/ARTICLE1/Wang2025.pdf";
    setup({
      fileContents: {
        [downloaded]: "%PDF-1.7 identical article bytes",
        [existingPath]: "%PDF-1.7 identical article bytes",
      },
      prefs: { deleteSourceAfterImport: true },
    });
    const parent = createRegularItem(harness, { id: 1, title: articleTitle });
    const attachment = createAttachment(harness, {
      id: 2,
      mode,
      parent,
      path: existingPath,
      title: "PDF",
    });
    harness.selectedItems = [parent];

    await command()();

    assert.deepEqual(importedFiles(), []);
    assert.deepEqual(harness.calls.linkFromFile, []);
    assert.deepEqual(parent.attachmentIDs, [attachment.id]);
    assert.equal(harness.files.has(downloaded), true);
    assert.equal(harness.files.has(existingPath), true);
    assert.deepEqual(harness.calls.remove, []);
  });
}

test("matching allows the same filename when the PDF bytes are different", async () => {
  const downloaded = `/source/${articleTitle}.pdf`;
  const existingPath = `/storage/ARTICLE1/${articleTitle}.pdf`;
  setup({
    fileContents: {
      [downloaded]: "%PDF-1.7 new version",
      [existingPath]: "%PDF-1.7 old version",
    },
  });
  const parent = createRegularItem(harness, { title: articleTitle });
  const attachment = createAttachment(harness, {
    id: 2,
    mode: "imported",
    parent,
    path: existingPath,
    title: `${articleTitle}.pdf`,
  });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
  assert.equal(parent.attachmentIDs.length, 2);
  assert.equal(harness.items.get(attachment.id), attachment);
  assert.equal(
    harness.fileContents.get(existingPath).toString(),
    "%PDF-1.7 old version",
  );
});

for (const mode of ["imported", "linked"]) {
  for (const [label, commandID] of [
    ["matching", "attanger-match-attachment"],
    ["attach new file", "attanger-attach-new-file"],
    ["exact Attanger matching", "exact"],
  ]) {
    test(`${label} skips a re-encoded copy of an existing ${mode} PDF only after complete-document verification`, async () => {
      const downloaded = "/source/Expected.pdf";
      const existingPath =
        mode === "linked"
          ? "/dest/previous-name.pdf"
          : "/storage/ARTICLE1/previous-name.pdf";
      const queries = [];
      setup({
        baseName: "Expected",
        fileContents: {
          [downloaded]: encodedArticle("download-A", 6),
          [existingPath]: encodedArticle("existing-B"),
        },
        prefs: {
          workMode: "copy",
          readPDFtitle: "always",
          fileTypes: "pdf",
          deleteSourceAfterImport: true,
        },
        pdfWorkerQuery: semanticWorker({ queries }),
      });
      const parent = createArticle({
        title: articleTitle,
        doi: semanticDOI,
        fileBaseName: "Expected",
      });
      const attachment = createAttachment(harness, {
        id: 2,
        mode,
        parent,
        path: existingPath,
        title: "PDF",
      });
      harness.selectedItems = [parent];

      await command(commandID)();

      assert.deepEqual(importedFiles(), []);
      assert.deepEqual(harness.calls.linkFromFile, []);
      assert.deepEqual(parent.attachmentIDs, [attachment.id]);
      assert.equal(harness.files.has(downloaded), true);
      assert.equal(harness.files.has(existingPath), true);
      assert.deepEqual(harness.calls.remove, []);
      assert.ok(queries.some((action) => /getFulltext/i.test(action)));
      assert.ok(queries.some((action) => /renderArea$/i.test(action)));
    });
  }
}

test("matching groups re-encoded downloads and verifies the chosen file's fingerprint rather than the group representative's", async () => {
  const representative = "/source/download.pdf";
  const exactFilename = `/source/${articleTitle}.pdf`;
  const queries = [];
  setup({
    fileContents: {
      [representative]: encodedArticle("download-A"),
      [exactFilename]: encodedArticle("download-B", 6),
    },
    prefs: { readPDFtitle: "always", deleteSourceAfterImport: true },
    pdfWorkerQuery: semanticWorker({ queries }),
  });
  const parent = createArticle({ title: articleTitle });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: exactFilename, parentItemID: parent.id },
  ]);
  assert.equal(parent.attachmentIDs.length, 1);
  assert.equal(harness.files.has(exactFilename), false);
  assert.equal(harness.files.has(representative), true);
  assert.deepEqual(harness.calls.remove, [exactFilename]);
  assert.ok(queries.some((action) => /getFulltext/i.test(action)));
  assert.ok(queries.some((action) => /renderArea$/i.test(action)));
});

for (const [label, commandID] of [
  ["matching", "attanger-match-attachment"],
  ["attach new file", "attanger-attach-new-file"],
  ["exact Attanger matching", "exact"],
]) {
  test(`${label} does not skip a PDF whose DOI and first five pages agree but page twelve has different scientific data`, async () => {
    const downloaded = "/source/Expected.pdf";
    const existingPath = "/storage/ARTICLE1/previous-name.pdf";
    setup({
      baseName: "Expected",
      fileContents: {
        [downloaded]: encodedArticle("download-A", 6),
        [existingPath]: encodedArticle("existing-B"),
      },
      prefs: { workMode: "copy", readPDFtitle: "always", fileTypes: "pdf" },
      pdfWorkerQuery: semanticWorker({ changedMarker: "existing-B" }),
    });
    const parent = createArticle({
      title: articleTitle,
      doi: semanticDOI,
      fileBaseName: "Expected",
    });
    createAttachment(harness, {
      id: 2,
      mode: "imported",
      parent,
      path: existingPath,
      title: "PDF",
    });
    harness.selectedItems = [parent];

    await command(commandID)();

    assert.deepEqual(importedFiles(), [
      { file: downloaded, parentItemID: parent.id },
    ]);
    assert.equal(parent.attachmentIDs.length, 2);
    assert.equal(harness.files.has(existingPath), true);
  });

  for (const pageIndex of [0, 5]) {
    test(`${label} does not skip a PDF with a changed image on page ${pageIndex + 1} despite identical DOI, layout and complete text`, async () => {
      const downloaded = "/source/Expected.pdf";
      const existingPath = "/storage/ARTICLE1/previous-name.pdf";
      const queries = [];
      setup({
        baseName: "Expected",
        fileContents: {
          [downloaded]: encodedArticle("download-A", 6),
          [existingPath]: encodedArticle("existing-B"),
        },
        prefs: { workMode: "copy", readPDFtitle: "always", fileTypes: "pdf" },
        pdfWorkerQuery: semanticWorker({
          changedVisualMarker: "existing-B",
          changedVisualPage: pageIndex,
          queries,
        }),
      });
      const parent = createArticle({
        title: articleTitle,
        doi: semanticDOI,
        fileBaseName: "Expected",
      });
      createAttachment(harness, {
        id: 2,
        mode: "imported",
        parent,
        path: existingPath,
        title: "PDF",
      });
      harness.selectedItems = [parent];

      await command(commandID)();

      assert.deepEqual(importedFiles(), [
        { file: downloaded, parentItemID: parent.id },
      ]);
      assert.equal(parent.attachmentIDs.length, 2);
      assert.equal(harness.files.has(existingPath), true);
      assert.ok(queries.some((action) => /getFulltext/i.test(action)));
      assert.ok(queries.some((action) => /renderArea$/i.test(action)));
    });
  }
}

test("partial full-text extraction cannot turn a different-byte PDF into a duplicate", async () => {
  const downloaded = `/source/${articleTitle}.pdf`;
  const existingPath = "/storage/ARTICLE1/previous-name.pdf";
  setup({
    fileContents: {
      [downloaded]: encodedArticle("download-A", 6),
      [existingPath]: encodedArticle("existing-B"),
    },
    prefs: { readPDFtitle: "always" },
    pdfWorkerQuery: semanticWorker({ incompleteMarker: "existing-B" }),
  });
  const parent = createArticle({ title: articleTitle, doi: semanticDOI });
  createAttachment(harness, {
    id: 2,
    mode: "imported",
    parent,
    path: existingPath,
    title: "PDF",
  });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
  assert.equal(parent.attachmentIDs.length, 2);
});

test("never-read mode does not perform semantic deduplication of differently encoded files", async () => {
  const downloaded = `/source/${articleTitle}.pdf`;
  const existingPath = "/storage/ARTICLE1/previous-name.pdf";
  const queries = [];
  setup({
    fileContents: {
      [downloaded]: encodedArticle("download-A", 6),
      [existingPath]: encodedArticle("existing-B"),
    },
    pdfWorkerQuery: semanticWorker({ queries }),
  });
  const parent = createArticle({ title: articleTitle, doi: semanticDOI });
  createAttachment(harness, {
    id: 2,
    mode: "imported",
    parent,
    path: existingPath,
    title: "PDF",
  });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
  assert.equal(parent.attachmentIDs.length, 2);
  assert.deepEqual(queries, []);
});

test("an existing different PDF does not block a new matching article or its successful source cleanup", async () => {
  const downloaded = `/source/${articleTitle}.pdf`;
  const existingPath = "/storage/ARTICLE1/supplement.pdf";
  setup({
    fileContents: {
      [downloaded]: "%PDF-1.7 article",
      [existingPath]: "%PDF-1.7 supplementary material",
    },
    prefs: { deleteSourceAfterImport: true },
  });
  const parent = createRegularItem(harness, { title: articleTitle });
  const attachment = createAttachment(harness, {
    id: 2,
    mode: "imported",
    parent,
    path: existingPath,
    title: "PDF",
  });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
  assert.equal(parent.attachmentIDs.length, 2);
  assert.equal(harness.items.get(attachment.id), attachment);
  assert.equal(harness.files.has(downloaded), false);
  assert.equal(harness.files.has(existingPath), true);
});

test("two downloaded copies are imported once, never assigned to an unrelated item, and remain deduplicated on repeat", async () => {
  const downloaded = `/source/${articleTitle}.pdf`;
  const numbered = `/source/${articleTitle} (1).pdf`;
  setup({
    fileContents: {
      [downloaded]: "%PDF-1.7 same article",
      [numbered]: "%PDF-1.7 same article",
    },
  });
  const correct = createRegularItem(harness, { id: 1, title: articleTitle });
  const unrelated = createRegularItem(harness, {
    id: 2,
    title: "Genome editing in drought resistant rice plants",
  });
  harness.selectedItems = [unrelated, correct];
  const match = command();

  await match();

  assert.equal(harness.calls.importFromFile.length, 1);
  assert.equal(harness.calls.importFromFile[0].parentItemID, correct.id);
  assert.equal(correct.attachmentIDs.length, 1);
  assert.deepEqual(unrelated.attachmentIDs, []);

  await match();

  assert.equal(harness.calls.importFromFile.length, 1);
  assert.equal(correct.attachmentIDs.length, 1);
  assert.deepEqual(unrelated.attachmentIDs, []);
  assert.equal(harness.files.has(downloaded), true);
  assert.equal(harness.files.has(numbered), true);
});

test("source cleanup deletes only the imported download, not the skipped duplicate copy", async () => {
  const downloaded = `/source/${articleTitle}.pdf`;
  const numbered = `/source/${articleTitle} (1).pdf`;
  setup({
    fileContents: {
      [downloaded]: "%PDF-1.7 same article",
      [numbered]: "%PDF-1.7 same article",
    },
    prefs: { deleteSourceAfterImport: true },
  });
  const parent = createRegularItem(harness, { title: articleTitle });
  harness.selectedItems = [parent];

  await command()();

  assert.equal(harness.calls.importFromFile.length, 1);
  const imported = harness.calls.importFromFile[0].file;
  const skipped = imported === downloaded ? numbered : downloaded;
  assert.equal(harness.files.has(imported), false);
  assert.equal(harness.files.has(skipped), true);
  assert.deepEqual(harness.calls.remove, [imported]);
  assert.equal(parent.attachmentIDs.length, 1);
});

test("duplicate download copies cannot satisfy two different selected papers with overlapping titles", async () => {
  const title =
    "High Performance Capacitive Deionization Cathodes for Water Purification";
  const relatedTitle = `${title} Using Nanoporous Carbon`;
  const downloaded = `/source/${title}.pdf`;
  const numbered = `/source/${title} (1).pdf`;
  setup({
    fileContents: {
      [downloaded]: "%PDF-1.7 same article",
      [numbered]: "%PDF-1.7 same article",
    },
  });
  const correct = createRegularItem(harness, { id: 1, title });
  const related = createRegularItem(harness, { id: 2, title: relatedTitle });
  harness.selectedItems = [related, correct];

  await command()();

  assert.equal(harness.calls.importFromFile.length, 1);
  assert.equal(harness.calls.importFromFile[0].parentItemID, correct.id);
  assert.equal(correct.attachmentIDs.length, 1);
  assert.deepEqual(related.attachmentIDs, []);
});

for (const [label, commandID] of [
  ["matching", "attanger-match-attachment"],
  ["attach new file", "attanger-attach-new-file"],
]) {
  test(`concurrent ${label} commands recheck content inside the import lock`, async () => {
    const downloaded = `/source/${articleTitle}.pdf`;
    setup({ fileContents: { [downloaded]: "%PDF-1.7 same article" } });
    const parent = createRegularItem(harness, { title: articleTitle });
    harness.selectedItems = [parent];
    const importFromFile = Zotero.Attachments.importFromFile;
    let releaseImport;
    const importGate = new Promise((resolve) => {
      releaseImport = resolve;
    });
    Zotero.Attachments.importFromFile = async (input) => {
      await importGate;
      return importFromFile(input);
    };
    const invoke = command(commandID);
    const first = invoke();
    const second = invoke();
    try {
      await harness.clock.settle();
    } finally {
      releaseImport();
    }

    await Promise.all([first, second]);

    assert.deepEqual(importedFiles(), [
      { file: downloaded, parentItemID: parent.id },
    ]);
    assert.equal(parent.attachmentIDs.length, 1);
    assert.equal(harness.files.has(downloaded), true);
  });
}

for (const [label, commandID, changeOnPathRead] of [
  ["matching", "attanger-match-attachment", 2],
  ["attach new file", "attanger-attach-new-file", 1],
  ["exact Attanger matching", "exact", 1],
]) {
  test(`${label} skips a source replaced during the locked duplicate scan`, async () => {
    const downloaded = "/source/Expected.pdf";
    const existingPath = "/storage/ARTICLE1/previous-name.pdf";
    const original = "%PDF-1.7 article A";
    const replacement = "%PDF-1.7 article B";
    const modifiedTimes = { [downloaded]: 10, [existingPath]: 10 };
    setup({
      baseName: "Expected",
      fileContents: {
        [downloaded]: original,
        [existingPath]: replacement,
      },
      modifiedTimes,
      prefs: {
        workMode: "copy",
        fileTypes: "pdf",
        deleteSourceAfterImport: true,
      },
    });
    const parent = createRegularItem(harness, {
      title: "Expected",
      fileBaseName: "Expected",
    });
    const attachment = createAttachment(harness, {
      id: 2,
      mode: "imported",
      parent,
      path: existingPath,
      title: "PDF",
    });
    let pathReads = 0;
    const getFilePath = attachment.getFilePathAsync;
    attachment.getFilePathAsync = async () => {
      if (++pathReads === changeOnPathRead) {
        harness.writeFile(downloaded, replacement);
        modifiedTimes[downloaded]++;
      }
      return getFilePath.call(attachment);
    };
    harness.selectedItems = [parent];

    await command(commandID)();

    assert.ok(pathReads >= changeOnPathRead, "Replacement race must occur");
    assert.deepEqual(importedFiles(), []);
    assert.deepEqual(harness.calls.linkFromFile, []);
    assert.deepEqual(parent.attachmentIDs, [attachment.id]);
    assert.equal(harness.files.has(downloaded), true);
    assert.equal(harness.fileContents.get(downloaded).toString(), replacement);
    assert.deepEqual(harness.calls.remove, []);
  });
}

for (const [label, commandID] of [
  ["matching", "attanger-match-attachment"],
  ["attach new file", "attanger-attach-new-file"],
]) {
  test(`${label} cleanup preserves a source replaced while the original PDF was imported`, async () => {
    const downloaded = `/source/${articleTitle}.pdf`;
    const original = "%PDF-1.7 article A";
    const replacement = "%PDF-1.7 article B";
    const modifiedTimes = { [downloaded]: 10 };
    setup({
      fileContents: { [downloaded]: original },
      modifiedTimes,
      prefs: { deleteSourceAfterImport: true },
    });
    const parent = createRegularItem(harness, { title: articleTitle });
    harness.selectedItems = [parent];
    const importFromFile = Zotero.Attachments.importFromFile;
    Zotero.Attachments.importFromFile = async (input) => {
      const imported = await importFromFile(input);
      harness.writeFile(downloaded, replacement);
      modifiedTimes[downloaded]++;
      return imported;
    };

    await command(commandID)();

    assert.deepEqual(importedFiles(), [
      { file: downloaded, parentItemID: parent.id },
    ]);
    assert.equal(parent.attachmentIDs.length, 1);
    const attachment = harness.items.get(parent.attachmentIDs[0]);
    const storedPath = await attachment.getFilePathAsync();
    assert.equal(harness.fileContents.get(storedPath).toString(), original);
    assert.equal(harness.files.has(downloaded), true);
    assert.equal(harness.fileContents.get(downloaded).toString(), replacement);
    assert.deepEqual(harness.calls.remove, []);
  });
}

test("an already attached article's duplicate downloads are not recycled onto another selected item", async () => {
  const downloaded = `/source/${articleTitle}.pdf`;
  const numbered = `/source/${articleTitle} (1).pdf`;
  const existingPath = "/storage/ARTICLE1/renamed.pdf";
  setup({
    fileContents: {
      [downloaded]: "%PDF-1.7 same article",
      [numbered]: "%PDF-1.7 same article",
      [existingPath]: "%PDF-1.7 same article",
    },
    prefs: { deleteSourceAfterImport: true },
  });
  const correct = createRegularItem(harness, { id: 1, title: articleTitle });
  const unrelated = createRegularItem(harness, {
    id: 2,
    title: "Genome editing in drought resistant rice plants",
  });
  createAttachment(harness, {
    id: 3,
    mode: "imported",
    parent: correct,
    path: existingPath,
    title: "Full Text PDF",
  });
  harness.selectedItems = [unrelated, correct];

  await command()();

  assert.deepEqual(importedFiles(), []);
  assert.deepEqual(unrelated.attachmentIDs, []);
  assert.equal(correct.attachmentIDs.length, 1);
  assert.equal(harness.files.has(downloaded), true);
  assert.equal(harness.files.has(numbered), true);
});

for (const mode of ["imported", "linked"]) {
  test(`attach new file skips an existing ${mode} PDF by content and keeps the source`, async () => {
    const downloaded = "/source/download (1).pdf";
    const existingPath = "/dest/renamed-article.pdf";
    setup({
      fileContents: {
        [downloaded]: "%PDF-1.7 same article",
        [existingPath]: "%PDF-1.7 same article",
      },
      prefs: { deleteSourceAfterImport: true },
    });
    const parent = createRegularItem(harness, { id: 1, title: articleTitle });
    const attachment = createAttachment(harness, {
      id: 2,
      mode,
      parent,
      path: existingPath,
      title: "PDF",
    });
    harness.selectedItems = [parent];

    await command("attanger-attach-new-file")();

    assert.deepEqual(importedFiles(), []);
    assert.deepEqual(harness.calls.linkFromFile, []);
    assert.deepEqual(parent.attachmentIDs, [attachment.id]);
    assert.equal(harness.files.has(downloaded), true);
    assert.deepEqual(harness.calls.remove, []);
  });
}

for (const workMode of ["stored", "copy"]) {
  test(`exact Attanger matching skips identical content behind a generic attachment title in ${workMode} mode`, async () => {
    const downloaded = "/source/Expected.pdf";
    const existingPath = "/storage/ARTICLE1/old-name.pdf";
    setup({
      baseName: "Expected",
      fileContents: {
        [downloaded]: "%PDF-1.7 same article",
        [existingPath]: "%PDF-1.7 same article",
      },
      prefs: { workMode, fileTypes: "pdf", deleteSourceAfterImport: true },
    });
    const parent = createRegularItem(harness, {
      id: 1,
      fileBaseName: "Expected",
    });
    const attachment = createAttachment(harness, {
      id: 2,
      mode: "imported",
      parent,
      path: existingPath,
      title: "PDF",
    });
    harness.selectedItems = [parent];

    await command("exact")();

    assert.deepEqual(importedFiles(), []);
    assert.deepEqual(harness.calls.linkFromFile, []);
    assert.deepEqual(parent.attachmentIDs, [attachment.id]);
    assert.equal(harness.files.has(downloaded), true);
    assert.deepEqual(harness.calls.remove, []);
  });
}

test("exact Attanger matching does not mistake an identical PDF title for identical content", async () => {
  const downloaded = "/source/Expected.pdf";
  const existingPath = "/storage/ARTICLE1/Expected.pdf";
  setup({
    baseName: "Expected",
    fileContents: {
      [downloaded]: "%PDF-1.7 new version",
      [existingPath]: "%PDF-1.7 old version",
    },
    prefs: { workMode: "copy", fileTypes: "pdf" },
  });
  const parent = createRegularItem(harness, {
    id: 1,
    fileBaseName: "Expected",
  });
  createAttachment(harness, {
    id: 2,
    mode: "imported",
    parent,
    path: existingPath,
    title: "Expected.pdf",
  });
  harness.selectedItems = [parent];

  await command("exact")();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
  assert.equal(parent.attachmentIDs.length, 2);
  assert.equal(harness.files.has(existingPath), true);
});

for (const [label, title, filename] of [
  [
    "unrelated",
    "Photosynthesis in tropical rainforest ecosystems",
    "Finite element simulation of cracked steel bridges",
  ],
  [
    "weakly similar",
    "Long-term ecological impacts of coral reef bleaching",
    "Long-term economic impacts of coal mine closure",
  ],
]) {
  test(`matching refuses the ${label} best candidate instead of always attaching something`, async () => {
    const downloaded = `/source/${filename}.pdf`;
    setup({ files: [downloaded], prefs: { deleteSourceAfterImport: true } });
    const parent = createRegularItem(harness, { title });
    harness.selectedItems = [parent];

    await command()();

    assert.deepEqual(importedFiles(), []);
    assert.deepEqual(parent.attachmentIDs, []);
    assert.equal(harness.files.has(downloaded), true);
  });
}

test("matching leaves close but distinct candidate PDFs untouched when their titles are ambiguous", async () => {
  const title =
    "Catalytic oxidation of aromatic compounds using iron nanoparticles";
  const water = `/source/${title} in water.pdf`;
  const ethanol = `/source/${title} in ethanol.pdf`;
  setup({
    fileContents: {
      [water]: "%PDF-1.7 study in water",
      [ethanol]: "%PDF-1.7 study in ethanol",
    },
    prefs: { deleteSourceAfterImport: true },
  });
  const parent = createRegularItem(harness, { title });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), []);
  assert.deepEqual(parent.attachmentIDs, []);
  assert.equal(harness.files.has(water), true);
  assert.equal(harness.files.has(ethanol), true);
});

test("identical candidate titles with different PDF bytes remain ambiguous rather than being collapsed as duplicates", async () => {
  const downloaded = `/source/${articleTitle}.pdf`;
  const numbered = `/source/${articleTitle} (1).pdf`;
  setup({
    fileContents: {
      [downloaded]: "%PDF-1.7 first manuscript version",
      [numbered]: "%PDF-1.7 second manuscript version",
    },
    prefs: { deleteSourceAfterImport: true },
  });
  const parent = createRegularItem(harness, { title: articleTitle });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), []);
  assert.deepEqual(parent.attachmentIDs, []);
  assert.equal(harness.files.has(downloaded), true);
  assert.equal(harness.files.has(numbered), true);
});

test("a shorter selected title cannot steal a file that exactly matches a longer selected title", async () => {
  const shortTitle = "Deep learning for molecular property prediction";
  const longTitle = `${shortTitle} with graph neural networks`;
  const downloaded = `/source/${longTitle}.pdf`;
  setup({ files: [downloaded] });
  const shortParent = createRegularItem(harness, { id: 1, title: shortTitle });
  const longParent = createRegularItem(harness, { id: 2, title: longTitle });
  harness.selectedItems = [shortParent, longParent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: longParent.id },
  ]);
  assert.deepEqual(shortParent.attachmentIDs, []);
  assert.equal(longParent.attachmentIDs.length, 1);
});

test("an accurate filename remains usable when the PDF metadata contains a different title", async () => {
  const title =
    "High performance capacitive deionization using nickel hexacyanoferrate electrodes";
  const downloaded = `/source/${title}.pdf`;
  const decoy = "/source/unrelated.pdf";
  setup({
    fileContents: { [downloaded]: "target", [decoy]: "decoy" },
    prefs: { readPDFtitle: "always" },
    pdfWorkerQuery: async () => ({
      metadata: { title: "Annual financial report for coastal development" },
      pages: [],
    }),
  });
  const parent = createRegularItem(harness, { title });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
  assert.equal(harness.files.has(decoy), true);
});

test("the publisher article DOI assigns an identically titled PDF to the right edition", async () => {
  const title =
    "High Performance Capacitive Deionization Cathode of Nickel Hexacyanoferrate";
  const downloaded = "/source/download.pdf";
  const doi = "10.1002/ange.202504775";
  setup({
    fileContents: { [downloaded]: "article" },
    prefs: { readPDFtitle: "always" },
    pdfWorkerQuery: async () => ({
      metadata: { title, "WPS-ARTICLEDOI": doi },
      pages: [
        recognizerPage(
          "Zitierweise: Angew. Chem. Int. Ed. 2025, 64, e202504775 " +
            "doi.org/10.1002/anie.202504775",
          10,
        ),
      ],
    }),
  });
  const international = createArticle({
    id: 1,
    title,
    doi: "10.1002/anie.202504775",
  });
  const original = createArticle({ id: 2, title, doi });
  harness.selectedItems = [international, original];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: original.id },
  ]);
  assert.deepEqual(international.attachmentIDs, []);
});

test("two identically titled edition PDFs are assigned by their own DOIs regardless of item order", async () => {
  const title =
    "High Performance Capacitive Deionization Cathode of Nickel Hexacyanoferrate";
  const originalFile = "/source/original-edition.pdf";
  const internationalFile = "/source/international-edition.pdf";
  const originalDOI = "10.1002/ange.202504775";
  const internationalDOI = "10.1002/anie.202504775";
  setup({
    fileContents: {
      [originalFile]: "original edition bytes",
      [internationalFile]: "international edition bytes",
    },
    prefs: { readPDFtitle: "always" },
    pdfWorkerQuery: async (_action, { buf }) => ({
      metadata: {
        title,
        "WPS-ARTICLEDOI":
          Buffer.from(buf).toString() === "original edition bytes"
            ? originalDOI
            : internationalDOI,
      },
      pages: [],
    }),
  });
  const international = createArticle({ id: 1, title, doi: internationalDOI });
  const original = createArticle({ id: 2, title, doi: originalDOI });
  harness.selectedItems = [international, original];

  await command()();

  assert.deepEqual(
    importedFiles().sort((a, b) => a.parentItemID - b.parentItemID),
    [
      { file: internationalFile, parentItemID: international.id },
      { file: originalFile, parentItemID: original.id },
    ],
  );
});

test("an explicit article DOI outranks a conflicting generic DOI and subject citation", async () => {
  const downloaded = "/source/download.pdf";
  const doi = "10.1002/ange.202504775";
  setup({
    fileContents: { [downloaded]: "article" },
    prefs: { readPDFtitle: "always" },
    pdfWorkerQuery: async () => ({
      metadata: {
        title: "Uninformative publisher document",
        "WPS-ARTICLEDOI": doi,
        doi: "10.1002/anie.202504775",
        subject: "Recommended citation https://doi.org/10.1002/anie.202504775",
      },
      pages: [],
    }),
  });
  const parent = createArticle({ title: articleTitle, doi });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
});

test("reliable DOI evidence can match a truncated item title and a generic download filename", async () => {
  const downloaded = "/source/download.pdf";
  const doi = "10.1021/acsnano.4c17436";
  setup({
    fileContents: { [downloaded]: "article" },
    prefs: { readPDFtitle: "always" },
    pdfWorkerQuery: async () => ({
      metadata: {
        title: "nn4c17436 1..11",
        "WPS-ARTICLEDOI": doi,
      },
      pages: [],
    }),
  });
  const parent = createArticle({
    title: "Boosting Capacitive Deionization in MoS2",
    doi,
  });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
});

test("a conflicting reliable PDF DOI vetoes even an exact filename and title", async () => {
  const title = "Structured catalysts for efficient carbon dioxide reduction";
  const downloaded = `/source/${title}.pdf`;
  setup({
    fileContents: { [downloaded]: "different paper" },
    prefs: { readPDFtitle: "always", deleteSourceAfterImport: true },
    pdfWorkerQuery: async () => ({
      metadata: { title, "WPS-ARTICLEDOI": "10.1002/ange.202504775" },
      pages: [],
    }),
  });
  const parent = createArticle({
    title,
    doi: "10.1002/anie.202504775",
  });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), []);
  assert.deepEqual(parent.attachmentIDs, []);
  assert.equal(harness.files.has(downloaded), true);
});

test("the DOI-bearing SusMat record wins over its identically titled DOI-less duplicate", async () => {
  const title =
    "Electrochemical Strategies for CO2 Capture: Synergistic Integration of Bipolar Membrane Electrodialysis and Capacitive Deionization Across Diverse Carbon Sources";
  const downloaded = "/source/SusMat-download.pdf";
  const doi = "10.1002/sus2.70058";
  setup({
    fileContents: { [downloaded]: "SusMat article" },
    prefs: { readPDFtitle: "always" },
    pdfWorkerQuery: async () => ({
      metadata: { title, "WPS-ARTICLEDOI": doi },
      pages: [],
    }),
  });
  const incomplete = createArticle({ id: 44, title });
  const complete = createArticle({ id: 37, title, doi });
  harness.selectedItems = [incomplete, complete];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: complete.id },
  ]);
  assert.deepEqual(incomplete.attachmentIDs, []);
});

test("multiple conflicting primary PDF DOIs leave a matching title ambiguous", async () => {
  const title = "Structured catalysts for efficient carbon dioxide reduction";
  const downloaded = `/source/${title}.pdf`;
  setup({
    fileContents: { [downloaded]: "ambiguous paper metadata" },
    prefs: { readPDFtitle: "always", deleteSourceAfterImport: true },
    pdfWorkerQuery: async () => ({
      metadata: {
        title,
        "WPS-ARTICLEDOI": "10.1002/ange.202504775 10.1002/ange.202508092",
      },
      pages: [],
    }),
  });
  const parent = createArticle({ title, doi: "10.1002/ange.202504775" });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), []);
  assert.deepEqual(parent.attachmentIDs, []);
  assert.equal(harness.files.has(downloaded), true);
});

test("multiple conflicting primary PDF DOIs cannot be rescued by a DOI-less item's exact title", async () => {
  const title = "Structured catalysts for efficient carbon dioxide reduction";
  const downloaded = `/source/${title}.pdf`;
  setup({
    fileContents: { [downloaded]: "ambiguous paper metadata" },
    prefs: { readPDFtitle: "always", deleteSourceAfterImport: true },
    pdfWorkerQuery: async () => ({
      metadata: {
        title,
        "WPS-ARTICLEDOI": "10.1002/ange.202504775 10.1002/ange.202508092",
      },
      pages: [],
    }),
  });
  const parent = createArticle({ title });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), []);
  assert.deepEqual(parent.attachmentIDs, []);
  assert.equal(harness.files.has(downloaded), true);
});

for (const [label, metadata] of [
  ["generic DOI metadata", { doi: "https://doi.org/10.1021/acsnano.4c17436" }],
  [
    "subject DOI metadata",
    { subject: "Article DOI: https://doi.org/10.1021/acsnano.4c17436" },
  ],
]) {
  test(`${label} can match without an explicit article-DOI field`, async () => {
    const downloaded = "/source/download.pdf";
    setup({
      fileContents: { [downloaded]: "article" },
      prefs: { readPDFtitle: "always" },
      pdfWorkerQuery: async () => ({ metadata, pages: [] }),
    });
    const parent = createArticle({
      title: articleTitle,
      doi: "DOI: 10.1021/ACSNANO.4C17436",
    });
    harness.selectedItems = [parent];

    await command()();

    assert.deepEqual(importedFiles(), [
      { file: downloaded, parentItemID: parent.id },
    ]);
  });
}

test("a DOI in the opening publisher citation is usable when structured metadata has none", async () => {
  const downloaded = "/source/nn4c17436.pdf";
  const doi = "10.1021/acsnano.4c17436";
  setup({
    fileContents: { [downloaded]: "article" },
    prefs: { readPDFtitle: "always" },
    pdfWorkerQuery: async () => ({
      metadata: { title: "nn4c17436 1..11" },
      pages: [recognizerPage(`https://doi.org/${doi}`, 10)],
    }),
  });
  const parent = createArticle({
    title: "Boosting Capacitive Deionization in MoS2",
    doi,
  });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
});

test("an item without DOI still matches a complete PDF title when the PDF has reliable DOI evidence", async () => {
  const title = "Structured catalysts for efficient carbon dioxide reduction";
  const downloaded = "/source/download.pdf";
  setup({
    fileContents: { [downloaded]: "article" },
    prefs: { readPDFtitle: "always" },
    pdfWorkerQuery: async () => ({
      metadata: { title, "WPS-ARTICLEDOI": "10.1002/adfm.202522607" },
      pages: [],
    }),
  });
  const parent = createArticle({ title });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
});

test("never-read mode does not query PDFs to rescue a DOI-only match", async () => {
  const downloaded = "/source/download.pdf";
  const doi = "10.1021/acsnano.4c17436";
  let queries = 0;
  setup({
    fileContents: { [downloaded]: "article" },
    pdfWorkerQuery: async () => {
      queries++;
      return {
        metadata: { "WPS-ARTICLEDOI": doi },
        pages: [],
      };
    },
  });
  const parent = createArticle({
    title: "Boosting Capacitive Deionization in MoS2",
    doi,
  });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), []);
  assert.equal(queries, 0);
  assert.equal(harness.files.has(downloaded), true);
});

for (const [filename, pdfTitle] of [
  ["Supporting Information.pdf", "Supporting Information"],
  ["download.pdf", "Supplementary Materials for Electrode Engineering"],
  ["supporting-info.pdf", "Electrode Engineering for Efficient Ion Capture"],
  [
    "download.pdf",
    "Correction to: Electrode Engineering for Efficient Ion Capture",
  ],
]) {
  test(`a shared article DOI does not turn ${filename} / ${pdfTitle} into the main article`, async () => {
    const downloaded = `/source/${filename}`;
    const doi = "10.1002/adfm.202522607";
    setup({
      fileContents: {
        [downloaded]: "a different document sharing the article DOI",
      },
      prefs: { readPDFtitle: "always", deleteSourceAfterImport: true },
      pdfWorkerQuery: async () => ({
        metadata: { Title: pdfTitle, "WPS-ARTICLEDOI": doi },
        pages: [],
      }),
    });
    const parent = createArticle({
      title: "Electrode Engineering for Efficient Ion Capture",
      doi,
    });
    harness.selectedItems = [parent];

    await command()();

    assert.deepEqual(importedFiles(), []);
    assert.deepEqual(parent.attachmentIDs, []);
    assert.equal(harness.files.has(downloaded), true);
    assert.deepEqual(harness.calls.remove, []);
  });
}

test("never-read mode keeps filename matching even when unread PDF metadata would report another DOI", async () => {
  const title = "Structured catalysts for efficient carbon dioxide reduction";
  const downloaded = `/source/${title}.pdf`;
  let queries = 0;
  setup({
    fileContents: { [downloaded]: "article" },
    pdfWorkerQuery: async () => {
      queries++;
      return {
        metadata: { "WPS-ARTICLEDOI": "10.1002/ange.202504775" },
        pages: [],
      };
    },
  });
  const parent = createArticle({ title, doi: "10.1002/anie.202504775" });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
  assert.equal(queries, 0);
});

test("non-CJK read mode does not use evidence extracted for another item to override a CJK item's filename-only behavior", async () => {
  const title = "\u9ad8\u6027\u80fd\u7535\u5bb9\u53bb\u79bb\u5b50\u7535\u6781";
  const downloaded = "/source/download.pdf";
  const doi = "10.1002/ange.202504775";
  let queries = 0;
  setup({
    fileContents: { [downloaded]: "article" },
    prefs: { readPDFtitle: "nonCJK" },
    pdfWorkerQuery: async () => {
      queries++;
      return { metadata: { title, "WPS-ARTICLEDOI": doi }, pages: [] };
    },
  });
  const cjkParent = createArticle({ id: 1, title, doi });
  const latinParent = createArticle({
    id: 2,
    title: "Genomic adaptation in alpine flowering plants",
    doi: "10.1002/adfm.202522607",
  });
  harness.selectedItems = [cjkParent, latinParent];

  await command()();

  assert.deepEqual(importedFiles(), []);
  assert.equal(queries, 1);
  assert.deepEqual(cjkParent.attachmentIDs, []);
  assert.deepEqual(latinParent.attachmentIDs, []);
});

test("non-CJK read mode does not let another item's extracted supplement role veto an exact CJK filename", async () => {
  const title = "\u9ad8\u6027\u80fd\u7535\u5bb9\u53bb\u79bb\u5b50\u7535\u6781";
  const downloaded = `/source/${title}.pdf`;
  let queries = 0;
  setup({
    fileContents: { [downloaded]: "article with irrelevant producer metadata" },
    prefs: { readPDFtitle: "nonCJK" },
    pdfWorkerQuery: async () => {
      queries++;
      return { metadata: { title: "Supporting Information" }, pages: [] };
    },
  });
  const cjkParent = createArticle({ id: 1, title });
  const latinParent = createArticle({
    id: 2,
    title: "Genomic adaptation in alpine flowering plants",
  });
  harness.selectedItems = [cjkParent, latinParent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: cjkParent.id },
  ]);
  assert.equal(queries, 1);
  assert.equal(cjkParent.attachmentIDs.length, 1);
  assert.deepEqual(latinParent.attachmentIDs, []);
});

test("a later large Appendix heading does not replace the first-page article title", async () => {
  const title =
    "Structured catalysts for low temperature carbon dioxide reduction";
  const downloaded = "/source/download.pdf";
  const decoy = "/source/another-download.pdf";
  setup({
    fileContents: { [downloaded]: "article", [decoy]: "decoy" },
    prefs: { readPDFtitle: "always" },
    pdfWorkerQuery: async (_action, { buf }) =>
      Buffer.from(buf).toString() === "article"
        ? {
            pages: [recognizerPage(title, 24), recognizerPage("Appendix", 60)],
          }
        : {
            metadata: {
              title:
                "Structured catalysts for low temperature methane oxidation",
            },
            pages: [],
          },
  });
  const parent = createRegularItem(harness, { title });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
  assert.equal(harness.files.has(decoy), true);
});

test("journal, year, author prefixes and browser download counters do not hide a matching title", async () => {
  const downloaded = `/source/Angewandte Chemie - 2025 - Wang - ${articleTitle} (1).pdf`;
  setup({ files: [downloaded] });
  const parent = createRegularItem(harness, { title: articleTitle });
  harness.selectedItems = [parent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: downloaded, parentItemID: parent.id },
  ]);
});

for (const [label, title, filename] of [
  [
    "HTML markup and entities",
    "<i>Efficient</i> learning &amp; <sup>2</sup>-dimensional molecular representations",
    "Efficient learning & 2-dimensional molecular representations",
  ],
  [
    "diacritics",
    "R\u00e9sum\u00e9 des propri\u00e9t\u00e9s catalytiques des nanoparticules m\u00e9talliques",
    "Resume des proprietes catalytiques des nanoparticules metalliques",
  ],
  [
    "typographic ligatures",
    "Efficient fluorescence imaging of biological tissues",
    "Ef\ufb01cient \ufb02uorescence imaging of biological tissues",
  ],
]) {
  test(`matching normalizes ${label} without needing PDF recognition`, async () => {
    const downloaded = `/source/${filename}.pdf`;
    let queries = 0;
    setup({
      files: [downloaded],
      pdfWorkerQuery: async () => {
        queries++;
        throw new Error("Filename matching must not recognize PDFs");
      },
    });
    const parent = createRegularItem(harness, { title });
    harness.selectedItems = [parent];

    await command()();

    assert.deepEqual(importedFiles(), [
      { file: downloaded, parentItemID: parent.id },
    ]);
    assert.equal(queries, 0);
  });
}

test("a large download fingerprint failure leaves that source intact and does not abort a separate safe match", async () => {
  const unverifiedTitle = "Unverified mechanisms of catalytic oxygen evolution";
  const safeTitle = "Verified genomic adaptation in alpine flowering plants";
  const unverified = `/source/${unverifiedTitle}.pdf`;
  const safe = `/source/${safeTitle}.pdf`;
  const contents = {
    [unverified]: "%PDF-1.7 unverified bytes",
    [safe]: "%PDF-1.7 verified bytes",
  };
  setup({
    fileContents: contents,
    prefs: { deleteSourceAfterImport: true },
    md5: (filePath) => {
      if (filePath === unverified)
        throw new Error("Download exceeds native hashing size limit");
      return crypto
        .createHash("md5")
        .update(harness.fileContents.get(filePath) || contents[filePath])
        .digest("hex");
    },
  });
  const stat = IOUtils.stat;
  IOUtils.stat = async (filePath) => {
    const result = await stat(filePath);
    return filePath === unverified
      ? { ...result, size: 5 * 1024 ** 3 }
      : result;
  };
  const reads = [];
  const read = IOUtils.read;
  IOUtils.read = async (filePath) => {
    reads.push(filePath);
    return read(filePath);
  };
  const unverifiedParent = createRegularItem(harness, {
    id: 1,
    title: unverifiedTitle,
  });
  const safeParent = createRegularItem(harness, { id: 2, title: safeTitle });
  harness.selectedItems = [unverifiedParent, safeParent];

  await command()();

  assert.deepEqual(importedFiles(), [
    { file: safe, parentItemID: safeParent.id },
  ]);
  assert.deepEqual(unverifiedParent.attachmentIDs, []);
  assert.equal(harness.files.has(unverified), true);
  assert.equal(harness.files.has(safe), false);
  assert.equal(reads.includes(unverified), false);
});

for (const [label, title, filename] of [
  [
    "a different clinical trial phase",
    "Phase 2 randomized trial of targeted immunotherapy",
    "Phase 3 randomized trial of targeted immunotherapy",
  ],
  [
    "a negated scientific finding",
    "Copper doping improves photocatalytic activity of titanium dioxide",
    "Copper doping does not improve photocatalytic activity of titanium dioxide",
  ],
]) {
  test(`matching rejects ${label} despite high textual similarity`, async () => {
    const downloaded = `/source/${filename}.pdf`;
    setup({ files: [downloaded], prefs: { deleteSourceAfterImport: true } });
    const parent = createRegularItem(harness, { title });
    harness.selectedItems = [parent];

    await command()();

    assert.deepEqual(importedFiles(), []);
    assert.deepEqual(parent.attachmentIDs, []);
    assert.equal(harness.files.has(downloaded), true);
  });
}
