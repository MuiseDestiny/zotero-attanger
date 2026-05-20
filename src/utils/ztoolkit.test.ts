// Mock package.json config
jest.mock("../../package.json", () => ({
  config: {
    addonName: "TestAddon",
    addonID: "test-addon-id",
    addonRef: "test-addon",
  },
}));

// Mock the ZoteroToolkit class
const mockSetIconURI = jest.fn();

class MockZoteroToolkit {
  basicOptions = {
    log: {
      prefix: "",
      disableConsole: false,
    },
    debug: {
      disableDebugBridgePassword: false,
    },
    api: {
      pluginID: "",
    },
  };
  UI = {
    basicOptions: {
      ui: {
        enableElementJSONLog: false,
        enableElementDOMLog: false,
      },
    },
  };
  ProgressWindow = {
    setIconURI: mockSetIconURI,
  };
}

// Create a mock module path
jest.mock(
  "zotero-plugin-toolkit",
  () => ({
    ZoteroToolkit: MockZoteroToolkit,
  }),
  { virtual: true }
);

// Define __env__ global variable for tests
Object.defineProperty(globalThis, "__env__", {
  value: "development",
  writable: true,
  configurable: true,
});

import { createZToolkit } from "./ztoolkit";

describe("ztoolkit", () => {
  const originalEnv = (globalThis as any).__env__;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetIconURI.mockClear();
    (globalThis as any).__env__ = "development";
  });

  afterAll(() => {
    (globalThis as any).__env__ = originalEnv;
  });

  describe("createZToolkit", () => {
    it("should create a new ZoteroToolkit instance", () => {
      const ztoolkit = createZToolkit();

      expect(ztoolkit).toBeDefined();
      expect(ztoolkit.basicOptions).toBeDefined();
      expect(ztoolkit.UI).toBeDefined();
      expect(ztoolkit.ProgressWindow).toBeDefined();
    });

    it("should set the log prefix to addon name in brackets", () => {
      (globalThis as any).__env__ = "development";
      const ztoolkit = createZToolkit();

      expect(ztoolkit.basicOptions.log.prefix).toBe("[TestAddon]");
    });

    it("should disable console logging in production environment", () => {
      (globalThis as any).__env__ = "production";
      const ztoolkit = createZToolkit();

      expect(ztoolkit.basicOptions.log.disableConsole).toBe(true);
    });

    it("should enable console logging in development environment", () => {
      (globalThis as any).__env__ = "development";
      const ztoolkit = createZToolkit();

      expect(ztoolkit.basicOptions.log.disableConsole).toBe(false);
    });

    it("should enable element JSON log in development environment", () => {
      (globalThis as any).__env__ = "development";
      const ztoolkit = createZToolkit();

      expect(ztoolkit.UI.basicOptions.ui.enableElementJSONLog).toBe(true);
    });

    it("should disable element JSON log in production environment", () => {
      (globalThis as any).__env__ = "production";
      const ztoolkit = createZToolkit();

      expect(ztoolkit.UI.basicOptions.ui.enableElementJSONLog).toBe(false);
    });

    it("should enable element DOM log in development environment", () => {
      (globalThis as any).__env__ = "development";
      const ztoolkit = createZToolkit();

      expect(ztoolkit.UI.basicOptions.ui.enableElementDOMLog).toBe(true);
    });

    it("should disable element DOM log in production environment", () => {
      (globalThis as any).__env__ = "production";
      const ztoolkit = createZToolkit();

      expect(ztoolkit.UI.basicOptions.ui.enableElementDOMLog).toBe(false);
    });

    it("should disable debug bridge password in development environment", () => {
      (globalThis as any).__env__ = "development";
      const ztoolkit = createZToolkit();

      expect(ztoolkit.basicOptions.debug.disableDebugBridgePassword).toBe(true);
    });

    it("should not disable debug bridge password in production environment", () => {
      (globalThis as any).__env__ = "production";
      const ztoolkit = createZToolkit();

      expect(ztoolkit.basicOptions.debug.disableDebugBridgePassword).toBe(false);
    });

    it("should set the plugin ID from config", () => {
      (globalThis as any).__env__ = "development";
      const ztoolkit = createZToolkit();

      expect(ztoolkit.basicOptions.api.pluginID).toBe("test-addon-id");
    });

    it("should set default icon URI for ProgressWindow", () => {
      (globalThis as any).__env__ = "development";
      const ztoolkit = createZToolkit();

      expect(mockSetIconURI).toHaveBeenCalledWith(
        "default",
        "chrome://test-addon/content/icons/favicon.png"
      );
    });

    it("should set success icon URI for ProgressWindow", () => {
      (globalThis as any).__env__ = "development";
      const ztoolkit = createZToolkit();

      expect(mockSetIconURI).toHaveBeenCalledWith(
        "success",
        "chrome://zotero/skin/tick@2x.png"
      );
    });

    it("should set fail icon URI for ProgressWindow", () => {
      (globalThis as any).__env__ = "development";
      const ztoolkit = createZToolkit();

      expect(mockSetIconURI).toHaveBeenCalledWith(
        "fail",
        "chrome://zotero/skin/cross.png"
      );
    });
  });
});
