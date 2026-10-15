// Bundles the TypeScript adapter test so it runs under `node --test tests/*.test.cjs`.
const path = require("node:path");
const esbuild = require("esbuild");

const result = esbuild.buildSync({
  entryPoints: [path.join(__dirname, "ts/contextMenu.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  write: false,
  logLevel: "silent",
});
const module_ = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(
  require,
  module_,
  module_.exports,
);
