const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const esbuild = require("esbuild");
const {
  PREF_PREFIX,
  createAttachment,
  createHarness,
  createRegularItem,
} = require("./helpers/menuHarness.cjs");

let harness;

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
});

function setupStoredAttachment(workMode, options = {}) {
  harness = createHarness({
    directories: ["/source", "/dest", "/storage", "/storage/PAPER001"],
    files: ["/storage/PAPER001/paper.pdf"],
    fileContents: { "/storage/PAPER001/paper.pdf": "original PDF" },
    ...options,
    prefs: {
      workMode,
      destDir: "/dest",
      subfolderFormat: "",
      autoMove: true,
      ...options.prefs,
    },
  });
  const parent = createRegularItem(harness, {
    id: 1,
    libraryID: options.attachment?.libraryID || 1,
  });
  const attachment = createAttachment(harness, {
    id: 2,
    key: "PAPER001",
    mode: "imported",
    parent,
    path: "/storage/PAPER001/paper.pdf",
    ...options.attachment,
  });
  return { parent, attachment };
}

const REGISTRY_PATH = "/zotero/attanger-external-copies.json";

function loadSourceModule(relativePath) {
  const result = esbuild.buildSync({
    entryPoints: [path.join(process.cwd(), relativePath)],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    logLevel: "silent",
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(
    module,
    module.exports,
    require,
  );
  return module.exports;
}

function loadWorkModeModule() {
  return loadSourceModule("src/utils/workMode.ts");
}

function readCopies() {
  const value = harness.fileContents.get(REGISTRY_PATH);
  return value ? JSON.parse(value.toString()).copies : {};
}

async function organize(workMode, attachment, options = { silent: true }) {
  return workMode === "copy"
    ? harness.module.mirrorAttachment(attachment, options)
    : harness.module.moveFile(attachment, options);
}

function rootMenu() {
  return harness.menuRegistrations.find(
    ({ config }) => config.id === "attanger-menu",
  ).config;
}

function menuItem(id) {
  return rootMenu().children.find((child) => child.id === id);
}

// ---------------------------------------------------------------------------
// Migration keeps old preferences meaningful.

test("fresh setup selects stored mode", () => {
  harness = createHarness({
    prefs: { workMode: "", destDir: "", attachType: "linking" },
  });

  loadWorkModeModule().initializeWorkMode();

  assert.equal(harness.prefs.get(`${PREF_PREFIX}.workMode`), "stored");
  assert.equal(
    harness.prefs.get(`${PREF_PREFIX}.deleteSourceAfterImport`),
    true,
  );
});

test("legacy linking with a destination migrates to linked and keeps its switches", () => {
  harness = createHarness({
    prefs: {
      workMode: "",
      destDir: "/dest",
      attachType: "linking",
      autoMove: false,
      moveWithoutDeleting: true,
    },
  });

  loadWorkModeModule().initializeWorkMode();

  assert.equal(harness.prefs.get(`${PREF_PREFIX}.workMode`), "linked");
  assert.equal(harness.prefs.get(`${PREF_PREFIX}.autoMove`), false);
  assert.equal(harness.prefs.get(`${PREF_PREFIX}.moveWithoutDeleting`), true);
  assert.equal(
    harness.prefs.get(`${PREF_PREFIX}.deleteSourceAfterImport`),
    false,
  );
});

test("legacy stored-copy attach type migrates to stored", () => {
  harness = createHarness({
    prefs: { workMode: "", destDir: "/dest", attachType: "importing" },
  });

  loadWorkModeModule().initializeWorkMode();

  assert.equal(harness.prefs.get(`${PREF_PREFIX}.workMode`), "stored");
});

test("initialization preserves an explicit mode and maps the development keep value", () => {
  harness = createHarness({
    prefs: {
      workMode: "copy",
      attachType: "linking",
      moveWithoutDeleting: true,
    },
  });
  const workMode = loadWorkModeModule();
  workMode.initializeWorkMode();
  assert.equal(harness.prefs.get(`${PREF_PREFIX}.workMode`), "copy");
  assert.equal(
    harness.prefs.get(`${PREF_PREFIX}.deleteSourceAfterImport`),
    undefined,
  );

  harness.setPref("workMode", "keep");
  workMode.initializeWorkMode();
  assert.equal(harness.prefs.get(`${PREF_PREFIX}.workMode`), "stored");
});

test("setting a mode keeps the legacy attach type in step", () => {
  harness = createHarness({ prefs: { workMode: "stored" } });
  const workMode = loadWorkModeModule();

  workMode.setWorkMode("linked");
  assert.equal(harness.prefs.get(`${PREF_PREFIX}.attachType`), "linking");
  workMode.setWorkMode("copy");
  assert.equal(harness.prefs.get(`${PREF_PREFIX}.attachType`), "importing");
});

// ---------------------------------------------------------------------------
// Stored mode.

test("stored mode leaves stored and linked attachments in place", async () => {
  const { attachment, parent } = setupStoredAttachment("stored");
  harness.writeFile("/source/linked.pdf", "linked");
  const linked = createAttachment(harness, {
    id: 3,
    mode: "linked",
    parent,
    path: "/source/linked.pdf",
  });

  assert.equal(
    await harness.module.moveFile(attachment, { silent: true }),
    undefined,
  );
  assert.equal(
    await harness.module.moveFile(linked, { silent: true }),
    undefined,
  );

  assert.equal(attachment.isImportedAttachment(), true);
  assert.equal(await linked.getFilePathAsync(), "/source/linked.pdf");
  assert.deepEqual(harness.calls.copy, []);
  assert.deepEqual(harness.calls.newItems, []);
});

test("stored mode hides Move and turns Rename and Move into a rename", async () => {
  const { attachment } = setupStoredAttachment("stored", {
    baseName: "Renamed",
  });
  harness.selectedItems = [attachment];
  const menu = new harness.module.default();

  assert.equal(menuItem("attanger-move-attachment").isHidden(), true);
  assert.equal(
    menuItem("attanger-rename-move-attachment").label,
    "zoteroattanger-rename-attachment",
  );
  await menuItem("attanger-rename-move-attachment").commandListener();

  assert.deepEqual(attachment.calls.rename, ["Renamed.pdf"]);
  assert.equal(attachment.isImportedAttachment(), true);
  assert.deepEqual(harness.calls.copy, []);
  menu.dispose();
});

test("new stored-mode attachments ignore the linked-mode automatic move switch", async () => {
  const { attachment } = setupStoredAttachment("stored", {
    prefs: { autoMove: true, attachType: "linking" },
  });
  const menu = new harness.module.default();

  await menu.processAddedAttachment(attachment);

  assert.equal(attachment.isImportedAttachment(), true);
  assert.deepEqual(harness.calls.copy, []);
  assert.deepEqual(harness.calls.newItems, []);
  menu.dispose();
});

test("switching work mode does not convert existing attachments", async () => {
  const { attachment } = setupStoredAttachment("stored");
  const menu = new harness.module.default();

  harness.setPref("workMode", "linked");
  menu.refreshItemMenu();
  harness.setPref("workMode", "copy");
  menu.refreshItemMenu();
  await harness.clock.runAll();

  assert.equal(harness.items.get(attachment.id), attachment);
  assert.equal(attachment.isImportedAttachment(), true);
  assert.deepEqual(harness.calls.copy, []);
  assert.deepEqual(harness.calls.newItems, []);
  menu.dispose();
});

// ---------------------------------------------------------------------------
// Linked mode keeps the old behavior.

test("new linked-mode attachments move only when automatic moving is enabled", async () => {
  for (const autoMove of [false, true]) {
    const { attachment } = setupStoredAttachment("linked", {
      prefs: { autoMove },
    });
    const menu = new harness.module.default();

    await menu.processAddedAttachment(attachment);

    const linked = [...harness.items.values()].filter(
      (item) => item.isAttachment?.() && item.isLinkedFileAttachment(),
    );
    assert.equal(linked.length, autoMove ? 1 : 0, `autoMove=${autoMove}`);
    assert.equal(harness.files.has("/dest/paper.pdf"), autoMove);
    menu.dispose();
    harness.cleanup();
  }
  harness = undefined;
});

test("manual Move still works when automatic moving is disabled", async () => {
  const { attachment } = setupStoredAttachment("linked", {
    prefs: { autoMove: false },
  });
  harness.selectedItems = [attachment];
  const menu = new harness.module.default();

  assert.equal(menuItem("attanger-move-attachment").isHidden(), false);
  assert.equal(
    menuItem("attanger-move-attachment").label,
    "zoteroattanger-move-attachment",
  );
  await menuItem("attanger-move-attachment").commandListener();

  const linked = [...harness.items.values()].find(
    (item) => item.isAttachment?.() && item.isLinkedFileAttachment(),
  );
  assert.equal(await linked.getFilePathAsync(), "/dest/paper.pdf");
  assert.equal(harness.items.has(attachment.id), false);
  menu.dispose();
});

test("linked mode removes the old linked source after a verified move", async () => {
  harness = createHarness({
    directories: ["/old", "/dest"],
    files: ["/old/paper.pdf"],
    prefs: { workMode: "linked", destDir: "/dest", subfolderFormat: "" },
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, {
    mode: "linked",
    parent,
    path: "/old/paper.pdf",
  });

  await harness.module.moveFile(attachment, { silent: true });

  assert.equal(await attachment.getFilePathAsync(), "/dest/paper.pdf");
  assert.equal(harness.files.has("/old/paper.pdf"), false);
});

test("empty-folder cleanup still covers the source directory and ignores Finder metadata", async () => {
  harness = createHarness({
    directories: ["/source", "/source/papers", "/dest"],
    files: ["/source/papers/paper.pdf", "/source/papers/.DS_Store"],
    prefs: {
      workMode: "linked",
      sourceDir: "/source",
      destDir: "/dest",
      subfolderFormat: "",
      autoRemoveEmptyFolder: true,
    },
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, {
    mode: "linked",
    parent,
    path: "/source/papers/paper.pdf",
  });

  await harness.module.moveFile(attachment, { silent: true });

  assert.equal(await attachment.getFilePathAsync(), "/dest/paper.pdf");
  assert.equal(harness.directories.has("/source/papers"), false);
  assert.equal(harness.directories.has("/source"), true);
});

test("linked mode accepts a destination reached through a symlinked cloud folder", async () => {
  harness = createHarness({
    directories: ["/old", "/Users/me/Dropbox", "/real/Dropbox", "/storage"],
    files: ["/old/paper.pdf"],
    symlinks: { "/Users/me/Dropbox": "/real/Dropbox" },
    prefs: {
      workMode: "linked",
      destDir: "/Users/me/Dropbox",
      subfolderFormat: "",
    },
  });
  const core = loadSourceModule("src/modules/attachmentFiles.ts");

  assert.equal(core.isZoteroStoragePath("/Users/me/Dropbox/paper.pdf"), false);
  assert.equal(core.isZoteroStoragePath("/Users/me/Dropbox/new/a.pdf"), false);
});

test("keeping originals makes linked-mode moves copy and relabels the menu", async () => {
  harness = createHarness({
    directories: ["/old", "/dest"],
    files: ["/old/paper.pdf"],
    prefs: {
      workMode: "linked",
      destDir: "/dest",
      subfolderFormat: "",
      moveWithoutDeleting: true,
    },
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, {
    mode: "linked",
    parent,
    path: "/old/paper.pdf",
  });
  const menu = new harness.module.default();

  await harness.module.moveFile(attachment, { silent: true });

  assert.equal(await attachment.getFilePathAsync(), "/dest/paper.pdf");
  assert.equal(harness.files.has("/old/paper.pdf"), true);
  assert.equal(
    menuItem("attanger-move-attachment").label,
    "zoteroattanger-copy-attachment",
  );
  assert.equal(
    menuItem("attanger-rename-move-attachment").label,
    "zoteroattanger-rename-copy-attachment",
  );
  assert.equal(
    menuItem("attanger-undo-move-attachment").label,
    "zoteroattanger-undo-copy-attachment",
  );
  menu.dispose();
});

test("linked mode keeps an old source that another attachment still uses", async () => {
  harness = createHarness({
    directories: ["/old", "/dest"],
    files: ["/old/paper.pdf"],
    prefs: { workMode: "linked", destDir: "/dest", subfolderFormat: "" },
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, {
    id: 2,
    mode: "linked",
    parent,
    path: "/old/paper.pdf",
  });
  createAttachment(harness, {
    id: 3,
    mode: "linked",
    parent,
    path: "/old/paper.pdf",
  });

  await harness.module.moveFile(attachment, { silent: true });

  assert.equal(await attachment.getFilePathAsync(), "/dest/paper.pdf");
  assert.equal(harness.files.has("/old/paper.pdf"), true);
});

test("undo uses Zotero's native conversion to stored files", async () => {
  let converted = 0;
  setupStoredAttachment("linked");
  ZoteroPane.convertLinkedFilesToStoredFiles = async () => {
    converted++;
  };
  const menu = new harness.module.default();

  await menuItem("attanger-undo-move-attachment").commandListener();

  assert.equal(converted, 1);
  menu.dispose();
});

// ---------------------------------------------------------------------------
// Source folder inputs.

for (const [deleteSourceAfterImport, expected] of [
  [true, false],
  [false, true],
]) {
  test(`attach new file ${expected ? "keeps" : "deletes"} the input when deleteSourceAfterImport=${deleteSourceAfterImport}`, async () => {
    for (const workMode of ["stored", "copy", "linked"]) {
      harness = createHarness({
        directories: ["/source", "/dest"],
        files: ["/source/input.pdf"],
        prefs: {
          workMode,
          sourceDir: "/source",
          destDir: "/dest",
          subfolderFormat: "",
          deleteSourceAfterImport,
        },
      });
      harness.selectedItems = [createRegularItem(harness)];
      const menu = new harness.module.default();

      await menuItem("attanger-attach-new-file").commandListener();

      assert.equal(harness.calls.importFromFile.length, 1);
      assert.equal(
        harness.files.has("/source/input.pdf"),
        expected,
        `${workMode} source input`,
      );
      menu.dispose();
      harness.cleanup();
    }
    harness = undefined;
  });
}

test("attach new file picks the newest file across all download folders", async () => {
  harness = createHarness({
    directories: ["/source", "/downloads-2", "/dest"],
    files: ["/source/old.pdf", "/downloads-2/new.pdf"],
    modifiedTimes: { "/source/old.pdf": 10, "/downloads-2/new.pdf": 20 },
    prefs: {
      workMode: "stored",
      sourceDir: "/source",
      extraSourceDirs: '["/downloads-2"]',
      subfolderFormat: "",
      deleteSourceAfterImport: true,
    },
  });
  harness.selectedItems = [createRegularItem(harness)];
  const menu = new harness.module.default();

  await menuItem("attanger-attach-new-file").commandListener();

  assert.equal(harness.calls.importFromFile.length, 1);
  assert.equal(harness.files.has("/downloads-2/new.pdf"), false);
  assert.equal(harness.files.has("/source/old.pdf"), true);
  menu.dispose();
});

test("exact matching searches extra download folders after the primary one", async () => {
  harness = createHarness({
    baseName: "Expected",
    directories: ["/source", "/downloads-2", "/dest"],
    files: ["/downloads-2/Expected.pdf"],
    prefs: {
      workMode: "linked",
      sourceDir: "/source",
      extraSourceDirs: '["/downloads-2", "/missing"]',
      destDir: "/dest",
      fileTypes: "pdf",
      subfolderFormat: "",
    },
  });
  harness.selectedItems = [
    createRegularItem(harness, { fileBaseName: "Expected" }),
  ];
  const menu = new harness.module.default();
  const exactMatch = rootMenu().children.find(
    (child) => child.label === "zoteroattanger-match-attanger-attachment",
  );

  await exactMatch.commandListener();

  assert.equal(harness.calls.linkFromFile.length, 1);
  assert.equal(harness.calls.linkFromFile[0].file, "/downloads-2/Expected.pdf");
  menu.dispose();
});

test("exact matching links files as before and imports only in copy mode", async () => {
  for (const workMode of ["linked", "stored", "copy"]) {
    harness = createHarness({
      baseName: "Expected",
      directories: ["/source", "/dest"],
      files: ["/source/Expected.pdf"],
      prefs: {
        workMode,
        sourceDir: "/source",
        destDir: "/dest",
        fileTypes: "pdf",
        subfolderFormat: "",
      },
    });
    const parent = createRegularItem(harness, { fileBaseName: "Expected" });
    harness.selectedItems = [parent];
    const menu = new harness.module.default();
    const exactMatch = rootMenu().children.find(
      (child) => child.label === "zoteroattanger-match-attanger-attachment",
    );

    await exactMatch.commandListener();

    assert.equal(
      harness.calls.linkFromFile.length,
      workMode === "copy" ? 0 : 1,
    );
    assert.equal(
      harness.calls.importFromFile.length,
      workMode === "copy" ? 1 : 0,
    );
    menu.dispose();
    harness.cleanup();
  }
  harness = undefined;
});

// ---------------------------------------------------------------------------
// Copy mode: Zotero storage plus a one-way external copy.

test("copy mode keeps the stored attachment and writes a verified copy", async () => {
  const { attachment } = setupStoredAttachment("copy");

  const result = await harness.module.mirrorAttachment(attachment, {
    silent: true,
  });

  assert.equal(result.status, "created");
  assert.equal(harness.items.get(attachment.id), attachment);
  assert.equal(attachment.isImportedAttachment(), true);
  assert.equal(attachment.calls.erase, 0);
  assert.deepEqual(harness.calls.newItems, []);
  assert.deepEqual(
    harness.fileContents.get("/dest/paper.pdf"),
    harness.fileContents.get("/storage/PAPER001/paper.pdf"),
  );
  const copies = Object.values(readCopies());
  assert.equal(copies.length, 1);
  assert.equal(copies[0].key, "PAPER001");
  assert.equal(copies[0].path, "/dest/paper.pdf");
});

test("copy mode does not move files through moveFile", async () => {
  const { attachment } = setupStoredAttachment("copy");

  assert.equal(
    await harness.module.moveFile(attachment, { silent: true }),
    undefined,
  );
  assert.deepEqual(harness.calls.copy, []);
});

test("repeating a sync reuses the existing copy", async () => {
  const { attachment } = setupStoredAttachment("copy");

  await harness.module.mirrorAttachment(attachment, { silent: true });
  const result = await harness.module.mirrorAttachment(attachment, {
    silent: true,
  });

  assert.equal(result.status, "unchanged");
  assert.deepEqual(
    [...harness.files].filter((file) => file.startsWith("/dest/")),
    ["/dest/paper.pdf"],
  );
});

test("copy mode refreshes the copy after the stored file changes", async () => {
  const { attachment } = setupStoredAttachment("copy");
  await harness.module.mirrorAttachment(attachment, { silent: true });
  harness.writeFile("/storage/PAPER001/paper.pdf", "updated PDF");

  const result = await harness.module.mirrorAttachment(attachment, {
    silent: true,
  });

  assert.equal(result.status, "updated");
  assert.equal(
    harness.fileContents.get("/dest/paper.pdf").toString(),
    "updated PDF",
  );
});

test("renaming in copy mode moves the copy and removes the old one", async () => {
  const { attachment } = setupStoredAttachment("copy", { baseName: "Renamed" });
  await harness.module.mirrorAttachment(attachment, { silent: true });
  harness.selectedItems = [attachment];
  const menu = new harness.module.default();

  assert.equal(
    menuItem("attanger-rename-move-attachment").label,
    "zoteroattanger-rename-sync-copy-attachment",
  );
  await menuItem("attanger-rename-move-attachment").commandListener();

  assert.equal(attachment.key, "PAPER001");
  assert.equal(attachment.isImportedAttachment(), true);
  assert.equal(harness.files.has("/dest/Renamed.pdf"), true);
  assert.equal(harness.files.has("/dest/paper.pdf"), false);
  assert.equal(Object.values(readCopies())[0].path, "/dest/Renamed.pdf");
  menu.dispose();
});

test("a collection change moves the copy to the new subfolder on notification", async () => {
  const { attachment, parent } = setupStoredAttachment("copy", {
    prefs: { subfolderFormat: "{{collection}}" },
  });
  harness.items.set(50, { id: 50, name: "Old", parentID: undefined });
  harness.items.set(51, { id: 51, name: "New", parentID: undefined });
  parent.collectionIDs = [50];
  await harness.module.mirrorAttachment(attachment, { silent: true });
  assert.equal(harness.files.has("/dest/Old/paper.pdf"), true);
  const menu = new harness.module.default();

  parent.collectionIDs = [51];
  for (const observer of harness.observers.values()) {
    await observer.notify("add", "collection-item", [`51-${parent.id}`], {});
  }
  await harness.clock.runAll();

  assert.equal(harness.files.has("/dest/New/paper.pdf"), true);
  assert.equal(harness.files.has("/dest/Old/paper.pdf"), false);
  assert.equal(Object.values(readCopies())[0].path, "/dest/New/paper.pdf");
  menu.dispose();
});

test("an externally edited copy is never overwritten", async () => {
  const { attachment } = setupStoredAttachment("copy");
  await harness.module.mirrorAttachment(attachment, { silent: true });
  harness.writeFile("/dest/paper.pdf", "edited outside Zotero");
  harness.writeFile("/storage/PAPER001/paper.pdf", "edited inside Zotero");

  const result = await harness.module.mirrorAttachment(attachment, {
    silent: true,
  });

  assert.equal(result.status, "conflict");
  assert.equal(
    harness.fileContents.get("/dest/paper.pdf").toString(),
    "edited outside Zotero",
  );
});

test("an edited old copy is kept when the destination changes", async () => {
  const { attachment } = setupStoredAttachment("copy", { baseName: "Renamed" });
  await harness.module.mirrorAttachment(attachment, { silent: true });
  harness.writeFile("/dest/paper.pdf", "user notes");
  await attachment.renameAttachmentFile("Renamed.pdf");

  const result = await harness.module.mirrorAttachment(attachment, {
    silent: true,
  });

  assert.equal(result.status, "moved");
  assert.equal(result.retainedPath, "/dest/paper.pdf");
  assert.equal(
    harness.fileContents.get("/dest/paper.pdf").toString(),
    "user notes",
  );
  assert.equal(harness.files.has("/dest/Renamed.pdf"), true);
});

test("copy mode allocates a unique path instead of replacing an unrelated file", async () => {
  const { attachment } = setupStoredAttachment("copy", {
    fileContents: {
      "/storage/PAPER001/paper.pdf": "original PDF",
      "/dest/paper.pdf": "someone else's PDF",
    },
  });

  await harness.module.mirrorAttachment(attachment, { silent: true });

  assert.equal(
    harness.fileContents.get("/dest/paper.pdf").toString(),
    "someone else's PDF",
  );
  assert.equal(Object.values(readCopies())[0].path, "/dest/paper_1.pdf");
});

test("copy mode skips linked attachments", async () => {
  harness = createHarness({
    files: ["/source/paper.pdf"],
    prefs: { workMode: "copy", destDir: "/dest", subfolderFormat: "" },
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, {
    mode: "linked",
    parent,
    path: "/source/paper.pdf",
  });

  const result = await harness.module.mirrorAttachment(attachment, {
    silent: true,
  });

  assert.equal(result.status, "skipped-linked");
  assert.deepEqual(harness.calls.copy, []);
  assert.deepEqual(harness.calls.importFromFile, []);
});

test("new copy-mode attachments are renamed first and then copied", async () => {
  const { attachment } = setupStoredAttachment("copy", {
    autoRenameFiles: true,
    baseName: "Renamed",
    prefs: { autoMove: false },
  });
  const menu = new harness.module.default();

  await menu.processAddedAttachment(attachment);

  assert.equal(attachment.isImportedAttachment(), true);
  assert.equal(harness.files.has("/dest/Renamed.pdf"), true);
  assert.equal(harness.files.has("/dest/paper.pdf"), false);
  menu.dispose();
});

test("modify notifications refresh existing copies only", async () => {
  const { attachment, parent } = setupStoredAttachment("copy");
  harness.writeFile("/storage/PAPER002/other.pdf", "other");
  const other = createAttachment(harness, {
    id: 3,
    key: "PAPER002",
    mode: "imported",
    parent,
    path: "/storage/PAPER002/other.pdf",
  });
  await harness.module.mirrorAttachment(attachment, { silent: true });
  const menu = new harness.module.default();
  harness.writeFile("/storage/PAPER001/paper.pdf", "reader-saved annotations");

  await harness.notify("modify", [attachment.id, other.id]);
  await harness.clock.runAll();

  assert.equal(
    harness.fileContents.get("/dest/paper.pdf").toString(),
    "reader-saved annotations",
  );
  assert.equal(harness.files.has("/dest/other.pdf"), false);
  assert.equal(harness.clock.intervals.size, 0);
  menu.dispose();
});

test("disposing the menu cancels queued copy updates", async () => {
  const { attachment } = setupStoredAttachment("copy");
  await harness.module.mirrorAttachment(attachment, { silent: true });
  const menu = new harness.module.default();
  harness.writeFile("/storage/PAPER001/paper.pdf", "changed");
  await harness.notify("modify", [attachment.id]);
  assert.ok(harness.clock.tasks.size);

  menu.dispose();
  await harness.clock.runAll();

  assert.equal(harness.observers.size, 0);
  assert.equal(
    harness.fileContents.get("/dest/paper.pdf").toString(),
    "original PDF",
  );
});

test("deleting the Zotero attachment keeps its external copy", async () => {
  const { attachment } = setupStoredAttachment("copy");
  await harness.module.mirrorAttachment(attachment, { silent: true });
  const menu = new harness.module.default();

  await attachment.eraseTx();
  await harness.notify("delete", [attachment.id]);
  await harness.clock.runAll();

  assert.equal(harness.files.has("/dest/paper.pdf"), true);
  menu.dispose();
});

test("preferences expose three work modes and linked-only legacy switches", () => {
  const preferences = fs.readFileSync(
    path.join(process.cwd(), "addon/chrome/content/preferences.xhtml"),
    "utf8",
  );

  assert.match(preferences, /<radiogroup\s+id="work-mode"[^>]+\.workMode"/);
  for (const workMode of ["stored", "linked", "copy"]) {
    assert.match(preferences, new RegExp(`<radio\\s+[^>]*value="${workMode}"`));
  }
  assert.doesNotMatch(preferences, /preference="[^"]*\.attachType"/);
  assert.match(
    preferences,
    /data-work-mode="linked"[\s\S]*?\.autoMove"[\s\S]*?\.moveWithoutDeleting"/,
  );
  assert.match(preferences, /\.deleteSourceAfterImport"/);
  assert.match(preferences, /id="dest-setting"[^>]*hidden="true"/);
  assert.match(preferences, /id="target-layout-settings"[^>]*hidden="true"/);
  assert.doesNotMatch(preferences, /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});

test("a linked attachment is reorganized by relinking the same item", async () => {
  harness = createHarness({
    directories: ["/source", "/dest"],
    files: ["/source/paper.pdf"],
    prefs: { workMode: "linked", destDir: "/dest", subfolderFormat: "" },
  });
  const parent = createRegularItem(harness);
  const attachment = createAttachment(harness, {
    id: 2,
    mode: "linked",
    parent,
    path: "/source/paper.pdf",
  });

  const result = await harness.module.moveFile(attachment, { silent: true });

  assert.equal(result, attachment);
  assert.equal(harness.items.get(attachment.id), attachment);
  assert.equal(await attachment.getFilePathAsync(), "/dest/paper.pdf");
  assert.deepEqual(attachment.calls.relink, ["/dest/paper.pdf"]);
  assert.equal(attachment.calls.erase, 0);
  assert.deepEqual(harness.calls.newItems, []);
  assert.equal(harness.files.has("/dest/paper.pdf"), true);
});

test("renaming one of two linked attachments preserves the shared original path", async () => {
  harness = createHarness({
    baseName: "New-Name",
    directories: ["/source", "/dest"],
    files: ["/source/shared.pdf"],
    fileContents: { "/source/shared.pdf": "shared user file" },
    prefs: { workMode: "linked" },
  });
  const parent = createRegularItem(harness);
  const selected = createAttachment(harness, {
    id: 2,
    parent,
    mode: "linked",
    path: "/source/shared.pdf",
  });
  const other = createAttachment(harness, {
    id: 3,
    parent,
    mode: "linked",
    path: "/source/shared.pdf",
  });
  harness.selectedItems = [selected];
  const menu = new harness.module.default();
  const rootMenu = harness.menuRegistrations.find(
    ({ config }) => config.id === "attanger-menu",
  ).config;

  await rootMenu.children
    .find((child) => child.id === "attanger-rename-attachment")
    .commandListener();

  assert.equal(await selected.getFilePathAsync(), "/source/New-Name.pdf");
  assert.equal(await other.getFilePathAsync(), "/source/shared.pdf");
  assert.equal(
    harness.fileContents.get("/source/shared.pdf").toString(),
    "shared user file",
  );
  assert.equal(harness.files.has("/source/New-Name.pdf"), true);
  assert.deepEqual(selected.calls.rename, []);
  assert.deepEqual(selected.calls.relink, ["/source/New-Name.pdf"]);
  assert.equal(harness.items.get(selected.id), selected);
  menu.dispose();
});

test("linked mode rejects a group-library attachment before any file copy", async () => {
  const { attachment } = setupStoredAttachment("linked", {
    attachment: { libraryID: 2 },
  });

  const result = await harness.module.moveFile(attachment, { silent: true });

  assert.equal(result, undefined);
  assert.deepEqual(harness.calls.copy, []);
  assert.equal(harness.files.has("/storage/PAPER001/paper.pdf"), true);
  assert.equal(attachment.calls.erase, 0);
});

test("linked mode rejects a read-only library before any file copy", async () => {
  const { attachment } = setupStoredAttachment("linked", {
    readOnlyLibraries: [1],
  });

  const result = await harness.module.moveFile(attachment, { silent: true });

  assert.equal(result, undefined);
  assert.deepEqual(harness.calls.copy, []);
  assert.equal(harness.files.has("/storage/PAPER001/paper.pdf"), true);
  assert.equal(attachment.calls.erase, 0);
});

test("stored-to-linked conversion keeps the stored PDF until the database save succeeds", async () => {
  let savedWithSourcePresent = false;
  const { attachment } = setupStoredAttachment("linked", {
    onCreatedItemSave: async (_item, currentHarness) => {
      assert.equal(
        currentHarness.files.has("/storage/PAPER001/paper.pdf"),
        true,
      );
      savedWithSourcePresent = true;
    },
  });

  const result = await harness.module.moveFile(attachment, { silent: true });

  assert.ok(result?.isLinkedFileAttachment());
  assert.equal(savedWithSourcePresent, true);
  assert.equal(harness.files.has("/dest/paper.pdf"), true);
  assert.equal(harness.files.has("/storage/PAPER001/paper.pdf"), false);
  assert.equal(attachment.calls.erase, 1);
});

test("a failed stored-to-linked database save leaves the stored PDF available", async () => {
  const { attachment } = setupStoredAttachment("linked", {
    onCreatedItemSave: async () => {
      throw new Error("attachment save failed");
    },
  });

  await harness.module.moveFile(attachment, { silent: true });

  assert.equal(harness.files.has("/storage/PAPER001/paper.pdf"), true);
  assert.equal(harness.items.get(attachment.id), attachment);
  assert.equal(attachment.calls.erase, 0);
  assert.equal(attachment.isImportedAttachment(), true);
});

test("stored-to-linked conversion preserves attachment metadata and transfers annotations", async () => {
  const { attachment } = setupStoredAttachment("linked", {
    attachment: {
      title: "Author supplied title",
      note: "Attachment note",
      tags: [{ tag: "reviewed", type: 0 }],
    },
  });
  const annotation = {
    id: 3,
    libraryID: 1,
    parentItemID: attachment.id,
    parentItem: attachment,
    isAttachment: () => false,
    isAnnotation: () => true,
    async save() {
      this.parentItem = harness.items.get(this.parentItemID);
    },
  };
  harness.items.set(annotation.id, annotation);

  const replacement = await harness.module.moveFile(attachment, {
    silent: true,
  });

  assert.ok(replacement?.isLinkedFileAttachment());
  assert.equal(replacement.getField("title"), "Author supplied title");
  assert.equal(replacement.getNote(), "Attachment note");
  assert.deepEqual(replacement.getTags(), [{ tag: "reviewed", type: 0 }]);
  assert.equal(annotation.parentItemID, replacement.id);
  assert.deepEqual(harness.calls.copyRelations, [
    [attachment.id, replacement.id],
  ]);
  assert.deepEqual(harness.calls.transferIndex, [
    [attachment.id, replacement.id],
  ]);
  assert.equal(harness.items.has(attachment.id), false);
});

test("a failed metadata migration rolls back annotation parents and preserves the stored original", async () => {
  const { attachment } = setupStoredAttachment("linked", {
    transferItemIndex: async () => {
      throw new Error("index migration failed");
    },
  });
  const annotation = {
    id: 3,
    libraryID: 1,
    parentItemID: attachment.id,
    parentItem: attachment,
    isAttachment: () => false,
    isAnnotation: () => true,
    async save() {
      this.parentItem = harness.items.get(this.parentItemID);
    },
  };
  harness.items.set(annotation.id, annotation);

  const result = await harness.module.moveFile(attachment, { silent: true });

  assert.equal(result, undefined);
  assert.equal(harness.items.get(attachment.id), attachment);
  assert.equal(annotation.parentItemID, attachment.id);
  assert.equal(annotation.parentItem, attachment);
  assert.equal(attachment.deleted, false);
  assert.equal(attachment.calls.erase, 0);
  assert.equal(harness.files.has("/storage/PAPER001/paper.pdf"), true);
});

test("conversion preserves trashed and external annotations and child notes", async () => {
  const { attachment } = setupStoredAttachment("linked");
  const children = [
    {
      id: 3,
      deleted: true,
      annotationIsExternal: false,
      isAnnotation: () => true,
    },
    {
      id: 4,
      deleted: false,
      annotationIsExternal: true,
      isAnnotation: () => true,
    },
    { id: 5, deleted: false, isNote: () => true, note: "Child note" },
  ].map((data) => ({
    ...data,
    libraryID: attachment.libraryID,
    parentItemID: attachment.id,
    parentItem: attachment,
    isAttachment: () => false,
    async save() {
      this.parentItem = harness.items.get(this.parentItemID);
    },
  }));
  for (const child of children) harness.items.set(child.id, child);

  const replacement = await harness.module.moveFile(attachment, {
    silent: true,
  });

  assert.ok(replacement?.isLinkedFileAttachment());
  for (const child of children) {
    assert.equal(child.parentItemID, replacement.id);
    assert.equal(child.parentItem, replacement);
    assert.equal(harness.items.get(child.id), child);
  }
  assert.equal(children[0].deleted, true);
  assert.equal(children[1].annotationIsExternal, true);
  assert.equal(children[2].note, "Child note");
  assert.equal(attachment.calls.erase, 1);
});

test("both external modes reject a target inside Zotero storage", async () => {
  for (const workMode of ["copy", "linked"]) {
    const { attachment } = setupStoredAttachment(workMode, {
      prefs: { destDir: "/storage" },
    });

    const result = await organize(workMode, attachment);

    assert.equal(result, undefined);
    assert.deepEqual(harness.calls.copy, []);
    assert.equal(attachment.calls.erase, 0);
    assert.equal(harness.files.has("/storage/PAPER001/paper.pdf"), true);
    harness.cleanup();
  }
  harness = undefined;
});

test("both external modes reject a target directory aliasing Zotero storage", async () => {
  for (const workMode of ["copy", "linked"]) {
    const { attachment } = setupStoredAttachment(workMode, {
      directories: [
        "/source",
        "/dest",
        "/storage",
        "/storage/PAPER001",
        "/alias-storage",
      ],
      symlinks: { "/alias-storage": "/storage" },
      prefs: { destDir: "/alias-storage" },
    });

    const result = await organize(workMode, attachment);

    assert.equal(result, undefined);
    assert.deepEqual(harness.calls.copy, []);
    assert.equal(attachment.calls.erase, 0);
    assert.equal(harness.files.has("/storage/PAPER001/paper.pdf"), true);
    harness.cleanup();
  }
  harness = undefined;
});

test("verified attachment copy uses content fingerprints and no-overwrite publication", async () => {
  harness = createHarness({
    directories: ["/source", "/dest"],
    files: ["/source/paper.pdf"],
    fileContents: { "/source/paper.pdf": "same bytes" },
  });
  const files = loadSourceModule("src/modules/attachmentFiles.ts");

  const copied = await files.copyAttachmentFile(
    "/source/paper.pdf",
    "/dest/paper.pdf",
  );

  assert.equal(copied.path, "/dest/paper.pdf");
  assert.equal(copied.fingerprint.hash, filesFingerprint("same bytes"));
  assert.deepEqual(harness.calls.copyOptions, [{ noOverwrite: true }]);
  assert.deepEqual(harness.calls.moveOptions, [{ noOverwrite: true }]);
  assert.equal(harness.files.has("/source/paper.pdf"), true);
});

test("cancelled attachment copies clean their temporary files", async () => {
  let cancelled = false;
  harness = createHarness({
    directories: ["/source", "/dest"],
    files: ["/source/paper.pdf"],
    ioCopy: async (source, destination, currentHarness) => {
      currentHarness.writeFile(
        destination,
        currentHarness.fileContents.get(source),
      );
      cancelled = true;
    },
  });
  const files = loadSourceModule("src/modules/attachmentFiles.ts");

  await assert.rejects(
    files.copyAttachmentFile("/source/paper.pdf", "/dest/paper.pdf", {
      shouldCancel: () => cancelled,
    }),
    /Attachment operation cancelled/,
  );
  assert.equal(
    [...harness.files].some((file) => file.includes(".attanger-")),
    false,
  );
  assert.equal(harness.files.has("/dest/paper.pdf"), false);
});

test("verified attachment copy rejects corrupted bytes and retains the source", async () => {
  harness = createHarness({
    directories: ["/source", "/dest"],
    files: ["/source/paper.pdf"],
    ioCopy: async (_source, destination, currentHarness) => {
      currentHarness.writeFile(destination, "corrupt copy");
    },
  });
  const files = loadSourceModule("src/modules/attachmentFiles.ts");

  await assert.rejects(
    files.copyAttachmentFile("/source/paper.pdf", "/dest/paper.pdf"),
    /already exists or changed/,
  );

  assert.equal(harness.files.has("/source/paper.pdf"), true);
  assert.equal(harness.files.has("/dest/paper.pdf"), false);
});

test("a concurrent destination creation receives a suffix without overwriting its bytes", async () => {
  let collisionInjected = false;
  harness = createHarness({
    directories: ["/source", "/dest"],
    files: ["/source/paper.pdf"],
    ioMove: async (source, destination, currentHarness) => {
      if (!collisionInjected && destination === "/dest/paper.pdf") {
        collisionInjected = true;
        currentHarness.writeFile(destination, "concurrently created PDF");
        throw new Error("destination appeared during rename");
      }
      currentHarness.writeFile(
        destination,
        currentHarness.fileContents.get(source),
      );
      currentHarness.files.delete(source);
      currentHarness.fileContents.delete(source);
    },
  });
  const files = loadSourceModule("src/modules/attachmentFiles.ts");

  const result = await files.copyAttachmentFile(
    "/source/paper.pdf",
    "/dest/paper.pdf",
  );

  assert.equal(result.path, "/dest/paper_1.pdf");
  assert.equal(
    harness.fileContents.get("/dest/paper.pdf").toString(),
    "concurrently created PDF",
  );
  assert.deepEqual(
    harness.fileContents.get("/dest/paper_1.pdf"),
    harness.fileContents.get("/source/paper.pdf"),
  );
});

test("destination checking accepts new subfolders without probing nonexistent symlinks", () => {
  setupStoredAttachment("copy");
  const original = Zotero.File.pathToFile;
  Zotero.File.pathToFile = (filePath) => {
    const file = original(filePath);
    file.isSymlink = () => {
      if (!file.exists()) throw new Error("File does not exist");
      return false;
    };
    Object.defineProperty(file, "target", {
      get() {
        throw new Error("Regular files have no symlink target");
      },
    });
    return file;
  };
  const core = loadSourceModule("src/modules/attachmentFiles.ts");
  assert.equal(
    core.isZoteroStoragePath("/dest/new/subfolder/paper.pdf"),
    false,
  );
  assert.equal(core.isZoteroStoragePath("/storage/new/paper.pdf"), true);
});

test("PDF matching respects never and always title extraction settings", async () => {
  for (const readPDFtitle of ["never", "always"]) {
    let queries = 0;
    harness = createHarness({
      files: ["/source/中文标题.pdf", "/source/wrong.pdf"],
      prefs: { workMode: "stored", readPDFtitle },
      pdfWorkerQuery: async (_method) => {
        queries++;
        return { metadata: { title: "中文标题" }, pages: [] };
      },
    });
    harness.selectedItems = [createRegularItem(harness, { title: "中文标题" })];
    const menu = new harness.module.default();
    const root = harness.menuRegistrations.find(
      ({ config }) => config.id === "attanger-menu",
    ).config;
    await root.children
      .find((child) => child.id === "attanger-match-attachment")
      .commandListener();
    assert.equal(queries, readPDFtitle === "never" ? 0 : 2);
    assert.equal(
      harness.calls.importFromFile[0].file,
      readPDFtitle === "never" ? "/source/中文标题.pdf" : "/source/wrong.pdf",
    );
    menu.dispose();
    harness.cleanup();
  }
  harness = undefined;
});

function filesFingerprint(value) {
  return require("node:crypto").createHash("md5").update(value).digest("hex");
}
