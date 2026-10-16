const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const {
  createHarness,
  createRegularItem,
} = require("./helpers/menuHarness.cjs");

let harness;

afterEach(() => {
  global.addon?.data.menu?.dispose();
  harness?.cleanup();
  harness = undefined;
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function serialWorkerQueue() {
  let tail = Promise.resolve();
  return {
    enqueue(callback) {
      const task = tail.then(callback);
      tail = task.catch(() => {});
      return task;
    },
    settled: () => tail,
  };
}

function matchingCommand() {
  new harness.module.default();
  return harness.menuRegistrations
    .find(({ config }) => config.id === "attanger-menu")
    .config.children.find((child) => child.id === "attanger-match-attachment")
    .commandListener;
}

function recognizerPage(text, fontSize = 24) {
  const words = [[0, 0, 0, 0, fontSize, 0, text]];
  const lines = [[words]];
  const textBlock = [null, null, null, null, lines];
  return [[[[textBlock]]]];
}

function pagePNG() {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  );
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

test("visual duplicate verification hashes every complete page using the installed renderer", async () => {
  const queries = [];
  harness = createHarness({
    files: ["/source/paper.pdf"],
    pdfWorkerQuery: async (...args) => {
      queries.push(args);
      return { buf: pagePNG() };
    },
  });
  Zotero.version = "10.0.6";
  Zotero.PDFWorker.renderAttachmentAnnotations = function () {
    throw new Error("The item-based renderer must not be invoked");
    return this._query("pdf.renderAnnotations", {});
  };
  let reads = 0;
  const read = IOUtils.read;
  IOUtils.read = async (...args) => {
    reads++;
    return read(...args);
  };

  const result = await harness.module.getPDFVisualIdentity(
    "/source/paper.pdf",
    3,
  );
  const expectedHash = crypto
    .createHash("sha256")
    .update(Buffer.from(pagePNG()))
    .digest("hex");

  assert.deepEqual(result, {
    totalPages: 3,
    pageHashes: Array(3).fill(expectedHash),
  });
  assert.equal(reads, 1);
  assert.equal(queries.length, 3);
  queries.forEach(([action, data, transfer], i) => {
    assert.equal(action, "pdf.renderArea");
    assert.equal(data.pageIndex, i);
    assert.equal(data.scale, 2);
    assert.deepEqual(data.rect, [
      -Number.MAX_VALUE,
      -Number.MAX_VALUE,
      Number.MAX_VALUE,
      Number.MAX_VALUE,
    ]);
    assert.equal(transfer[0], data.buf);
    if (i) assert.notEqual(data.buf, queries[i - 1][1].buf);
  });
  assert.equal(harness.clock.tasks.size, 0);
});

for (const pages of [0, -1, 1.5, 101, NaN, Infinity]) {
  test(`visual verification rejects invalid or oversized page count ${pages} before querying`, async () => {
    const queries = [];
    harness = createHarness({
      pdfWorkerQuery: async (...args) => queries.push(args),
    });
    Zotero.version = "11.0.0";
    assert.equal(
      await harness.module.getPDFVisualIdentity("/source/paper.pdf", pages),
      undefined,
    );
    assert.equal(queries.length, 0);
    assert.equal(harness.clock.tasks.size, 0);
  });
}

test("an unconfirmed legacy visual action is never probed", async () => {
  const queries = [];
  harness = createHarness({
    pdfWorkerQuery: async (...args) => queries.push(args),
  });
  Zotero.version = "7.0.0";
  assert.equal(
    await harness.module.getPDFVisualIdentity("/source/paper.pdf", 1),
    undefined,
  );
  Zotero.version = "11.0.0";
  Zotero.PDFWorker.renderAttachmentAnnotations = function () {
    return this._query("renderAnnotations", {});
  };
  assert.equal(
    await harness.module.getPDFVisualIdentity("/source/paper.pdf", 1),
    undefined,
  );
  assert.equal(queries.length, 0);
});

test("a missing or invalid rendered page fails closed without querying later pages", async () => {
  let count = 0;
  harness = createHarness({
    pdfWorkerQuery: async () => ({
      buf: ++count === 1 ? pagePNG() : new ArrayBuffer(33),
    }),
  });
  Zotero.version = "11.0.0";
  assert.equal(
    await harness.module.getPDFVisualIdentity("/source/paper.pdf", 3),
    undefined,
  );
  assert.equal(count, 2);
  assert.equal(harness.clock.tasks.size, 0);
});

test("visual verification shares one whole-document deadline and never sends late page queries", async () => {
  const queue = serialWorkerQueue();
  const latePage = deferred();
  let count = 0;
  harness = createHarness({
    pdfWorkerEnqueue: queue.enqueue,
    pdfWorkerQuery: async () =>
      ++count === 1 ? { buf: pagePNG() } : latePage.promise,
  });
  Zotero.version = "11.0.0";
  const rejected = assert.rejects(
    harness.module.getPDFVisualIdentity("/source/paper.pdf", 3),
    /PDF visual verification timed out/,
  );
  for (let i = 0; i < 10 && count < 2; i++) await harness.clock.settle();
  assert.equal(count, 2);
  let released = false;
  const next = queue.enqueue(() => {
    released = true;
  });

  await harness.clock.runAll();
  await rejected;
  await next;
  latePage.resolve({ buf: pagePNG() });
  await harness.clock.settle();

  assert.equal(released, true);
  assert.equal(count, 2);
  assert.equal(harness.clock.now, 30_000);
  assert.equal(harness.clock.tasks.size, 0);
});

for (const [version, action] of [
  ["7.0.0", "getRecognizerData"],
  ["10.0.3", "getRecognizerData"],
  ["11.0-beta.1", "pdf.getRecognizerData"],
]) {
  test(`PDF recognition chooses ${action} on Zotero ${version}`, async () => {
    const queries = [];
    const result = { metadata: { title: "Recognized title" }, pages: [] };
    harness = createHarness({
      files: ["/source/paper.pdf"],
      pdfWorkerQuery: async (...args) => {
        queries.push(args);
        return result;
      },
    });
    Zotero.version = version;

    assert.equal(await harness.module.getPDFData("/source/paper.pdf"), result);
    assert.equal(queries.length, 1);
    assert.equal(queries[0][0], action);
    assert.ok(queries[0][1].buf instanceof ArrayBuffer);
    assert.equal(queries[0][2][0], queries[0][1].buf);
    assert.equal(harness.clock.tasks.size, 0);
  });
}

for (const [version, action] of [
  ["7.0.0", "getFulltext"],
  ["11.0-beta.1", "pdf.getFulltext"],
]) {
  test(`full-document duplicate verification uses ${action} on Zotero ${version}`, async () => {
    const queries = [];
    const fulltext = { text: "Every page", extractedPages: 12, totalPages: 12 };
    harness = createHarness({
      files: ["/source/paper.pdf"],
      pdfWorkerQuery: async (...args) => {
        queries.push(args);
        return fulltext;
      },
    });
    Zotero.version = version;

    assert.equal(
      await harness.module.getPDFFulltext("/source/paper.pdf"),
      fulltext,
    );
    assert.equal(queries.length, 1);
    assert.equal(queries[0][0], action);
    assert.equal(queries[0][1].maxPages, undefined);
    assert.equal(queries[0][2][0], queries[0][1].buf);
    assert.equal(harness.clock.tasks.size, 0);
  });
}

test("fulltext extraction follows the installed native protocol without invoking its item API", async () => {
  const actions = [];
  harness = createHarness({
    pdfWorkerQuery: async (action) => {
      actions.push(action);
      return {};
    },
  });
  Zotero.version = "10.0.0";
  Zotero.PDFWorker.getFullText = function () {
    throw new Error("The item-based API must not be invoked");
    return this._query("pdf.getFulltext", {});
  };

  await harness.module.getPDFFulltext("/source/paper.pdf");

  assert.deepEqual(actions, ["pdf.getFulltext"]);
});

test("a stalled fulltext verification releases Zotero's shared worker queue", async () => {
  const queue = serialWorkerQueue();
  harness = createHarness({
    files: ["/source/paper.pdf"],
    pdfWorkerEnqueue: queue.enqueue,
    pdfWorkerQuery: async () => new Promise(() => {}),
  });
  const rejected = assert.rejects(
    harness.module.getPDFFulltext("/source/paper.pdf"),
    /PDF fulltext timed out/,
  );
  await harness.clock.settle();
  let released = false;
  const next = queue.enqueue(() => {
    released = true;
  });

  await harness.clock.runAll();
  await rejected;
  await next;

  assert.equal(released, true);
  assert.equal(harness.clock.tasks.size, 0);
});

for (const [version, action, nativeRecognizer] of [
  [
    "11.0.0",
    "getRecognizerData",
    async function getRecognizerData() {
      return this._query("getRecognizerData", {});
    },
  ],
  [
    "10.0.0",
    "pdf.getRecognizerData",
    async function getRecognizerData() {
      return this._query("pdf.getRecognizerData", {});
    },
  ],
]) {
  test(`native PDF recognizer source overrides Zotero ${version} action fallback`, async () => {
    const actions = [];
    harness = createHarness({
      files: ["/source/paper.pdf"],
      pdfWorkerQuery: async (method) => {
        actions.push(method);
        return {};
      },
    });
    Zotero.version = version;
    Zotero.PDFWorker.getRecognizerData = nativeRecognizer;
    nativeRecognizer.toString = () => {
      throw new Error("Do not use an overridden toString method");
    };

    await harness.module.getPDFData("/source/paper.pdf");

    assert.deepEqual(actions, [action]);
  });
}

test("unrecognized native recognizer source uses the version fallback without calling it", async () => {
  const actions = [];
  harness = createHarness({
    pdfWorkerQuery: async (method) => {
      actions.push(method);
      return {};
    },
  });
  Zotero.version = "11.0.0";
  Zotero.PDFWorker.getRecognizerData = () => {
    throw new Error("The item-based native recognizer must not be called");
  };

  await harness.module.getPDFData("/source/paper.pdf");

  assert.deepEqual(actions, ["pdf.getRecognizerData"]);
});

test("PDF recognition reports a worker rejection without probing a second action", async () => {
  const actions = [];
  harness = createHarness({
    pdfWorkerQuery: async (method) => {
      actions.push(method);
      throw new Error("Worker disconnected");
    },
  });
  Zotero.version = "11.0.0";

  await assert.rejects(
    harness.module.getPDFData("/source/paper.pdf"),
    /Worker disconnected/,
  );

  assert.deepEqual(actions, ["pdf.getRecognizerData"]);
  assert.equal(harness.clock.tasks.size, 0);
});

test("PDF requests that expire while queued neither read files nor send worker messages", async () => {
  const queue = serialWorkerQueue();
  const gate = deferred();
  const reads = [];
  const queries = [];
  queue.enqueue(() => gate.promise);
  harness = createHarness({
    pdfWorkerEnqueue: queue.enqueue,
    pdfWorkerQuery: async (...args) => {
      queries.push(args);
      return {};
    },
  });
  IOUtils.read = async (filePath) => {
    reads.push(filePath);
    return new Uint8Array([1]);
  };
  const rejected = assert.rejects(
    harness.module.getPDFData("/source/expired.pdf"),
    /timed out/i,
  );
  await harness.clock.settle();

  await harness.clock.runAll();
  await rejected;
  gate.resolve();
  await harness.clock.settle();
  await queue.settled();

  assert.deepEqual(reads, []);
  assert.deepEqual(queries, []);
  assert.equal(harness.clock.now, 30_000);
});

test("a stuck PDF query times out and releases the shared serial worker queue", async () => {
  const queue = serialWorkerQueue();
  const actions = [];
  let terminated = 0;
  harness = createHarness({
    files: ["/source/stuck.pdf", "/source/next.pdf"],
    pdfWorkerEnqueue: queue.enqueue,
    pdfWorkerQuery: async (action) => {
      actions.push(action);
      if (actions.length === 1) return new Promise(() => {});
      return { metadata: { title: "Next title" } };
    },
  });
  const worker = { terminate: () => terminated++ };
  Zotero.PDFWorker._worker = worker;
  Zotero.PDFWorker._terminate = () => terminated++;
  const rejected = assert.rejects(
    harness.module.getPDFData("/source/stuck.pdf"),
    /timed out/i,
  );
  await harness.clock.settle();
  assert.equal(actions.length, 1);

  await harness.clock.runAll();
  await rejected;
  let nextNativeTaskRan = false;
  queue.enqueue(async () => {
    nextNativeTaskRan = true;
  });
  let nextResult;
  const nextRequest = harness.module
    .getPDFData("/source/next.pdf")
    .then((value) => {
      nextResult = value;
    });
  await harness.clock.settle();

  assert.equal(nextNativeTaskRan, true);
  assert.deepEqual(nextResult, { metadata: { title: "Next title" } });
  await nextRequest;
  assert.equal(actions.length, 2);
  assert.equal(terminated, 0);
  assert.equal(Zotero.PDFWorker._worker, worker);
  assert.equal(Zotero.PDFWorker._enqueue, queue.enqueue);
  assert.equal(harness.clock.tasks.size, 0);
});

test("a PDF read finishing after its deadline cannot submit a late worker query", async () => {
  const queue = serialWorkerQueue();
  const read = deferred();
  let reads = 0;
  let queries = 0;
  harness = createHarness({
    pdfWorkerEnqueue: queue.enqueue,
    pdfWorkerQuery: async () => {
      queries++;
      return {};
    },
  });
  IOUtils.read = () => {
    reads++;
    return read.promise;
  };
  const rejected = assert.rejects(
    harness.module.getPDFData("/source/slow.pdf"),
    /timed out/i,
  );
  await harness.clock.settle();
  assert.equal(reads, 1);

  await harness.clock.runAll();
  await rejected;
  let nextTaskRan = false;
  queue.enqueue(() => {
    nextTaskRan = true;
  });
  await harness.clock.settle();
  assert.equal(nextTaskRan, true);
  read.resolve(new Uint8Array([1, 2, 3]));
  await harness.clock.settle();

  assert.equal(queries, 0);
  assert.equal(harness.clock.tasks.size, 0);
});

test("a late PDF query response cannot resolve a newer request with stale data", async () => {
  const queue = serialWorkerQueue();
  const oldResponse = deferred();
  const newResponse = deferred();
  let queries = 0;
  harness = createHarness({
    pdfWorkerEnqueue: queue.enqueue,
    pdfWorkerQuery: () => {
      queries++;
      return queries === 1 ? oldResponse.promise : newResponse.promise;
    },
  });
  const rejected = assert.rejects(
    harness.module.getPDFData("/source/old.pdf"),
    /timed out/i,
  );
  await harness.clock.settle();
  await harness.clock.runAll();
  await rejected;

  let currentResult;
  const current = harness.module
    .getPDFData("/source/current.pdf")
    .then((result) => {
      currentResult = result;
    });
  await harness.clock.settle();
  assert.equal(queries, 2);
  oldResponse.resolve({ metadata: { title: "Stale title" } });
  await harness.clock.settle();
  assert.equal(currentResult, undefined);

  newResponse.resolve({ metadata: { title: "Current title" } });
  await current;

  assert.deepEqual(currentResult, { metadata: { title: "Current title" } });
  assert.equal(queries, 2);
  assert.equal(harness.clock.tasks.size, 0);
});

test("filename matching removes only the final extension from dotted names", async () => {
  let queries = 0;
  harness = createHarness({
    files: ["/source/Report.2026.final.pdf", "/source/Report.pdf"],
    prefs: { workMode: "stored", readPDFtitle: "never" },
    pdfWorkerQuery: async () => {
      queries++;
      return {};
    },
  });
  harness.selectedItems = [
    createRegularItem(harness, { title: "Report.2026.final" }),
  ];

  await matchingCommand()();

  assert.equal(
    harness.calls.importFromFile[0].file,
    "/source/Report.2026.final.pdf",
  );
  assert.equal(queries, 0);
});

for (const [label, title, prefs] of [
  ["never", "Actual title", { readPDFtitle: "never" }],
  ["default Chinese", "\u4e2d\u6587\u6807\u9898", {}],
  ["default Japanese", "\u30bf\u30a4\u30c8\u30eb", {}],
  ["default Korean", "\ud55c\uae00\uc81c\ubaa9", {}],
]) {
  test(`${label} title matching does not read PDFs or query the worker`, async () => {
    let reads = 0;
    let queries = 0;
    harness = createHarness({
      files: [`/source/${title}.pdf`, "/source/unrelated.pdf"],
      prefs: { workMode: "stored", ...prefs },
      pdfWorkerQuery: async () => {
        queries++;
        return { metadata: { title } };
      },
    });
    IOUtils.read = async () => {
      reads++;
      return new Uint8Array([1]);
    };
    harness.selectedItems = [createRegularItem(harness, { title })];

    await matchingCommand()();

    assert.equal(harness.calls.importFromFile[0].file, `/source/${title}.pdf`);
    assert.equal(reads, 0);
    assert.equal(queries, 0);
  });
}

test("PDF matching caches each path once per command, not across commands", async () => {
  const queries = [];
  harness = createHarness({
    fileContents: {
      "/source/first.pdf": "first",
      "/source/shared.pdf": "shared",
    },
    prefs: { workMode: "stored", readPDFtitle: "always" },
    pdfWorkerQuery: async (_action, { buf }) => {
      const marker = Buffer.from(buf).toString();
      queries.push(marker);
      return {
        metadata: { title: marker === "first" ? "A" : "Longer title" },
        pages: [],
      };
    },
  });
  harness.selectedItems = [
    createRegularItem(harness, { id: 1, title: "A" }),
    createRegularItem(harness, { id: 2, title: "Longer title" }),
  ];
  const command = matchingCommand();

  await command();

  assert.deepEqual(queries, ["first", "shared"]);
  assert.deepEqual(
    harness.calls.importFromFile.map(({ file }) => file),
    ["/source/first.pdf", "/source/shared.pdf"],
  );
  // Use fresh parents: rerunning on the same parents now skips duplicate PDFs.
  harness.selectedItems = [
    createRegularItem(harness, { id: 3, title: "A" }),
    createRegularItem(harness, { id: 4, title: "Longer title" }),
  ];
  await command();
  assert.deepEqual(queries, ["first", "shared", "first", "shared"]);
});

test("PDF matching caches failed recognition and falls back to filenames", async () => {
  const queries = [];
  harness = createHarness({
    fileContents: {
      "/source/A.pdf": "first",
      "/source/Shared.pdf": "shared",
    },
    prefs: { workMode: "stored", readPDFtitle: "always" },
    pdfWorkerQuery: async (_action, { buf }) => {
      queries.push(Buffer.from(buf).toString());
      throw new Error("Cannot extract this PDF");
    },
  });
  harness.selectedItems = [
    createRegularItem(harness, { id: 1, title: "A" }),
    createRegularItem(harness, { id: 2, title: "Shared" }),
  ];

  await matchingCommand()();

  assert.deepEqual(queries, ["first", "shared"]);
  assert.deepEqual(
    harness.calls.importFromFile.map(({ file }) => file),
    ["/source/A.pdf", "/source/Shared.pdf"],
  );
});

for (const metadataKey of ["title", "Title"]) {
  test(`valid PDF metadata ${metadataKey} is used before malformed pages`, async () => {
    harness = createHarness({
      fileContents: {
        "/source/decoy.pdf": "decoy",
        "/source/random.pdf": "target",
      },
      prefs: { workMode: "stored", readPDFtitle: "always" },
      pdfWorkerQuery: async (_action, { buf }) => {
        if (Buffer.from(buf).toString() === "decoy") {
          return { metadata: { title: "A different paper" }, pages: [] };
        }
        return {
          metadata: { [metadataKey]: "Expected title" },
          get pages() {
            throw new Error(
              "Metadata extraction must not parse malformed pages",
            );
          },
        };
      },
    });
    harness.selectedItems = [
      createRegularItem(harness, { title: "Expected title" }),
    ];

    await matchingCommand()();

    assert.equal(harness.calls.importFromFile[0].file, "/source/random.pdf");
  });
}

test("PDF text extraction skips malformed pages while keeping valid page titles", async () => {
  harness = createHarness({
    fileContents: {
      "/source/decoy.pdf": "decoy",
      "/source/random.pdf": "target",
    },
    prefs: { workMode: "stored", readPDFtitle: "always" },
    pdfWorkerQuery: async (_action, { buf }) => {
      if (Buffer.from(buf).toString() === "decoy") {
        return { metadata: { title: "A different paper" }, pages: [] };
      }
      return {
        pages: [null, {}, [], [null], recognizerPage("Expected title")],
      };
    },
  });
  harness.selectedItems = [
    createRegularItem(harness, { title: "Expected title" }),
  ];

  await matchingCommand()();

  assert.equal(harness.calls.importFromFile[0].file, "/source/random.pdf");
});

test("the plugin manifest allows Zotero 11 compatibility testing", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../addon/manifest.json"), "utf8"),
  );

  assert.equal(manifest.applications.zotero.strict_max_version, "11.*");
});
