const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = process.cwd();

test("auto-rename preferences have defaults and checkbox controls", () => {
  const prefs = fs.readFileSync(path.join(root, "addon/prefs.js"), "utf8");
  const preferences = fs.readFileSync(
    path.join(root, "addon/chrome/content/preferences.xhtml"),
    "utf8",
  );
  const preferenceScript = fs.readFileSync(
    path.join(root, "src/modules/preferenceScript.ts"),
    "utf8",
  );

  assert.match(prefs, /autoRenameOnModify", false/);
  assert.match(prefs, /autoRenameOnModifyDebounceEnabled", true/);
  assert.match(prefs, /autoRenameOnModifyDebounceMs", 1000/);
  assert.match(prefs, /autoRenameOnModifyDelayEnabled", false/);
  assert.match(prefs, /autoRenameOnModifyDelayMs", 0/);
  assert.match(preferences, /id="auto-rename-on-modify"/);
  assert.match(
    preferences,
    /<vbox id="auto-rename-on-modify-options" hidden="true" style="margin-inline-start: 2em;">/,
  );
  assert.match(preferences, /<checkbox\s+id="auto-rename-on-modify-debounce"/);
  assert.match(preferences, /<checkbox\s+id="auto-rename-on-modify-delay"/);
  assert.match(preferences, /id="auto-rename-on-modify-debounce-ms"/);
  assert.match(preferences, /id="auto-rename-on-modify-delay-ms"/);
  assert.equal(
    preferences.match(/lucide-circle-question-mark-icon/g)?.length,
    3,
  );
  assert.match(preferences, /data-l10n-id="auto-rename-on-modify-help"/);
  assert.match(
    preferences,
    /data-l10n-id="auto-rename-on-modify-debounce-help"/,
  );
  assert.match(preferences, /data-l10n-id="auto-rename-on-modify-delay-help"/);
  assert.match(
    preferences,
    /id="auto-rename-on-modify-debounce-ms"[\s\S]*?<\/html:input>\s*<hbox data-l10n-id="auto-rename-on-modify-debounce-help"/,
  );
  assert.match(
    preferences,
    /id="auto-rename-on-modify-delay-ms"[\s\S]*?<\/html:input>\s*<hbox data-l10n-id="auto-rename-on-modify-delay-help"/,
  );
  assert.equal(preferences.match(/cursor: pointer/g)?.length, 3);
  assert.doesNotMatch(preferences, /cursor: help/);
  assert.match(preferenceScript, /input\.disabled = !checkbox\?\.checked/);
  assert.match(
    preferenceScript,
    /autoRenameOptions\.hidden = !autoRenameOnModify/,
  );
  assert.match(
    preferenceScript,
    /setPref\("autoRenameOnModify", autoRenameOnModifyCheckbox\.checked\)/,
  );
  assert.doesNotMatch(preferenceScript, /checkbox\.disabled\s*=/);
});

test("new automation locale keys exist in all supported locales", () => {
  const locales = ["de", "en-US", "it-IT", "zh-CN"];
  const preferenceKeys = [
    "auto-rename-on-modify",
    "auto-rename-on-modify-debounce",
    "auto-rename-on-modify-delay",
  ];
  const helpKeys = [
    "auto-rename-on-modify-help",
    "auto-rename-on-modify-debounce-help",
    "auto-rename-on-modify-delay-help",
  ];
  const addonKeys = [
    "dir-not-set-destDir",
    "dir-not-set-sourceDir",
    "rename-linked-attachment-error",
  ];

  for (const locale of locales) {
    const preferences = fs.readFileSync(
      path.join(root, `addon/locale/${locale}/preferences.ftl`),
      "utf8",
    );
    const addon = fs.readFileSync(
      path.join(root, `addon/locale/${locale}/addon.ftl`),
      "utf8",
    );
    for (const key of preferenceKeys) {
      assert.match(
        preferences,
        new RegExp(`^${key}\\s*=\\s*\\n\\s+\\.label\\s*=`, "m"),
      );
    }
    for (const key of helpKeys) {
      assert.match(
        preferences,
        new RegExp(
          `^${key}\\s*=\\s*\\n\\s+\\.tooltiptext\\s*=.+\\n\\s+\\.aria-label\\s*=`,
          "m",
        ),
      );
    }
    if (locale === "zh-CN") {
      assert.match(preferences, /为什么开启：.+链接文件名自动同步/);
      assert.match(preferences, /推荐 1000 毫秒/);
      assert.match(preferences, /建议 300–1000 毫秒/);
    }
    for (const key of addonKeys) {
      assert.match(addon, new RegExp(`^${key}\\s*=`, "m"));
    }
  }
});

test("all README translations link to each other and document BBT and AI contributions", () => {
  const docs = [
    "README.md",
    "doc/README-zhCN.md",
    "doc/README-de.md",
    "doc/README-itIT.md",
  ];

  for (const relativeFile of docs) {
    const source = fs.readFileSync(path.join(root, relativeFile), "utf8");
    assert.match(source, /Better[ -]BibTeX/i);
    assert.match(source, /(AI|KI|IA)/);
    assert.match(source, /English/);
    assert.match(source, /简体中文/);
    assert.match(source, /Deutsch/);
    assert.match(source, /Italiano/);
  }
});
