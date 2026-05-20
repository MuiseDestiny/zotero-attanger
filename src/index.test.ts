// Mock addon module - don't clear this mock in beforeEach
const MockAddon = jest.fn().mockImplementation(() => ({
  data: {
    ztoolkit: {},
  },
}));

jest.mock("./addon", () => ({
  __esModule: true,
  default: MockAddon,
}));

jest.mock("../package.json", () => ({
  config: {
    addonName: "Zotero Attanger",
    addonID: "zoteroattanger@polygon.org",
    addonRef: "zoteroattanger",
    addonInstance: "ZoteroAttanger",
    prefsPrefix: "extensions.zotero.zoteroattanger",
    releasePage: "https://github.com/muisedestiny/zotero-attanger/releases",
    updateJSON: "https://raw.githubusercontent.com/muisedestiny/zotero-attanger/main/update.json",
  },
}));

import { config } from "../package.json";

// Mock global Zotero object
const mockZotero: any = {};
const mockGlobals: { [key: string]: any } = {
  window: { OS: {}, document: {} },
  document: {},
  ZoteroPane: {},
  Zotero_Tabs: {},
};

// Mock function for getGlobal
const mockGetGlobal = jest.fn();

// Mock BasicTool - don't clear this mock in beforeEach
const MockBasicTool = jest.fn().mockImplementation(() => ({
  getGlobal: mockGetGlobal,
}));

jest.mock("zotero-plugin-toolkit", () => ({
  BasicTool: MockBasicTool,
}));

import Addon from "./addon";

// Initialize _globalThis and window for tests
(global as any)._globalThis = (global as any)._globalThis || {};
(global as any).window = (global as any).window || { OS: {}, document: {} };

// Clear mocks before each test
beforeEach(() => {
  // Reset module cache to allow re-running index.ts
  jest.resetModules();

  // Reset mock globals
  mockGlobals.window = { OS: {}, document: {} };
  mockGlobals.document = {};
  mockGlobals.ZoteroPane = {};
  mockGlobals.Zotero_Tabs = {};

  // Reset Zotero mock
  Object.keys(mockZotero).forEach((key) => {
    delete mockZotero[key];
  });

  // Clean up _globalThis
  if ((global as any)._globalThis) {
    Object.keys((global as any)._globalThis).forEach((key) => {
      delete (global as any)._globalThis[key];
    });
  }

  // Reset window global
  (global as any).window = { OS: {}, document: {} };

  // Reinitialize _globalThis
  (global as any)._globalThis = {};

  // Clear the mockGetGlobal calls only (not the constructor mocks)
  mockGetGlobal.mockClear();

  // Configure mockGetGlobal to return appropriate values
  mockGetGlobal.mockImplementation((name: string) => {
    if (name === "Zotero") {
      return mockZotero;
    }
    return mockGlobals[name as keyof typeof mockGlobals];
  });

  // Set up global addon getter/setter that reads from _globalThis.addon
  // This is needed because the source code uses `addon` without declaring it,
  // which falls back to global scope, but assigns to _globalThis.addon
  Object.defineProperty(global, "addon", {
    get: () => (global as any)._globalThis?.addon,
    set: (value) => {
      if ((global as any)._globalThis) {
        (global as any)._globalThis.addon = value;
      }
    },
    configurable: true,
  });
});

// Clear constructor mocks after all tests in this describe block
afterEach(() => {
  MockBasicTool.mockClear();
  MockAddon.mockClear();
});

describe("src/index.ts", () => {
  describe("Addon initialization", () => {
    it("should initialize addon when Zotero[addonInstance] does not exist", () => {
      // Ensure Zotero[config.addonInstance] is not defined
      mockZotero[config.addonInstance] = undefined;

      // Set up global Zotero
      (global as any).Zotero = mockZotero;

      // Execute the module code
      require("./index");

      // Verify BasicTool was instantiated
      expect(MockBasicTool).toHaveBeenCalled();

      // Verify Addon constructor was called
      expect(MockAddon).toHaveBeenCalled();

      // Verify addon was created and assigned
      expect(mockZotero[config.addonInstance]).toBeDefined();
    });

    it("should not reinitialize addon when Zotero[addonInstance] already exists", () => {
      // Create existing addon instance
      const existingAddon = { data: { ztoolkit: {} } };
      mockZotero[config.addonInstance] = existingAddon;

      // Set up global Zotero
      (global as any).Zotero = mockZotero;

      // Execute the module code
      require("./index");

      // Verify Addon constructor was not called
      expect(MockAddon).not.toHaveBeenCalled();

      // Verify addon was not recreated
      expect(mockZotero[config.addonInstance]).toBe(existingAddon);
    });

    it("should define global variables when initializing", () => {
      // Ensure Zotero[config.addonInstance] is not defined
      mockZotero[config.addonInstance] = undefined;

      // Set up global Zotero
      (global as any).Zotero = mockZotero;

      // Execute the module code
      require("./index");

      // Verify globals are defined on _globalThis
      expect((global as any)._globalThis.window).toBeDefined();
      expect((global as any)._globalThis.document).toBeDefined();
      expect((global as any)._globalThis.ZoteroPane).toBeDefined();
      expect((global as any)._globalThis.Zotero_Tabs).toBeDefined();
    });

    it("should define OS on _globalThis from window", () => {
      // Ensure Zotero[config.addonInstance] is not defined
      mockZotero[config.addonInstance] = undefined;

      // Set up global window with OS
      (global as any).window = { OS: { name: "test-os" }, document: {} };

      // Set up global Zotero
      (global as any).Zotero = mockZotero;

      // Execute the module code
      require("./index");

      // Verify OS is defined
      expect((global as any)._globalThis.OS).toEqual({ name: "test-os" });
    });

    it("should create new Addon instance and assign to _globalThis.addon", () => {
      // Ensure Zotero[config.addonInstance] is not defined
      mockZotero[config.addonInstance] = undefined;

      // Set up global Zotero
      (global as any).Zotero = mockZotero;

      // Execute the module code
      require("./index");

      // Verify addon is assigned to _globalThis
      expect((global as any)._globalThis.addon).toBeDefined();
    });

    it("should define ztoolkit getter on _globalThis", () => {
      // Ensure Zotero[config.addonInstance] is not defined
      mockZotero[config.addonInstance] = undefined;

      // Set up global Zotero
      (global as any).Zotero = mockZotero;

      // Execute the module code
      require("./index");

      // Verify ztoolkit is defined as a getter
      const descriptor = Object.getOwnPropertyDescriptor((global as any)._globalThis, "ztoolkit");
      expect(descriptor?.get).toBeDefined();
    });

    it("should assign addon instance to Zotero[config.addonInstance]", () => {
      // Ensure Zotero[config.addonInstance] is not defined
      mockZotero[config.addonInstance] = undefined;

      // Set up global Zotero
      (global as any).Zotero = mockZotero;

      // Execute the module code
      require("./index");

      // Verify addon is assigned to Zotero
      expect(mockZotero[config.addonInstance]).toBeDefined();
      expect(mockZotero[config.addonInstance]).toBe((global as any)._globalThis.addon);
    });
  });

  describe("defineGlobal function", () => {
    it("should define property with getter when no getter function is provided", () => {
      // Ensure Zotero[config.addonInstance] is not defined
      mockZotero[config.addonInstance] = undefined;

      // Set up global Zotero
      (global as any).Zotero = mockZotero;

      // Execute the module code
      require("./index");

      // Verify the property descriptor has a getter
      const descriptor = Object.getOwnPropertyDescriptor((global as any)._globalThis, "window");
      expect(descriptor?.get).toBeDefined();
      // Note: configurable defaults to false in Object.defineProperty
      expect(descriptor?.configurable).toBe(false);
      expect(descriptor?.enumerable).toBe(false);
    });

    it("should use custom getter function when provided", () => {
      // Ensure Zotero[config.addonInstance] is not defined
      mockZotero[config.addonInstance] = undefined;

      // Set up global Zotero
      (global as any).Zotero = mockZotero;

      // Execute the module code
      require("./index");

      // Verify ztoolkit uses custom getter
      const customValue = (global as any)._globalThis.ztoolkit;
      expect(customValue).toBeDefined();
    });

    it("should call basicTool.getGlobal when no custom getter is provided", () => {
      // Ensure Zotero[config.addonInstance] is not defined
      mockZotero[config.addonInstance] = undefined;

      // Set up global Zotero
      (global as any).Zotero = mockZotero;

      // Execute the module code
      require("./index");

      // Access the window property to trigger the getter
      const _ = (global as any)._globalThis.window;

      // Verify getGlobal was called
      expect(mockGetGlobal).toHaveBeenCalledWith("window");
    });
  });
});
