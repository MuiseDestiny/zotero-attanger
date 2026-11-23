const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  createHarness,
  createAttachment,
} = require("./helpers/menuHarness.cjs");

const old = "/storage/旧文献/2020/paper.pdf";
const target = "/dest/paper.pdf";

for (const [scenario, source, recycle] of [
  ["verified legacy PDF", old, true],
  ["managed item directory", "/storage/KEY12345/image/paper.pdf", false],
  ["storage root", "/storage/paper.pdf", false],
  ["temporary directory", "/storage/tmp-abc123/paper.pdf", false],
  ["ancestor alias", "/storage/alias/paper.pdf", false],
  ["reference from trash in another library", old, false],
  ["reference from a differently named symlink", old, false],
  ["unresolved library reference", old, false],
  ["source changed after copying", old, false],
  ["target changed after copying", old, false],
  ["user cancelled after relinking", old, false],
  ["system Trash unavailable", old, false],
  ["keep original enabled", old, false],
]) {
  test(`legacy storage move: ${scenario}`, async (t) => {
    const directory = source.slice(0, source.lastIndexOf("/"));
    const alias = "/external/different.pdf";
    const sibling = directory + "/neighbor.pdf";
    const harness = createHarness({
      files: [source, sibling, alias],
      directories: ["/dest", "/external", "/storage/旧文献", directory],
      symlinks: { "/storage/alias": "/storage/KEY12345", [alias]: old },
      prefs: {
        workMode: "linked",
        destDir: "/dest",
        subfolderFormat: "",
        autoRemoveEmptyFolder: true,
        moveWithoutDeleting: scenario === "keep original enabled",
      },
    });
    t.after(() => harness.cleanup());
    Zotero.isMac = true;
    const trashCalls = [];
    Zotero.Utilities.Internal.exec = async (_command, args) => {
      const path = args.at(-1);
      trashCalls.push(path);
      if (scenario === "system Trash unavailable") return false;
      harness.files.delete(path);
      return true;
    };
    let cancelled = false;
    const add = (options) => {
      const item = createAttachment(harness, { mode: "linked", ...options });
      item.isFileAttachment = () => true;
      item.getFilePath = () => item.attachmentPath;
      return item;
    };
    const item = add({
      path: source,
      onRelink() {
        if (scenario === "source changed after copying")
          harness.writeFile(source, "edit");
        if (scenario === "target changed after copying")
          harness.writeFile(target, "edit");
        if (scenario === "user cancelled after relinking") cancelled = true;
      },
    });
    if (scenario.startsWith("reference from")) {
      add({
        id: 3,
        path: scenario.includes("symlink") ? alias : source,
        deleted: true,
        libraryID: 3,
      });
    }
    if (scenario === "unresolved library reference") {
      add({ id: 3, path: "attachments:paper.pdf" }).getFilePath = () => false;
    }
    await harness.module.moveFile(item, { shouldCancel: () => cancelled });
    assert.equal(await item.getFilePathAsync(), target);
    assert.equal(harness.files.has(target), true);
    assert.equal(harness.files.has(source), !recycle);
    assert.equal(harness.files.has(sibling), true);
    assert.equal(harness.directories.has(directory), true);
    const warned = harness.calls.progressWindows.some((win) =>
      win.lines.some(
        (line) => line.text === "zoteroattanger-legacy-source-retained",
      ),
    );
    assert.equal(
      warned,
      !recycle && !cancelled && scenario !== "keep original enabled",
    );
    await harness.module.moveFile(item);
    assert.deepEqual(
      trashCalls,
      recycle || scenario === "system Trash unavailable" ? [source] : [],
    );
  });
}
