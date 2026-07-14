const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const {
  createAttachment,
  createHarness,
  createRegularItem,
} = require("./helpers/menuHarness.cjs");

let harness;

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
});

test("parent modify events debounce timer ID 0 and rename a linked attachment once", async () => {
  harness = createHarness({
    baseName: "BBT-Key",
    prefs: {
      autoRenameOnModify: true,
      autoRenameOnModifyDebounceMs: 0,
      autoRenameOnModifyDelayEnabled: true,
      autoRenameOnModifyDelayMs: 250,
    },
  });
  const parent = createRegularItem(harness, { id: 1 });
  const attachment = createAttachment(harness, {
    id: 2,
    mode: "linked",
    parent,
    path: "/library/old.pdf",
  });
  const menu = new harness.module.default();

  await harness.notify("modify", [parent.id]);
  await harness.notify("modify", [parent.id]);
  assert.deepEqual(harness.clock.cleared, [0]);

  await harness.clock.runAll();

  assert.deepEqual(attachment.calls.rename, ["BBT-Key.pdf"]);
  assert.equal(attachment.calls.save, 1);
  assert.deepEqual(harness.delays, [250]);
  menu.dispose();
});

test("disabled timing options ignore their configured millisecond values", async () => {
  harness = createHarness({
    baseName: "no-timing",
    prefs: {
      autoRenameOnModify: true,
      autoRenameOnModifyDebounceEnabled: false,
      autoRenameOnModifyDebounceMs: 1000,
      autoRenameOnModifyDelayEnabled: false,
      autoRenameOnModifyDelayMs: 250,
    },
  });
  const parent = createRegularItem(harness, { id: 3 });
  const attachment = createAttachment(harness, {
    id: 4,
    mode: "linked",
    parent,
    path: "/library/old.pdf",
  });
  const menu = new harness.module.default();

  await harness.notify("modify", [parent.id]);
  assert.equal([...harness.clock.tasks.values()][0].at, 0);
  await harness.clock.runAll();

  assert.deepEqual(harness.delays, []);
  assert.deepEqual(attachment.calls.rename, ["no-timing.pdf"]);
  menu.dispose();
});

test("Attanger saves do not schedule a recursive modify rename", async () => {
  harness = createHarness({
    baseName: "final-key",
    prefs: {
      autoRenameOnModify: true,
      autoRenameOnModifyDebounceMs: 0,
    },
  });
  const parent = createRegularItem(harness, { id: 10 });
  const attachment = createAttachment(harness, {
    id: 11,
    mode: "linked",
    parent,
    path: "/library/old.pdf",
    onSave: async (item) => harness.notify("modify", [item.id]),
  });
  const menu = new harness.module.default();

  await harness.notify("modify", [parent.id]);
  await harness.clock.runAll();

  assert.deepEqual(attachment.calls.rename, ["final-key.pdf"]);
  assert.equal(attachment.calls.save, 1);
  assert.equal(harness.clock.tasks.size, 0);
  menu.dispose();
});

test("an unchanged rename plan performs no file rename and no save", async () => {
  harness = createHarness({
    baseName: "unchanged",
    prefs: {
      autoRenameOnModify: true,
      autoRenameOnModifyDebounceMs: 0,
    },
  });
  const parent = createRegularItem(harness, { id: 20 });
  const attachment = createAttachment(harness, {
    id: 21,
    mode: "linked",
    parent,
    path: "/library/unchanged.pdf",
    title: "unchanged.pdf",
  });
  const menu = new harness.module.default();

  await harness.notify("modify", [parent.id]);
  await harness.clock.runAll();

  assert.equal(attachment.calls.rename.length, 0);
  assert.equal(attachment.calls.save, 0);
  menu.dispose();
});

test("invalid filename rules are logged and do not abort modify renaming", async () => {
  harness = createHarness({
    baseName: "valid-result",
    prefs: {
      autoRenameOnModify: true,
      autoRenameOnModifyDebounceMs: 0,
      filenameSkipAutoMoveRenameRules: "[",
    },
  });
  const parent = createRegularItem(harness, { id: 30 });
  const attachment = createAttachment(harness, {
    id: 31,
    mode: "linked",
    parent,
    path: "/library/old.pdf",
  });
  const menu = new harness.module.default();

  await harness.notify("modify", [parent.id]);
  await harness.clock.runAll();

  assert.deepEqual(attachment.calls.rename, ["valid-result.pdf"]);
  assert.ok(
    harness.logs.some((entry) => entry[0] === "Invalid filename matching rule"),
  );
  menu.dispose();
});

test("add processing deduplicates a parent and its directly-notified attachment", async () => {
  harness = createHarness();
  const parent = createRegularItem(harness, { id: 40 });
  const attachment = createAttachment(harness, {
    id: 41,
    mode: "imported",
    parent,
  });
  const menu = new harness.module.default();
  const processed = [];
  menu.processAddedAttachment = async (item) => processed.push(item.id);

  await menu.processAddedItems([parent.id, attachment.id]);

  assert.deepEqual(processed, [attachment.id]);
  menu.dispose();
});

test("separate add notifications are debounced into one batch", async () => {
  harness = createHarness();
  const parent = createRegularItem(harness, { id: 50 });
  const attachment = createAttachment(harness, {
    id: 51,
    mode: "imported",
    parent,
  });
  const menu = new harness.module.default();
  const batches = [];
  menu.processAddedItems = async (ids) => batches.push(ids);

  await harness.notify("add", [parent.id]);
  await harness.notify("add", [attachment.id]);
  await harness.clock.runAll();

  assert.equal(batches.length, 1);
  assert.deepEqual(new Set(batches[0]), new Set([parent.id, attachment.id]));
  menu.dispose();
});

test("trashing a queued attachment cancels add-time processing", async () => {
  harness = createHarness();
  const parent = createRegularItem(harness, { id: 52 });
  const attachment = createAttachment(harness, {
    id: 53,
    mode: "imported",
    parent,
  });
  const menu = new harness.module.default();
  const processed = [];
  menu.processAddedAttachment = async (item) => processed.push(item.id);

  await harness.notify("add", [parent.id, attachment.id]);
  attachment.deleted = true;
  await harness.notify("trash", [attachment.id]);
  await harness.clock.runAll();

  assert.deepEqual(processed, []);
  assert.equal(harness.clock.tasks.size, 0);
  menu.dispose();
});

test("trashing a queued parent cancels processing for its child attachments", async () => {
  harness = createHarness();
  const parent = createRegularItem(harness, { id: 54 });
  const attachment = createAttachment(harness, {
    id: 55,
    mode: "imported",
    parent,
  });
  const menu = new harness.module.default();
  const processed = [];
  menu.processAddedAttachment = async (item) => processed.push(item.id);

  await harness.notify("add", [parent.id]);
  parent.deleted = true;
  await harness.notify("trash", [parent.id]);
  await harness.clock.runAll();

  assert.deepEqual(processed, []);
  assert.equal(menu.pendingAddedItemIDs.size, 0);
  assert.ok(parent.attachmentIDs.includes(attachment.id));
  menu.dispose();
});

test("trash during fileExists prevents an in-flight add batch from processing", async () => {
  let releaseFileExists;
  let fileExistsStarted;
  const fileExistsGate = new Promise((resolve) => {
    releaseFileExists = resolve;
  });
  const started = new Promise((resolve) => {
    fileExistsStarted = resolve;
  });
  harness = createHarness();
  const parent = createRegularItem(harness, { id: 56 });
  const attachment = createAttachment(harness, {
    id: 57,
    mode: "imported",
    parent,
    fileExists: async () => {
      fileExistsStarted();
      await fileExistsGate;
      return true;
    },
  });
  const menu = new harness.module.default();
  const processed = [];
  menu.processAddedAttachment = async (item) => processed.push(item.id);
  menu.pendingAddedItemIDs.add(attachment.id);

  const flush = menu.flushAddedItems();
  await started;
  attachment.deleted = true;
  await harness.notify("trash", [attachment.id]);
  releaseFileExists();
  await flush;

  assert.deepEqual(processed, []);
  menu.dispose();
});

test("trash cancels a pending rename-on-modify timer", async () => {
  harness = createHarness({
    baseName: "should-not-run",
    prefs: {
      autoRenameOnModify: true,
      autoRenameOnModifyDebounceMs: 1000,
    },
  });
  const parent = createRegularItem(harness, { id: 58 });
  const attachment = createAttachment(harness, {
    id: 59,
    mode: "linked",
    parent,
    path: "/library/original.pdf",
  });
  const menu = new harness.module.default();

  await harness.notify("modify", [attachment.id]);
  assert.equal(harness.clock.tasks.size, 1);
  attachment.deleted = true;
  await harness.notify("trash", [attachment.id]);
  await harness.clock.runAll();

  assert.deepEqual(attachment.calls.rename, []);
  assert.equal(harness.clock.tasks.size, 0);
  menu.dispose();
});

test("only imported attachments enter automatic move while linked files retain add-time rename eligibility", async () => {
  harness = createHarness({
    directories: ["/dest"],
    prefs: { autoMove: true, destDir: "/dest", subfolderFormat: "" },
  });
  const parent = createRegularItem(harness, { id: 60 });
  const imported = createAttachment(harness, {
    id: 61,
    mode: "imported",
    parent,
    path: "/dest/imported.pdf",
  });
  const linked = createAttachment(harness, {
    id: 62,
    mode: "linked",
    parent,
    path: "/dest/linked.pdf",
  });
  const menu = new harness.module.default();

  await menu.processAddedAttachment(imported);
  await menu.processAddedAttachment(linked);

  assert.equal(
    imported.calls.pathReads,
    2,
    "imported file should enter moveFile",
  );
  assert.equal(
    linked.calls.pathReads,
    1,
    "linked file should only be inspected",
  );
  menu.dispose();
});

test("recreating and disposing Menu leaves one notifier and clears pending timers", async () => {
  harness = createHarness();
  const first = new harness.module.default();
  await harness.notify("add", [1]);
  assert.equal(harness.clock.tasks.size, 1);

  const second = new harness.module.default();

  assert.equal(first.disposed, true);
  assert.equal(harness.clock.tasks.size, 0);
  assert.equal(harness.observers.size, 1);
  assert.equal(harness.calls.unregister.length, 1);

  second.dispose();
  assert.equal(harness.observers.size, 0);
});

test("concurrent moves of the same source path copy and convert only once", async () => {
  let releaseCopy;
  let copyStarted;
  const copyGate = new Promise((resolve) => {
    releaseCopy = resolve;
  });
  const started = new Promise((resolve) => {
    copyStarted = resolve;
  });
  harness = createHarness({
    directories: ["/source", "/dest"],
    files: ["/source/paper.pdf"],
    prefs: { autoMove: true, destDir: "/dest", subfolderFormat: "" },
    ioCopy: async (_source, destination, currentHarness) => {
      copyStarted();
      await copyGate;
      currentHarness.files.add(destination);
    },
  });
  const parent = createRegularItem(harness, { id: 70 });
  const attachment = createAttachment(harness, {
    id: 71,
    mode: "imported",
    parent,
    path: "/source/paper.pdf",
  });

  const firstMove = harness.module.moveFile(attachment);
  await started;
  const secondResult = await harness.module.moveFile(attachment);
  releaseCopy();
  const firstResult = await firstMove;

  assert.equal(secondResult, undefined);
  assert.ok(firstResult);
  assert.equal(harness.calls.copy.length, 1);
  assert.equal(harness.calls.newItems.length, 1);
  assert.equal(attachment.calls.erase, 1);
});

test("trash during automatic copy keeps the source and removes the partial destination", async () => {
  let releaseCopy;
  let copyStarted;
  const copyGate = new Promise((resolve) => {
    releaseCopy = resolve;
  });
  const started = new Promise((resolve) => {
    copyStarted = resolve;
  });
  harness = createHarness({
    directories: ["/source", "/dest"],
    files: ["/source/trash-race.pdf"],
    prefs: { autoMove: true, destDir: "/dest", subfolderFormat: "" },
    ioCopy: async (_source, destination, currentHarness) => {
      copyStarted();
      await copyGate;
      currentHarness.files.add(destination);
    },
  });
  const parent = createRegularItem(harness, { id: 72 });
  const attachment = createAttachment(harness, {
    id: 73,
    mode: "imported",
    parent,
    path: "/source/trash-race.pdf",
  });
  const menu = new harness.module.default();

  const processing = menu.processAddedAttachment(attachment);
  await started;
  attachment.deleted = true;
  await harness.notify("trash", [attachment.id]);
  releaseCopy();
  await processing;

  assert.equal(harness.files.has("/source/trash-race.pdf"), true);
  assert.equal(harness.files.has("/dest/trash-race.pdf"), false);
  assert.equal(harness.calls.newItems.length, 0);
  assert.equal(attachment.calls.erase, 0);
  menu.dispose();
});

test("the delete emitted by a successful linked-file conversion does not cancel itself", async () => {
  harness = createHarness({
    directories: ["/source", "/dest"],
    files: ["/source/normal.pdf"],
    prefs: { autoMove: true, destDir: "/dest", subfolderFormat: "" },
  });
  const parent = createRegularItem(harness, { id: 74 });
  const attachment = createAttachment(harness, {
    id: 75,
    mode: "imported",
    parent,
    path: "/source/normal.pdf",
    onErase: async (item) => harness.notify("delete", [item.id]),
  });
  const menu = new harness.module.default();
  menu.autoProcessRunning = true;

  await menu.processAddedAttachment(attachment);

  assert.equal(harness.calls.newItems.length, 1);
  assert.equal(attachment.calls.erase, 1);
  assert.equal(menu.cancelledAutomaticItemIDs.has(attachment.id), false);
  menu.autoProcessRunning = false;
  menu.dispose();
});

test("move failures return without recursive retries", async () => {
  harness = createHarness({
    directories: ["/source", "/dest"],
    files: ["/source/fail.pdf"],
    prefs: { destDir: "/dest", subfolderFormat: "" },
    ioCopy: async () => {
      throw new Error("copy failed");
    },
    copyFallback: () => {
      throw new Error("fallback failed");
    },
  });
  const parent = createRegularItem(harness, { id: 80 });
  const attachment = createAttachment(harness, {
    id: 81,
    mode: "imported",
    parent,
    path: "/source/fail.pdf",
  });

  const result = await harness.module.moveFile(attachment);

  assert.equal(result, undefined);
  assert.equal(harness.calls.copy.length, 1);
  assert.equal(harness.calls.copyFallback.length, 1);
  assert.equal(harness.calls.newItems.length, 0);
});

test("an exact existing linked destination is reused without creating another item", async () => {
  harness = createHarness({
    directories: ["/source", "/dest"],
    files: ["/source/paper.pdf", "/dest/paper.pdf"],
    md5: () => "same-content",
    prefs: { destDir: "/dest", subfolderFormat: "" },
  });
  const parent = createRegularItem(harness, { id: 90 });
  const source = createAttachment(harness, {
    id: 91,
    mode: "imported",
    parent,
    path: "/source/paper.pdf",
  });
  const linked = createAttachment(harness, {
    id: 92,
    mode: "linked",
    parent,
    path: "/dest/paper.pdf",
  });

  const result = await harness.module.moveFile(source);

  assert.equal(result, linked);
  assert.equal(harness.calls.copy.length, 0);
  assert.equal(harness.calls.newItems.length, 0);
});

test("Match Attanger Attachment creates links instead of imported copies", async () => {
  harness = createHarness({
    baseName: "Expected",
    directories: ["/source"],
    files: ["/source/Expected.pdf"],
    prefs: { fileTypes: "pdf", sourceDir: "/source", subfolderFormat: "" },
  });
  const parent = createRegularItem(harness, {
    id: 100,
    fileBaseName: "Expected",
  });
  const linkedResult = createAttachment(harness, {
    id: 101,
    mode: "linked",
    parent,
    path: "/source/Expected.pdf",
  });
  parent.attachmentIDs = [];
  harness.items.delete(linkedResult.id);
  harness.selectedItems = [parent];
  const menu = new harness.module.default();
  const rootMenu = harness.menuRegistrations.find(
    ({ type, config }) => type === "item" && config.id === "attanger-menu",
  ).config;
  const exactMatch = rootMenu.children.find(
    (child) => child.label === "zoteroattanger-match-attanger-attachment",
  );
  global.Zotero.Attachments.linkFromFile = async (input) => {
    harness.calls.linkFromFile.push(input);
    return linkedResult;
  };

  await exactMatch.commandListener();

  assert.equal(harness.calls.linkFromFile.length, 1);
  assert.equal(harness.calls.importFromFile.length, 0);
  menu.dispose();
});
