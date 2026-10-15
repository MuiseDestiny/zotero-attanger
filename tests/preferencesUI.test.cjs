const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const {
  createPreferencesHarness,
  deferred,
  PREF_PREFIX,
} = require("./helpers/preferencesHarness.cjs");

let harness;

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
});

function setup(options = {}) {
  harness = createPreferencesHarness(options);
  return harness;
}

function assertStatus(state) {
  assert.equal(harness.state().ready, state === "ready" ? "true" : "false");
  assert.equal(
    harness.state().title,
    `zoteroattanger-work-mode-status-${state}`,
  );
}

function assertNoFileOperations() {
  for (const key of [
    "copy",
    "copyFallback",
    "move",
    "remove",
    "relink",
    "convertLinkedToStored",
    "importFromFile",
    "linkFromFile",
    "recognize",
    "moveChildItems",
  ]) {
    assert.deepEqual(
      harness.calls[key],
      [],
      `${key} should not run in settings`,
    );
  }
  assert.equal(harness.items.size, 0);
  assert.deepEqual(harness.directoryCreationCalls, []);
  for (const item of harness.calls.newItems) {
    assert.equal(item.saveCount, undefined, "preview items must stay unsaved");
    assert.deepEqual(item.renameCalls, []);
  }
}

test("loading settings preserves configured modes, rules and timing preferences", async () => {
  const custom = "{{firstCreator}}/{{year}}/{{title}}";
  setup({
    autoRenameFiles: true,
    prefs: {
      workMode: "copy",
      destDir: "/dest",
      subfolderFormat: custom,
      syncAttachmentTitle: true,
      filenameAsPrefixRules: "^SI",
      filenameSkipRenameRules: "_original$",
      filenameSkipAutoMoveRenameRules: "_noexport$",
      slashAsSubfolderDelimiter: true,
      autoRecognizeImportedPDF: false,
      autoRenameOnModify: true,
      autoRenameOnModifyDebounceEnabled: false,
      autoRenameOnModifyDebounceMs: 500,
      autoRenameOnModifyDelayEnabled: true,
      autoRenameOnModifyDelayMs: 250,
    },
  });
  const before = new Map(harness.prefs);
  await harness.register();

  assert.deepEqual(harness.prefs, before);
  assert.equal(harness.node("work-mode").value, "copy");
  assert.equal(harness.node("subfolder-layout").value, "custom");
  assert.equal(harness.node("subfolder-format").value, custom);
  assert.equal(harness.node("subfolder-custom-settings").hidden, false);
  assert.equal(harness.node("auto-rename").checked, true);
  assert.equal(harness.node("auto-rename-on-modify-options").hidden, false);
  assert.equal(
    harness.node("auto-rename-on-modify-debounce-ms").disabled,
    true,
  );
  assert.equal(harness.node("auto-rename-on-modify-delay-ms").disabled, false);
  assertStatus("ready");
  assertNoFileOperations();
});

test("stored mode is ready without a destination and hides irrelevant directory settings", async () => {
  setup({ prefs: { workMode: "stored", destDir: "" } });
  await harness.register();

  assert.equal(harness.node("dest-setting").hidden, true);
  assert.equal(harness.node("target-layout-settings").hidden, true);
  assert.equal(harness.node("auto-remove-empty-folder").hidden, true);
  assert.equal(harness.state().ready, "true");
  assert.equal(harness.state().title, "zoteroattanger-work-mode-status-stored");
  assert.deepEqual(harness.existsCalls, []);
  assertNoFileOperations();
});

test("mode changes show only the relevant settings and preserve custom rules and destination", async () => {
  setup({ prefs: { destDir: "/dest", subfolderFormat: "{{title}}/{{year}}" } });
  await harness.register();

  for (const mode of ["linked", "copy", "stored"]) {
    await harness.chooseMode(mode);
    assert.equal(harness.getPref("workMode"), mode);
    assert.equal(harness.node("dest-setting").hidden, mode === "stored");
    assert.equal(
      harness.node("target-layout-settings").hidden,
      mode === "stored",
    );
    assert.equal(
      harness.node("auto-remove-empty-folder").hidden,
      mode === "stored",
    );
    assert.equal(harness.node("dest-dir").value, "/dest");
    for (const card of harness.window.document.querySelectorAll(
      "[data-mode-card]",
    )) {
      assert.equal(
        card.getAttribute("data-selected"),
        String(card.getAttribute("data-mode-card") === mode),
      );
    }
    for (const note of harness.window.document.querySelectorAll(
      "[data-work-mode]",
    )) {
      assert.equal(note.hidden, note.getAttribute("data-work-mode") !== mode);
    }
    assert.equal(harness.getPref("subfolderFormat"), "{{title}}/{{year}}");
    assert.equal(harness.getPref("destDir"), "/dest");
  }
  assert.equal(harness.menuRefreshes, 3);
  assertNoFileOperations();
});

test("settings bind and refresh only the plugin's controls when native preferences use matching IDs and classes", async () => {
  setup({ autoRenameFiles: true });
  const nativePane = harness.addNativeControl("vbox", {
    id: "zotero-prefpane-general",
  });
  const nativeRename = harness.addNativeControl(
    "checkbox",
    { id: "auto-rename" },
    nativePane,
  );
  const nativeRow = harness.addNativeControl("hbox", {}, nativePane);
  const nativeEnable = harness.addNativeControl(
    "checkbox",
    {
      class: "shortcut-enable",
      preference: "extensions.native.shortcut.enable",
    },
    nativeRow,
  );
  const nativeInput = harness.addNativeControl(
    "input",
    { class: "shortcut", preference: "extensions.native.shortcut" },
    nativeRow,
  );
  nativeInput.value = "Native shortcut";
  nativeInput.style.opacity = "0.72";
  harness.prefs.set("extensions.native.shortcut.enable", false);
  harness.prefs.set("extensions.native.shortcut", "Native shortcut");
  assert.equal(
    harness.window.document.querySelector("#auto-rename"),
    nativeRename,
  );
  assert.equal(harness.window.document.querySelector(".shortcut"), nativeInput);

  await harness.register();
  const root = harness.node("zotero-prefpane-zoteroattanger");
  const ownRename = root.querySelector("#auto-rename");
  assert.equal(ownRename.checked, true);
  assert.equal(nativeRename.checked, false);
  assert.equal(nativeRename.listenerCount("command"), 0);
  assert.equal(nativeEnable.listenerCount("command"), 0);
  assert.equal(nativeInput.listenerCount("keydown"), 0);
  assert.equal(nativeInput.disabled, false);
  assert.equal(nativeInput.style.opacity, "0.72");
  await nativeRename.emit("command");
  await nativeEnable.emit("command");
  await nativeInput.emit("keydown", { ctrlKey: true, key: "j" });
  await harness.clock.runAll();
  assert.equal(harness.prefs.get("autoRenameFiles"), true);
  assert.equal(harness.prefs.get("extensions.native.shortcut.enable"), false);
  assert.equal(
    harness.prefs.get("extensions.native.shortcut"),
    "Native shortcut",
  );
  assert.equal(nativeInput.value, "Native shortcut");
  assert.equal(harness.menuRefreshes, 0);

  ownRename.checked = false;
  await ownRename.emit("command");
  assert.equal(harness.prefs.get("autoRenameFiles"), false);
  assert.equal(
    root.querySelector("#rule-preview-value").textContent,
    "paper-2026.pdf",
  );
  assert.equal(nativeRename.checked, false);
  assert.equal(nativeInput.style.opacity, "0.72");
  assertNoFileOperations();
});

for (const mode of ["linked", "copy"]) {
  for (const [label, options, expected] of [
    ["missing directory", { prefs: { destDir: "" } }, "missing"],
    ["whitespace-only directory", { prefs: { destDir: "  " } }, "missing"],
    ["nonexistent directory", { prefs: { destDir: "/not-found" } }, "invalid"],
    [
      "file instead of a directory",
      { prefs: { destDir: "/file.pdf" }, files: ["/file.pdf"] },
      "invalid",
    ],
    ["Zotero storage directory", { prefs: { destDir: "/storage" } }, "unsafe"],
    [
      "Zotero storage subdirectory",
      { prefs: { destDir: "/storage/PAPER" }, directories: ["/storage/PAPER"] },
      "unsafe",
    ],
    [
      "symbolic-link directory",
      {
        prefs: { destDir: "/alias" },
        directories: ["/alias"],
        symlinks: { "/alias": "/storage" },
      },
      "unsafe",
    ],
    [
      "read-only directory",
      { prefs: { destDir: "/dest" }, readOnlyDirectories: ["/dest"] },
      "readonly",
    ],
    ["valid writable directory", { prefs: { destDir: "/dest" } }, "ready"],
  ]) {
    test(`${mode} mode reports ${label} correctly`, async () => {
      setup({ ...options, prefs: { ...options.prefs, workMode: mode } });
      await harness.register();
      assertStatus(expected);
      assert.equal(harness.node("dest-setting").hidden, false);
      assert.equal(
        harness.node("dest-dir-label").getAttribute("data-l10n-id"),
        `zoteroattanger-work-mode-${mode}-directory`,
      );
      assertNoFileOperations();
    });
  }
}

test("directory pickers use the preferences window, preserve cancellation, and update only the chosen path", async () => {
  setup({
    directories: ["/new-dest", "/new-source"],
    prefs: { workMode: "linked" },
  });
  await harness.register();
  const before = new Map(harness.prefs);
  harness.pickerResults.push({ cancelled: true });
  await harness.node("choose-dest-dir").emit("command");
  assert.deepEqual(harness.prefs, before);
  assertStatus("ready");
  assert.equal(harness.pickerCalls[0].owner, harness.window);
  assert.equal(harness.pickerCalls[0].displayDirectory, "/dest");

  harness.pickerResults.push({ path: "/new-dest/" });
  await harness.node("choose-dest-dir").emit("command");
  assert.equal(harness.getPref("destDir"), "/new-dest/");
  assert.equal(harness.getPref("sourceDir"), "/source");
  assert.equal(harness.node("dest-dir").value, "/new-dest/");

  harness.pickerResults.push({ path: "/new-source" });
  await harness.node("choose-source-dir").emit("command");
  assert.equal(harness.getPref("sourceDir"), "/new-source");
  assert.equal(harness.getPref("destDir"), "/new-dest/");
  assert.equal(harness.node("source-dir").value, "/new-source");
  assert.equal(harness.pickerCalls[2].owner, harness.window);
  assertNoFileOperations();
});

test("extra download folders are added, deduplicated, rendered, and removed without touching sourceDir", async () => {
  setup({ directories: ["/downloads-2"], prefs: { workMode: "stored" } });
  await harness.register();
  const list = harness.node("extra-source-dirs");
  assert.equal(list.hidden, true);

  harness.pickerResults.push({ path: "/downloads-2" });
  await harness.node("add-source-dir").emit("command");
  assert.equal(harness.getPref("sourceDir"), "/source");
  assert.equal(harness.getPref("extraSourceDirs"), '["/downloads-2"]');
  assert.equal(list.hidden, false);
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].children[0].value, "/downloads-2");

  // The primary folder and an existing extra folder are not added twice.
  harness.pickerResults.push({ path: "/source" }, { path: "/downloads-2" });
  await harness.node("add-source-dir").emit("command");
  await harness.node("add-source-dir").emit("command");
  assert.equal(harness.getPref("extraSourceDirs"), '["/downloads-2"]');

  const remove = list.children[0].children[1];
  assert.equal(
    remove.getAttribute("data-l10n-id"),
    "zoteroattanger-remove-source-dir",
  );
  await list.emit("command", { target: remove });
  assert.equal(harness.getPref("extraSourceDirs"), "[]");
  assert.equal(harness.getPref("sourceDir"), "/source");
  assert.equal(list.hidden, true);
  assertNoFileOperations();
});

test("adding a download folder fills the primary slot first", async () => {
  setup({
    directories: ["/first"],
    prefs: { workMode: "stored", sourceDir: "" },
  });
  await harness.register();
  harness.pickerResults.push({ path: "/first" });
  await harness.node("add-source-dir").emit("command");
  assert.equal(harness.getPref("sourceDir"), "/first");
  assert.equal(harness.getPref("extraSourceDirs"), undefined);
});

test("a picker result arriving after unload cannot change paths", async () => {
  setup({ directories: ["/new-dest"], prefs: { workMode: "linked" } });
  await harness.register();
  const result = deferred();
  harness.pickerResults.push(result.promise);
  const choosing = harness.node("choose-dest-dir").emit("command");
  await harness.settle();
  assert.equal(harness.pickerCalls.length, 1);
  await harness.window.emit("unload");
  result.resolve({ path: "/new-dest" });
  await choosing;
  assert.equal(harness.getPref("destDir"), "/dest");
  assertNoFileOperations();
});

test("a picker from a replaced window cannot overwrite the active window's destination", async () => {
  setup({
    directories: ["/old-choice", "/new-choice"],
    prefs: { workMode: "linked" },
  });
  await harness.register();
  const result = deferred();
  harness.pickerResults.push(result.promise);
  const choosing = harness.node("choose-dest-dir").emit("command");
  await harness.settle();
  const newWindow = harness.createWindow();
  await harness.register(newWindow);
  harness.pickerResults.push({ path: "/new-choice" });
  await harness.node("choose-dest-dir", newWindow).emit("command");
  result.resolve({ path: "/old-choice" });
  await choosing;
  assert.equal(harness.getPref("destDir"), "/new-choice");
  assert.equal(harness.node("dest-dir", newWindow).value, "/new-choice");
  assertNoFileOperations();
});

test("a preferences window without FilePicker uses Zotero's native picker module", async () => {
  setup({ directories: ["/native-choice"], prefs: { workMode: "linked" } });
  const FilePicker = harness.window.FilePicker;
  delete harness.window.FilePicker;
  const imports = [];
  global.ChromeUtils = {
    importESModule(url) {
      imports.push(url);
      return { FilePicker };
    },
  };
  await harness.register();
  harness.pickerResults.push({ path: "/native-choice" });
  await harness.node("choose-dest-dir").emit("command");
  assert.ok(imports.includes("chrome://zotero/content/modules/filePicker.mjs"));
  assert.equal(harness.pickerCalls[0].owner, harness.window);
  assert.equal(harness.getPref("destDir"), "/native-choice");
  assertStatus("ready");
  assertNoFileOperations();
});

test("folder presets persist actual templates and choosing custom does not erase the existing rule", async () => {
  setup({
    prefs: { workMode: "linked", subfolderFormat: "{{firstCreator}}/{{year}}" },
  });
  await harness.register();
  const selector = harness.node("subfolder-layout");
  const template = harness.node("subfolder-format");

  selector.value = "custom";
  await selector.emit("command");
  assert.equal(harness.getPref("subfolderFormat"), "{{firstCreator}}/{{year}}");
  assert.equal(harness.window.document.activeElement, template);

  for (const [layout, value] of [
    ["collection", "{{collection}}"],
    ["year", "{{year}}"],
    ["flat", ""],
  ]) {
    selector.value = layout;
    await selector.emit("command");
    assert.equal(harness.getPref("subfolderFormat"), value);
    assert.equal(harness.node("subfolder-custom-settings").hidden, true);
    assert.equal(selector.value, layout);
  }

  selector.value = "custom";
  await selector.emit("command");
  assert.equal(harness.getPref("subfolderFormat"), "");
  assert.equal(harness.node("subfolder-custom-settings").hidden, false);
  template.value = "{{collection}}/{{year}}";
  await template.emit("change");
  assert.equal(harness.getPref("subfolderFormat"), "{{collection}}/{{year}}");
  assert.equal(selector.value, "custom");
  assertNoFileOperations();
});

test("preview uses the native filename formatter and real folder rules without saving an item", async () => {
  const formatterCalls = [];
  setup({
    autoRenameFiles: true,
    prefs: { workMode: "copy", subfolderFormat: "{{collection}}/{{year}}" },
    formatFilename(item, formatting) {
      formatterCalls.push({ item, formatting });
      return formatting.formatString === "{{year}}"
        ? "2026"
        : "Native filename";
    },
  });
  const originalFileNameHelper = global.Zotero.File.getValidFileName;
  await harness.register();
  assert.equal(
    harness.node("rule-preview-value").textContent,
    "/dest/Machine Learning/2026/Native filename.pdf",
  );
  assert.equal(
    harness.node("rule-preview-title").getAttribute("data-l10n-id"),
    "zoteroattanger-rules-preview-path",
  );
  assert.equal(
    formatterCalls.some(
      ({ formatting }) => formatting.attachmentTitle === "PDF",
    ),
    true,
  );
  assert.equal(
    formatterCalls.some(
      ({ formatting }) => formatting.formatString === "{{year}}",
    ),
    true,
  );
  assert.equal(global.Zotero.File.getValidFileName, originalFileNameHelper);
  assertNoFileOperations();
});

for (const [name, template, expected] of [
  ["collection", "{{collection}}", "Machine Learning/paper-2026.pdf"],
  ["year", "{{year}}", "2026/paper-2026.pdf"],
  [
    "nested custom",
    "{{collection}}/{{year}}/{{firstCreator}}",
    "Machine Learning/2026/Wang/paper-2026.pdf",
  ],
]) {
  test(`an unconfigured destination previews a localized ${name} path with Gecko path rules`, async () => {
    setup({
      prefs: { workMode: "linked", destDir: "", subfolderFormat: template },
    });
    await harness.register();
    const preview = harness.node("rule-preview-value");
    assert.equal(
      preview.getAttribute("data-l10n-id"),
      "zoteroattanger-rules-preview-unconfigured",
    );
    assert.deepEqual(JSON.parse(preview.getAttribute("data-l10n-args")), {
      path: expected,
    });
    assert.equal(
      harness.node("rule-preview-title").getAttribute("data-l10n-id"),
      "zoteroattanger-rules-preview-path",
    );
    assert.deepEqual(harness.joinRelativeCalls, []);
    assertStatus("missing");
    assertNoFileOperations();
  });
}

test("an existing nested slash template previews below an absolute destination", async () => {
  setup({
    prefs: {
      workMode: "copy",
      subfolderFormat: "{{firstCreator}}/{{year}}/{{title}}",
    },
  });
  await harness.register();
  const preview = harness.node("rule-preview-value");
  assert.equal(
    preview.textContent,
    "/dest/Wang/2026/Learning representations/paper-2026.pdf",
  );
  assert.equal(preview.getAttribute("data-l10n-id"), null);
  assert.ok(
    harness.joinRelativeCalls.some(
      ([base, relative]) =>
        base === "/dest" &&
        relative === "Wang/2026/Learning representations/paper-2026.pdf",
    ),
  );
  assert.equal(
    harness.getPref("subfolderFormat"),
    "{{firstCreator}}/{{year}}/{{title}}",
  );
  assert.equal(harness.node("subfolder-layout").value, "custom");
  assertNoFileOperations();
});

for (const [name, prefs, expected] of [
  [
    "skip-renaming rule",
    { filenameSkipRenameRules: "^paper-2026$" },
    "/dest/2026/paper-2026.pdf",
  ],
  [
    "original filename prefix",
    { filenameAsPrefixRules: "^paper-2026$" },
    "/dest/2026/paper-2026_Wang - 2026 - Learning representations.pdf",
  ],
  [
    "comma-separated patterns",
    { filenameSkipRenameRules: "^other$, ^paper-2026$" },
    "/dest/2026/paper-2026.pdf",
  ],
  [
    "leading whitespace is part of a regex",
    { filenameSkipRenameRules: " ^paper-2026$" },
    "/dest/2026/Wang - 2026 - Learning representations.pdf",
  ],
  [
    "invalid pattern ignored",
    { filenameSkipRenameRules: "[bad, ^paper-2026$" },
    "/dest/2026/paper-2026.pdf",
  ],
]) {
  test(`preview respects ${name}`, async () => {
    setup({
      autoRenameFiles: true,
      prefs: { workMode: "copy", subfolderFormat: "{{year}}", ...prefs },
    });
    await harness.register();
    assert.equal(harness.node("rule-preview-value").textContent, expected);
    assertNoFileOperations();
  });
}

for (const [name, prefs] of [
  ["excluded file type", { fileTypes: "docx,epub" }],
  [
    "skip-auto-organizing rule",
    { filenameSkipAutoMoveRenameRules: "^paper-2026$" },
  ],
]) {
  test(`preview explains that ${name} leaves the sample in place`, async () => {
    setup({
      autoRenameFiles: true,
      prefs: { workMode: "linked", subfolderFormat: "{{year}}", ...prefs },
    });
    await harness.register();
    assert.equal(
      harness.node("rule-preview-value").textContent,
      "paper-2026.pdf",
    );
    assert.equal(
      harness.node("rule-preview-title").getAttribute("data-l10n-id"),
      "zoteroattanger-rules-preview-filename",
    );
    assert.equal(
      harness.node("rule-preview-note").getAttribute("data-l10n-id"),
      "zoteroattanger-rules-preview-skipped",
    );
    assertNoFileOperations();
  });
}

test("auto-rename changes Zotero's existing setting and refreshes its summary and preview", async () => {
  setup({ prefs: { workMode: "stored" } });
  await harness.register();
  assert.equal(
    harness.node("rule-preview-value").textContent,
    "paper-2026.pdf",
  );

  const rename = harness.node("auto-rename");
  rename.checked = true;
  await rename.emit("command");
  assert.equal(harness.prefs.get("autoRenameFiles"), true);
  assert.equal(
    harness.node("rule-preview-value").textContent,
    "Wang - 2026 - Learning representations.pdf",
  );
  assert.equal(
    JSON.parse(
      harness.node("organizing-rules-summary").getAttribute("data-l10n-args"),
    ).rename,
    "enabled",
  );

  await harness.node("attanger-file-renaming-button").emit("command");
  assert.deepEqual(harness.renameDialogCalls, [harness.window]);
  global.Zotero.Prefs.set("autoRenameFiles", false);
  await harness.settle();
  assert.equal(rename.checked, false);
  assert.equal(
    harness.node("rule-preview-value").textContent,
    "paper-2026.pdf",
  );
  assertNoFileOperations();
});

test("Zotero versions with the native filename subpane navigate to that editor", async () => {
  setup();
  const controller = harness.window.Zotero_Preferences;
  controller.panes.set("zotero-subpane-file-renaming", {});
  await harness.register();
  await harness.node("attanger-file-renaming-button").emit("command");
  assert.equal(harness.renamePaneCalls.length, 1);
  assert.equal(harness.renamePaneCalls[0].window, harness.window);
  assert.equal(harness.renamePaneCalls[0].pane, "zotero-subpane-file-renaming");
  assert.equal(harness.renameDialogCalls.length, 0);
  assertNoFileOperations();
});

test("Zotero 7-style scoped general preferences open the native filename dialog", async () => {
  setup();
  const controller = harness.window.Zotero_Preferences;
  const general = controller.General;
  delete controller.General;
  const requested = [];
  controller.getScope = (pane) => {
    requested.push(pane);
    return { Zotero_Preferences: { General: general } };
  };
  await harness.register();
  await harness.node("attanger-file-renaming-button").emit("command");
  assert.ok(requested.includes("zotero-prefpane-general"));
  assert.deepEqual(harness.renameDialogCalls, [harness.window]);
  assert.equal(harness.renamePaneCalls.length, 0);
  assertNoFileOperations();
});

test("the filename editor opens through the window service when general preferences are not loaded", async () => {
  setup();
  delete harness.window.Zotero_Preferences.General;
  harness.window.Zotero_Preferences.getScope = () => undefined;
  await harness.register();
  await harness.node("attanger-file-renaming-button").emit("command");
  assert.equal(harness.nativeWindowCalls.length, 1);
  const opened = harness.nativeWindowCalls[0];
  assert.equal(opened.owner, harness.window);
  assert.equal(opened.url, "chrome://zotero/content/fileRenamingDialog.xhtml");
  assert.equal(opened.name, "zotero-file-renaming-dialog");
  assert.ok(opened.features.includes("chrome"));
  assert.equal(opened.arguments_, null);
  assert.equal(harness.renameDialogCalls.length, 0);
  assert.equal(harness.renamePaneCalls.length, 0);
  assertNoFileOperations();
});

test("returning from the native filename subpane refreshes the example on pane showing", async () => {
  let nativeName = "Old native rule";
  setup({ autoRenameFiles: true, formatFilename: () => nativeName });
  harness.window.Zotero_Preferences.panes.set(
    "zotero-subpane-file-renaming",
    {},
  );
  await harness.register();
  const preview = harness.node("rule-preview-value");
  assert.equal(preview.textContent, "Old native rule.pdf");
  await harness.node("attanger-file-renaming-button").emit("command");
  nativeName = "Updated native rule";
  assert.equal(preview.textContent, "Old native rule.pdf");
  await harness.node("zotero-prefpane-zoteroattanger").emit("showing");
  await harness.settle();
  assert.equal(preview.textContent, "Updated native rule.pdf");
  assertNoFileOperations();
});

test("preferences search expands every own disclosure and restores the user's section states", async () => {
  setup();
  const root = harness.node("zotero-prefpane-zoteroattanger");
  const sections = root.querySelectorAll("details");
  assert.ok(sections.length > 3, "fixture must include nested disclosures");
  assert.equal(harness.node("attachment-storage-settings").open, true);
  harness.node("attachment-rule-settings").open = true;
  sections.at(-1).open = true;
  const previous = sections.map((section) => section.open);
  const outside = harness.node("native-pref-section");
  const search = harness.node("prefs-search");
  await harness.register();
  assert.deepEqual(
    sections.map((section) => section.open),
    previous,
  );
  search.value = "shortcuts";
  await search.emit("input");
  assert.equal(
    sections.every((section) => section.open),
    true,
  );
  assert.equal(outside.open, false);
  search.value = "filename";
  await search.emit("command");
  assert.equal(
    sections.every((section) => section.open),
    true,
  );
  search.value = "";
  await search.emit("input");
  assert.deepEqual(
    sections.map((section) => section.open),
    previous,
  );
  assert.equal(outside.open, false);
  assertNoFileOperations();
});

test("a search already entered before registration expands sections and clearing it restores defaults", async () => {
  setup();
  const root = harness.node("zotero-prefpane-zoteroattanger");
  const sections = root.querySelectorAll("details");
  const previous = sections.map((section) => section.open);
  const search = harness.node("prefs-search");
  search.value = "download";
  await harness.register();
  assert.equal(
    sections.every((section) => section.open),
    true,
  );
  search.value = "   ";
  await search.emit("command");
  assert.deepEqual(
    sections.map((section) => section.open),
    previous,
  );
  assertNoFileOperations();
});

test("showing the pane refreshes search expansion and unloading restores its previous states", async () => {
  setup();
  await harness.register();
  const root = harness.node("zotero-prefpane-zoteroattanger");
  const sections = root.querySelectorAll("details");
  const previous = sections.map((section) => section.open);
  const search = harness.node("prefs-search");
  search.value = "timing";
  await root.emit("showing");
  await harness.settle();
  assert.equal(
    sections.every((section) => section.open),
    true,
  );
  await harness.window.emit("unload");
  assert.deepEqual(
    sections.map((section) => section.open),
    previous,
  );
  assert.equal(search.listenerCount("input"), 0);
  assert.equal(search.listenerCount("command"), 0);
  assert.equal(root.listenerCount("showing"), 0);
  await search.emit("input");
  assert.deepEqual(
    sections.map((section) => section.open),
    previous,
  );
});

test("preference observers and focus refresh a changed path and preserve active custom edits", async () => {
  setup({ prefs: { workMode: "linked", subfolderFormat: "{{title}}" } });
  await harness.register();
  const template = harness.node("subfolder-format");
  template.focus();
  template.value = "{{year}}/{{title}}";
  harness.setPref("destDir", "/not-found");
  await harness.settle();
  assertStatus("invalid");
  assert.equal(harness.node("dest-dir").value, "/not-found");
  assert.equal(template.value, "{{year}}/{{title}}");
  assert.equal(harness.getPref("subfolderFormat"), "{{title}}");

  harness.prefs.set(`${PREF_PREFIX}.destDir`, "/dest");
  await harness.window.emit("focus");
  await harness.settle();
  assertStatus("ready");
  assert.equal(harness.node("dest-dir").value, "/dest");
});

test("an in-flight directory check shows checking, not stale readiness", async () => {
  const check = deferred();
  setup({
    exists: (value, fallback) =>
      value === "/slow" ? check.promise : fallback(),
    directories: ["/slow"],
  });
  await harness.register();
  harness.setPref("destDir", "/slow");
  const change = harness.chooseMode("linked");
  await harness.settle();
  assertStatus("checking");
  check.resolve(true);
  await change;
  assertStatus("ready");
});

test("stale directory validation cannot overwrite a newer work mode or destination", async () => {
  const check = deferred();
  setup({
    directories: ["/slow"],
    exists: (value, fallback) =>
      value === "/slow" ? check.promise : fallback(),
  });
  await harness.register();
  harness.setPref("destDir", "/slow");
  const pending = harness.chooseMode("linked");
  await harness.settle();

  await harness.chooseMode("stored");
  assert.equal(harness.state().title, "zoteroattanger-work-mode-status-stored");
  check.resolve(true);
  await pending;
  assert.equal(harness.state().title, "zoteroattanger-work-mode-status-stored");
  assert.equal(harness.node("dest-setting").hidden, true);
  assertNoFileOperations();
});

test("an old path validation cannot replace the latest missing-directory status", async () => {
  const check = deferred();
  setup({
    directories: ["/slow"],
    exists: (value, fallback) =>
      value === "/slow" ? check.promise : fallback(),
  });
  await harness.register();
  harness.setPref("destDir", "/slow");
  const pending = harness.chooseMode("copy");
  await harness.settle();
  harness.setPref("destDir", "");
  await harness.settle();
  assertStatus("missing");
  check.resolve(true);
  await pending;
  assertStatus("missing");
  assert.equal(harness.node("dest-dir").value, "");
});

test("re-registering the same window does not accumulate handlers or preference observers", async () => {
  setup();
  await harness.register();
  const observerCount = harness.prefObservers.size;
  assert.ok(observerCount > 0);
  await harness.register();
  assert.equal(harness.prefObservers.size, observerCount);
  assert.equal(harness.window.listenerCount("focus"), 1);
  assert.equal(harness.window.listenerCount("unload"), 1);
  harness.prefWrites.length = 0;
  await harness.chooseMode("copy");
  assert.equal(harness.menuRefreshes, 1);
  assert.deepEqual(
    harness.prefWrites.filter(({ key }) => key === `${PREF_PREFIX}.workMode`),
    [{ key: `${PREF_PREFIX}.workMode`, value: "copy" }],
  );
});

test("unload and explicit unregister are idempotent and stop updates and actions", async () => {
  setup();
  await harness.register();
  const registered = harness.prefObservers.size;
  const state = harness.state();
  await harness.window.emit("unload");
  harness.preferences.unregisterPrefsScripts();
  harness.preferences.unregisterPrefsScripts();
  assert.equal(harness.prefObservers.size, 0);
  assert.equal(new Set(harness.removedPrefObservers).size, registered);
  assert.equal(harness.removedPrefObservers.length, registered);
  assert.equal(harness.window.listenerCount("focus"), 0);
  harness.setPref("destDir", "");
  await harness.window.emit("focus");
  await harness.node("choose-dest-dir").emit("command");
  await harness.chooseMode("linked");
  assert.deepEqual(harness.state(), state);
  assert.equal(harness.getPref("workMode"), "stored");
  assert.equal(harness.pickerCalls.length, 0);
});

test("replacing the preferences window detaches the old controls", async () => {
  setup();
  await harness.register();
  const oldWindow = harness.window;
  const newWindow = harness.createWindow();
  await harness.register(newWindow);
  assert.equal(oldWindow.listenerCount("focus"), 0);
  harness.node("auto-rename", oldWindow).checked = true;
  await harness.node("auto-rename", oldWindow).emit("command");
  await harness.chooseMode("linked", oldWindow);
  assert.equal(harness.prefs.get("autoRenameFiles"), false);
  assert.equal(harness.getPref("workMode"), "stored");
  await harness.chooseMode("copy", newWindow);
  assert.equal(harness.getPref("workMode"), "copy");
  assert.equal(harness.node("work-mode", newWindow).value, "copy");
});

test("unloading while validation is pending prevents delayed updates", async () => {
  const check = deferred();
  setup({
    directories: ["/slow"],
    prefs: { workMode: "copy", destDir: "/slow" },
    exists: (value, fallback) =>
      value === "/slow" ? check.promise : fallback(),
  });
  const pending = harness.register();
  await harness.settle();
  await harness.window.emit("unload");
  const state = harness.state();
  check.resolve(true);
  await pending;
  assert.deepEqual(harness.state(), state);
  assert.equal(harness.prefObservers.size, 0);
  assertNoFileOperations();
});

test("timing controls and existing shortcut controls still persist user edits", async () => {
  setup();
  await harness.register();
  const automatic = harness.node("auto-rename-on-modify");
  automatic.checked = true;
  await automatic.emit("command");
  assert.equal(harness.node("auto-rename-on-modify-options").hidden, false);

  const debounce = harness.node("auto-rename-on-modify-debounce");
  debounce.checked = false;
  await debounce.emit("command");
  assert.equal(harness.getPref("autoRenameOnModifyDebounceEnabled"), false);
  assert.equal(
    harness.node("auto-rename-on-modify-debounce-ms").disabled,
    true,
  );
  const delay = harness.node("auto-rename-on-modify-delay");
  delay.checked = true;
  await delay.emit("command");
  const delayMs = harness.node("auto-rename-on-modify-delay-ms");
  delayMs.value = "240.5";
  await delayMs.emit("change");
  assert.equal(harness.getPref("autoRenameOnModifyDelayMs"), 240);
  delayMs.value = "-100";
  await delayMs.emit("change");
  assert.equal(harness.getPref("autoRenameOnModifyDelayMs"), 0);

  const shortcuts = harness.window.document.querySelectorAll(
    "checkbox.shortcut-enable",
  );
  assert.equal(shortcuts.length, 5);
  for (const shortcut of shortcuts) {
    const input = shortcut.closest("hbox").querySelector("input.shortcut");
    shortcut.checked = false;
    await shortcut.emit("command");
    assert.equal(input.disabled, true);
    shortcut.checked = true;
    await shortcut.emit("command");
    assert.equal(input.disabled, false);
  }
  const input = shortcuts[0].closest("hbox").querySelector("input.shortcut");
  await input.emit("keydown", { ctrlKey: true, shiftKey: true, key: "j" });
  await harness.clock.runAll();
  assert.equal(
    harness.prefs.get(input.getAttribute("preference")),
    "Ctrl + Shift + J",
  );
  assertNoFileOperations();
});

test("pending shortcut capture is cancelled when settings unload", async () => {
  setup();
  await harness.register();
  const input = harness.window.document.querySelector("input.shortcut");
  const pref = input.getAttribute("preference");
  const previous = harness.prefs.get(pref);
  await input.emit("keydown", { ctrlKey: true, key: "q" });
  assert.equal(harness.clock.tasks.size, 1);
  await harness.window.emit("unload");
  await harness.clock.runAll();
  assert.equal(harness.prefs.get(pref), previous);
  assert.equal(harness.menuRefreshes, 0);
});
