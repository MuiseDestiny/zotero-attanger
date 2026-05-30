const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          experimentalDecorators: true,
          module: "commonjs",
          target: "ES2016",
          resolveJsonModule: true,
          skipLibCheck: true,
          strict: false,
          noImplicitAny: false,
        },
        isolatedModules: true,
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    "^zotero-plugin-toolkit$": "<rootDir>/src/__mocks__/zotero-plugin-toolkit.ts",
  },
};