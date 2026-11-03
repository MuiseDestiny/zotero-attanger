const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");
const { afterEach, test } = require("node:test");
const {
  createHarness,
  createAttachment,
} = require("./helpers/menuHarness.cjs");

const code = esbuild.buildSync({
  entryPoints: [path.join(process.cwd(), "src/modules/unusedPDFs.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
}).outputFiles[0].text;
const loaded = { exports: {} };
new Function("module", "exports", "require", code)(
  loaded,
  loaded.exports,
  require,
);
const { scanUnusedPDFs, trashUnusedPDFs, movePDFToTrash, previewUnusedPDFs } =
  loaded.exports;
let harness;
let previousServices;

function setup(options = {}) {
  harness = createHarness({
    ...options,
    directories: ["/", "/dest", "/storage", ...(options.directories || [])],
    prefs: { workMode: "linked", destDir: "/dest", ...options.prefs },
  });
  const originalFile = Zotero.File.pathToFile;
  Zotero.File.pathToFile = (filePath) => {
    const file = originalFile(filePath);
    file.isWritable = () => true;
    return file;
  };
  harness.trashCalls = [];
  Zotero.isMac = true;
  Zotero.Utilities.Internal.exec = async (command, args) => {
    const file = args[args.length - 1];
    harness.trashCalls.push({ command, args });
    harness.files.delete(file);
    return true;
  };
  return harness;
}

function attachment(options) {
  const item = createAttachment(harness, { mode: "linked", ...options });
  item.isFileAttachment = () => true;
  item.getFilePath = () => item.attachmentPath;
  return item;
}

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
  if (previousServices !== undefined) {
    global.Services = previousServices;
    previousServices = undefined;
  } else delete global.Services;
});

test("scan protects all libraries, stored files and trash, recurses only for PDFs, and never writes", async () => {
  setup({
    files: [
      "/dest/active.pdf",
      "/dest/trashed.pdf",
      "/dest/group.pdf",
      "/dest/stored.pdf",
      "/dest/free.PDF",
      "/dest/sub/orphan.pdf",
      "/dest/readme.txt",
      "/dest/.hidden.pdf",
    ],
    directories: ["/dest/sub"],
  });
  attachment({ id: 2, path: "/dest/active.pdf" });
  attachment({ id: 3, path: "/dest/trashed.pdf", deleted: true });
  attachment({ id: 4, path: "/dest/group.pdf", libraryID: 2 });
  attachment({ id: 5, path: "/dest/stored.pdf", mode: "imported" });
  const getAll = Zotero.Items.getAll;
  const enumerations = [];
  Zotero.Items.getAll = async (...args) => {
    enumerations.push(args);
    return getAll(...args);
  };
  const scan = await scanUnusedPDFs("/dest");
  assert.deepEqual(
    scan.files.map((file) => file.relativePath),
    ["free.PDF", "sub/orphan.pdf"],
  );
  assert.deepEqual(enumerations, [
    [1, false, true],
    [2, false, true],
  ]);
  assert.equal(scan.skipped, 1);
  assert.deepEqual(harness.calls.remove, []);
  assert.deepEqual(harness.calls.move, []);
  assert.deepEqual(harness.trashCalls, []);
});

test("scan fails closed on reference enumeration or unresolved paths", async () => {
  setup({ files: ["/dest/free.pdf"] });
  const item = attachment({ path: "/missing.pdf" });
  item.getFilePath = () => false;
  await assert.rejects(scanUnusedPDFs("/dest"), /resolve attachment/);
  Zotero.Items.getAll = async () => {
    throw new Error("DB unavailable");
  };
  await assert.rejects(scanUnusedPDFs("/dest"), /DB unavailable/);
  assert.deepEqual(harness.trashCalls, []);
});

for (const foreign of [
  String.raw`D:\OneDrive - junblue\Zotero\2009_Satellite aerosol remote sensing over land.pdf`,
  "D:/OneDrive/Zotero/2009_Satellite aerosol remote sensing over land.pdf",
  String.raw`\\server\papers\2009_Satellite aerosol remote sensing over land.pdf`,
  "//server/papers/2009_Satellite aerosol remote sensing over land.pdf",
]) {
  test(`macOS protects same-named PDFs for foreign reference ${foreign}`, async () => {
    const filename = "2009_Satellite aerosol remote sensing over land.pdf";
    setup({
      files: [
        `/dest/${filename}`,
        `/dest/sub/${filename.toUpperCase()}`,
        "/dest/orphan.pdf",
      ],
      directories: ["/dest/sub"],
    });
    const item = attachment({ path: foreign, deleted: true });
    item.getFilePath = () => {
      throw new Error("Foreign paths must not enter native resolution");
    };
    const nativeFile = Zotero.File.pathToFile;
    const nativeCalls = [];
    Zotero.File.pathToFile = (path) => {
      nativeCalls.push(path);
      if (path === foreign) throw new Error("Unexpected path value");
      return nativeFile(path);
    };
    const scan = await scanUnusedPDFs("/dest");
    assert.deepEqual(
      scan.files.map((file) => file.path),
      ["/dest/orphan.pdf"],
    );
    assert.equal(scan.foreignReferences, 1);
    assert.equal(nativeCalls.includes(foreign), false);
    assert.equal(item.attachmentPath, foreign);
    assert.deepEqual(harness.trashCalls, []);
  });
}

test("foreign paths resolved from relative links also avoid native APIs", async () => {
  setup({ files: ["/dest/paper.pdf", "/dest/free.pdf"] });
  const item = attachment({ path: "attachments:paper.pdf" });
  item.getFilePath = () => String.raw`D:\papers\paper.pdf`;
  const nativeFile = Zotero.File.pathToFile;
  Zotero.File.pathToFile = (path) => {
    assert.doesNotMatch(path, /^[a-z]:/i);
    return nativeFile(path);
  };
  const scan = await scanUnusedPDFs("/dest");
  assert.deepEqual(
    scan.files.map((file) => file.path),
    ["/dest/free.pdf"],
  );
  assert.equal(scan.foreignReferences, 1);
});

test("a foreign reference added after preview prevents recycling", async () => {
  setup({ files: ["/dest/Paper.pdf", "/dest/free.pdf"] });
  const scan = await scanUnusedPDFs("/dest");
  attachment({ path: String.raw`E:\Library\paper.PDF` });
  const result = await trashUnusedPDFs(scan, scan.files);
  assert.deepEqual(result, { moved: 1, skipped: 1, failed: 0 });
  assert.equal(harness.files.has("/dest/Paper.pdf"), true);
  assert.equal(harness.files.has("/dest/free.pdf"), false);
});

test("an invalid foreign filename still fails closed", async () => {
  setup({ files: ["/dest/free.pdf"] });
  attachment({ path: "D:\\Library\\" });
  await assert.rejects(scanUnusedPDFs("/dest"), /foreign attachment filename/);
  assert.deepEqual(harness.trashCalls, []);
});

test("Windows protects Unix references before native path resolution", async () => {
  setup({ files: ["/dest/Paper.pdf", "/dest/free.pdf"] });
  const nativeFile = Zotero.File.pathToFile;
  // Adapt only the test filesystem; production Windows passes drive paths directly.
  const toWindows = (path) => path.replace(/^\//, "C:/").replace(/\//g, "\\");
  const toPosix = (path) => path.replace(/\\/g, "/").replace(/^C:\//, "/");
  Zotero.isMac = false;
  Zotero.isWin = true;
  Zotero.File.pathToFile = (path) => {
    if (!path.startsWith("C:\\"))
      throw new Error("Unexpected Unix native path");
    const file = nativeFile(toPosix(path));
    return new Proxy(file, {
      get(target, property) {
        if (property === "path") return toWindows(target.path);
        if (property === "normalize") return () => {};
        if (property === "target") return toWindows(target.target);
        if (property === "directoryEntries") {
          const entries = target.directoryEntries;
          return {
            hasMoreElements: () => entries.hasMoreElements(),
            getNext: () => {
              const entry = entries.getNext();
              return {
                QueryInterface: () =>
                  Zotero.File.pathToFile(toWindows(entry.path)),
              };
            },
          };
        }
        return target[property];
      },
    });
  };
  PathUtils.parent = (path) =>
    path === "C:\\" ? null : require("node:path").win32.dirname(path);
  PathUtils.filename = path.win32.basename;
  PathUtils.joinRelative = path.win32.join;
  Zotero.getStorageDirectory = () => ({ path: "C:\\storage" });
  IOUtils.stat = async () => ({ type: "regular", size: 1, lastModified: 1 });
  Zotero.Utilities.Internal.md5Async = async () => "hash";
  const item = attachment({ path: "/Users/me/Paper.pdf" });
  item.getFilePath = () => {
    throw new Error("Foreign path was resolved");
  };
  const scan = await scanUnusedPDFs("C:\\dest");
  assert.deepEqual(
    scan.files.map((file) => file.path),
    ["C:\\dest\\free.pdf"],
  );
  assert.equal(scan.foreignReferences, 1);
});

test("symlink directories and files, hidden directories and Zotero storage are excluded", async () => {
  setup({
    files: [
      "/dest/link.pdf",
      "/dest/free.pdf",
      "/outside/keep.pdf",
      "/dest/.hidden/keep.pdf",
    ],
    directories: ["/dest/alias", "/outside", "/dest/.hidden"],
    symlinks: {
      "/dest/link.pdf": "/outside/keep.pdf",
      "/dest/alias": "/outside",
    },
  });
  const scan = await scanUnusedPDFs("/dest");
  assert.deepEqual(
    scan.files.map((file) => file.path),
    ["/dest/free.pdf"],
  );
  await assert.rejects(scanUnusedPDFs("/dest/alias"), /Unsafe/);
  await assert.rejects(scanUnusedPDFs("/storage"), /Unsafe/);
});

test("case variants and symbolic-link references protect a candidate", async () => {
  setup({
    files: ["/dest/Paper.pdf", "/alias.pdf"],
    symlinks: { "/alias.pdf": "/dest/Paper.pdf" },
  });
  attachment({ path: "/alias.pdf" });
  assert.equal((await scanUnusedPDFs("/dest")).files.length, 0);
  harness.items.clear();
  attachment({ path: "/dest/paper.pdf" });
  assert.equal((await scanUnusedPDFs("/dest")).files.length, 0);
});

test("cleanup recycles only selected unchanged files, deduplicates, and rechecks references", async () => {
  setup({ files: ["/dest/one.pdf", "/dest/two.pdf", "/dest/three.pdf"] });
  const scan = await scanUnusedPDFs("/dest");
  const one = scan.files.find((file) => file.path.endsWith("one.pdf"));
  const two = scan.files.find((file) => file.path.endsWith("two.pdf"));
  attachment({ path: two.path, deleted: true });
  const result = await trashUnusedPDFs(scan, [one, one, two]);
  assert.deepEqual(result, { moved: 1, skipped: 1, failed: 0 });
  assert.equal(harness.files.has(one.path), false);
  assert.equal(harness.files.has(two.path), true);
  assert.equal(harness.files.has("/dest/three.pdf"), true);
  assert.deepEqual(harness.calls.remove, []);
});

test("changed files, stale destinations, cancelled sessions and injected candidates are not recycled", async () => {
  setup({ files: ["/dest/free.pdf", "/outside.pdf"] });
  const scan = await scanUnusedPDFs("/dest");
  harness.fileContents.set("/dest/free.pdf", Buffer.from("changed"));
  assert.deepEqual(await trashUnusedPDFs(scan, scan.files), {
    moved: 0,
    skipped: 1,
    failed: 0,
  });
  assert.equal(
    (await trashUnusedPDFs(scan, [{ ...scan.files[0], path: "/outside.pdf" }]))
      .skipped,
    1,
  );
  assert.equal((await trashUnusedPDFs(scan, scan.files, () => false)).moved, 0);
  harness.prefs.set("extensions.zotero.zoteroattanger.destDir", "/other");
  assert.equal((await trashUnusedPDFs(scan, scan.files)).moved, 0);
  assert.deepEqual(harness.trashCalls, []);
});

test("reference failures after preview and recycling errors retain files without delete fallback", async () => {
  setup({ files: ["/dest/free.pdf"] });
  const scan = await scanUnusedPDFs("/dest");
  const getAll = Zotero.Items.getAll;
  Zotero.Items.getAll = async () => {
    throw new Error("DB failed");
  };
  assert.equal((await trashUnusedPDFs(scan, scan.files)).failed, 1);
  assert.deepEqual(harness.trashCalls, []);
  Zotero.Items.getAll = getAll;
  Zotero.Utilities.Internal.exec = async () => {
    throw new Error("Trash unavailable");
  };
  assert.equal((await trashUnusedPDFs(scan, scan.files)).failed, 1);
  assert.equal(harness.files.has("/dest/free.pdf"), true);
  assert.deepEqual(harness.calls.remove, []);
});

test("Windows uses recycle-only IFileOperation and Linux fails when gio is absent", async () => {
  setup({ files: ["/dest/free.pdf"] });
  Zotero.isMac = false;
  Zotero.isWin = true;
  previousServices = global.Services;
  global.Services = {
    dirsvc: { get: () => ({ path: "C:/Windows/System32" }) },
  };
  let call;
  Zotero.Utilities.Internal.exec = async (command, args) => {
    call = { command, args };
    return true;
  };
  await movePDFToTrash("C:/a'b.pdf");
  assert.match(call.args.at(-1), /0x00080000/);
  assert.match(call.args.at(-1), /Recycle\('C:\/a''b.pdf'\)/);
  assert.doesNotMatch(call.args.at(-1), /FileSystem\]::DeleteFile|Remove-Item/);
  Zotero.isWin = false;
  await assert.rejects(movePDFToTrash("/dest/free.pdf"), /unavailable/);
});

test("preview requires explicit selection and confirmation; closing it never recycles", async () => {
  setup({ files: ["/dest/one.pdf", "/dest/two.pdf"] });
  const scan = await scanUnusedPDFs("/dest");
  const dialogs = [];
  class Node {
    constructor(tag = "div") {
      this.tag = tag;
      this.children = [];
      this.listeners = {};
      this.style = {};
      this.disabled = false;
      this.checked = false;
    }
    append(...nodes) {
      this.children.push(...nodes);
    }
    addEventListener(type, callback) {
      this.listeners[type] = callback;
    }
    setAttribute() {}
    click() {
      if (this.disabled) return;
      this.checked = !this.checked;
      this.listeners.change?.();
    }
  }
  ztoolkit.Dialog = class {
    constructor() {
      this.buttons = [];
      dialogs.push(this);
    }
    setDialogData(data) {
      this.dialogData = data;
      return this;
    }
    addCell() {
      return this;
    }
    addButton(label, id, options = {}) {
      this.buttons.push({ label, id, ...options });
      return this;
    }
    open() {
      const nodes = new Map(
        [
          "unused-pdf-summary",
          "unused-pdf-root",
          "unused-pdf-list",
          "unused-pdf-trash",
        ].map((id) => [id, new Node()]),
      );
      let resolve;
      this.dialogData.unloadLock = {
        promise: new Promise((done) => (resolve = done)),
      };
      this.window = {
        closed: false,
        close() {
          this.closed = true;
          resolve();
        },
        document: {
          head: new Node(),
          body: new Node(),
          createElement: (tag) => new Node(tag),
          querySelector: (selector) => nodes.get(selector.slice(1)),
          querySelectorAll: () => [
            ...nodes.values(),
            ...nodes
              .get("unused-pdf-list")
              .children.flatMap((row) => row.children),
          ],
        },
      };
      this.dialogData.loadCallback();
      return this;
    }
  };
  previousServices = global.Services;
  const alerts = [];
  let confirmed = false;
  global.Services = {
    prompt: { confirm: () => confirmed, alert: (...args) => alerts.push(args) },
  };
  let close;
  const closedPreview = previewUnusedPDFs(
    scan,
    () => true,
    (callback) => (close = callback),
  );
  close();
  await closedPreview;
  assert.deepEqual(harness.trashCalls, []);

  const preview = previewUnusedPDFs(scan, () => true);
  const dialog = dialogs.at(-1);
  const button = dialog.window.document.querySelector("#unused-pdf-trash");
  assert.equal(button.disabled, true);
  const checkbox =
    dialog.window.document.querySelector("#unused-pdf-list").children[0]
      .children[0];
  checkbox.click();
  assert.equal(button.disabled, false);
  const accept = dialog.buttons.find(
    (button) => button.id === "unused-pdf-trash",
  ).callback;
  await accept();
  assert.deepEqual(harness.trashCalls, []);
  assert.equal(dialog.window.closed, false);
  confirmed = true;
  await accept();
  await preview;
  assert.equal(harness.trashCalls.length, 1);
  assert.equal(harness.files.has("/dest/two.pdf"), true);
  assert.equal(alerts.length, 1);
});

test("scan stops when its settings session is cancelled", async () => {
  setup({ files: ["/dest/free.pdf"] });
  await assert.rejects(
    scanUnusedPDFs("/dest", () => false),
    /cancelled/,
  );
  assert.deepEqual(harness.trashCalls, []);
});
