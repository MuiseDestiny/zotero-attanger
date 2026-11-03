const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");

test("PDF preview uses a native document and a confined list instead of a toolkit dialog", () => {
  const xhtml = fs.readFileSync(
    "addon/chrome/content/unusedPDFPreview.xhtml",
    "utf8",
  );
  const css = fs.readFileSync(
    "addon/chrome/content/unusedPDFPreview.css",
    "utf8",
  );
  const script = fs.readFileSync("src/modules/unusedPDFPreview.ts", "utf8");
  const rule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`${escaped} \\{([^}]+)\\}`));
    assert.ok(match, `Missing layout rule ${selector}`);
    return match[1];
  };
  assert.match(xhtml, /<window\s+xmlns="http:\/\/www.mozilla.org\/keymaster/);
  for (const skin of [
    "chrome://global/skin/",
    "chrome://zotero/skin/zotero.css",
    "chrome://zotero-platform/content/zotero.css",
    "chrome://__addonRef__/content/unusedPDFPreview.css",
  ])
    assert.ok(xhtml.includes(skin));
  assert.match(xhtml, /chrome:\/\/zotero\/content\/customElements.js/);
  assert.match(xhtml, /<button id="unused-pdf-trash"/);
  assert.match(script, /Services\.ww\.openWindow/);
  assert.doesNotMatch(script, /new ztoolkit\.Dialog|innerHTML/);
  assert.match(rule("#attanger-unused-pdf-preview"), /display: flex/);
  assert.match(rule("#attanger-unused-pdf-preview"), /overflow: hidden/);
  assert.match(rule("#unused-pdf-content"), /flex: 1/);
  assert.match(rule("#unused-pdf-content"), /min-height: 0/);
  assert.match(rule("#unused-pdf-content"), /overflow: hidden/);
  assert.match(rule("#unused-pdf-list"), /flex: 1 1 0/);
  assert.match(rule("#unused-pdf-list"), /min-height: 0/);
  assert.match(rule("#unused-pdf-list"), /overflow: auto/);
  assert.match(rule("#unused-pdf-footer"), /flex: 0 0 auto/);
  assert.match(
    rule(".unused-pdf-row"),
    /grid-template-columns: 18px minmax\(0, 1fr\) 80px 100px/,
  );
  assert.match(rule(".unused-pdf-name > span"), /text-overflow: ellipsis/);
  assert.match(rule(".unused-pdf-reveal"), /min-width: 100px/);
  assert.match(rule(".unused-pdf-reveal"), /white-space: nowrap/);
});

test("selection labels exist in every supported locale", () => {
  for (const locale of ["de", "en-US", "it-IT", "zh-CN"]) {
    const ftl = fs.readFileSync(`addon/locale/${locale}/addon.ftl`, "utf8");
    for (const key of [
      "unused-pdf-select-all",
      "unused-pdf-selected",
      "unused-pdf-recycling",
    ]) {
      assert.equal(
        ftl.split("\n").filter((line) => line.startsWith(`${key} =`)).length,
        1,
      );
    }
  }
});
