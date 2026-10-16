const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { zip } = require("compressing");

const root = path.resolve(__dirname, "..");
const details = require("../package.json");
const buildScript = path.join(root, "scripts/build.mjs");
const updateFiles = ["update.json", "update-beta.json"];

function createBuildFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "attanger-build-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.cpSync(path.join(root, "addon"), path.join(directory, "addon"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(directory, "src"));
  fs.writeFileSync(
    path.join(directory, "src/index.ts"),
    "globalThis.ATTANGER_BUILD_MODE = __env__;\n",
  );
  fs.mkdirSync(path.join(directory, "scripts"));
  fs.copyFileSync(
    path.join(root, "scripts/update-template.json"),
    path.join(directory, "scripts/update-template.json"),
  );
  for (const filename of updateFiles) {
    fs.writeFileSync(path.join(directory, filename), `preserve ${filename}\n`);
  }
  return directory;
}

function runBuild(directory, ...args) {
  execFileSync(process.execPath, [buildScript, "production", ...args], {
    cwd: directory,
    stdio: "pipe",
  });
}

test("local build command retains type checking and production packaging", () => {
  assert.equal(
    details.scripts["build:local"],
    "tsc --noEmit && node scripts/build.mjs production --local",
  );
  assert.equal(
    details.scripts.build,
    "tsc --noEmit && node scripts/build.mjs production",
  );
});

test("local production packaging preserves public manifests and creates a valid XPI", async (t) => {
  const directory = createBuildFixture(t);
  runBuild(directory, "--local");

  for (const filename of updateFiles) {
    assert.equal(
      fs.readFileSync(path.join(directory, filename), "utf8"),
      `preserve ${filename}\n`,
    );
  }

  const archive = path.join(directory, "build", `${details.name}.xpi`);
  assert.ok(fs.statSync(archive).size > 0);
  const extracted = path.join(directory, "extracted");
  await zip.uncompress(archive, extracted);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(extracted, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.version, details.version);
  assert.equal(manifest.applications.zotero.id, details.config.addonID);
  assert.equal(
    manifest.applications.zotero.update_url,
    details.config.updateJSON,
  );
  const bundle = fs.readFileSync(
    path.join(
      extracted,
      "chrome/content/scripts",
      `${details.config.addonRef}.js`,
    ),
    "utf8",
  );
  assert.match(bundle, /ATTANGER_BUILD_MODE = "production"/);
  assert.doesNotMatch(bundle, /__env__/);
});

test("normal production build still prepares update manifests in an isolated fixture", (t) => {
  const directory = createBuildFixture(t);
  runBuild(directory);

  for (const filename of updateFiles) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, filename), "utf8"),
    );
    assert.equal(
      manifest.addons[details.config.addonID].updates[0].version,
      details.version,
    );
  }
});
