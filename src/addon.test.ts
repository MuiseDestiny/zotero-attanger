import Addon from "./addon";
import { config } from "../package.json";

// Mock Zotero global object
const mockZotero = {
  isWin: false,
  initializationPromise: Promise.resolve(),
  unlockPromise: Promise.resolve(),
  uiReadyPromise: Promise.resolve(),
  PreferencePanes: {
    register: jest.fn(),
  },
  Notifier: {
    unregisterObserver: jest.fn(),
  },
};

// Mock zotero-plugin-toolkit
jest.mock("zotero-plugin-toolkit/dist/helpers/virtualizedTable", () => ({}), {
  virtual: true,
});
jest.mock("zotero-plugin-toolkit/dist/helpers/dialog", () => ({}), {
  virtual: true,
});

// Mock hooks
jest.mock("./hooks", () => ({
  default: {
    onStartup: jest.fn(),
    onShutdown: jest.fn(),
    onMainWindowLoad: jest.fn(),
    onMainWindowUnload: jest.fn(),
    onPrefsEvent: jest.fn(),
  },
}));

// Mock ztoolkit
jest.mock("./utils/ztoolkit", () => ({
  createZToolkit: jest.fn(() => ({
    basicOptions: {
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
    },
    UI: {
      basicOptions: {
        ui: {
          enableElementJSONLog: false,
          enableElementDOMLog: false,
        },
      },
    },
    ProgressWindow: {
      setIconURI: jest.fn(),
    },
    unregisterAll: jest.fn(),
  })),
}));

// Set up global Zotero
(global as any).Zotero = mockZotero;
(global as any).__env__ = "development";

describe("Addon", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create an instance with default data", () => {
      const addon = new Addon();

      expect(addon).toBeDefined();
      expect(addon.data).toBeDefined();
    });

    it("should set alive to true", () => {
      const addon = new Addon();

      expect(addon.data.alive).toBe(true);
    });

    it("should set env to the current environment", () => {
      const addon = new Addon();

      expect(addon.data.env).toBe("development");
    });

    it("should create ztoolkit instance", () => {
      const addon = new Addon();

      expect(addon.data.ztoolkit).toBeDefined();
      expect(addon.data.ztoolkit.unregisterAll).toBeDefined();
    });

    it("should initialize icons object with default icons", () => {
      const addon = new Addon();

      expect(addon.data.icons).toBeDefined();
      expect(addon.data.icons.favicon).toBe(
        `chrome://${config.addonRef}/content/icons/favicon.png`
      );
      expect(addon.data.icons.attachNewFile).toBe(
        `chrome://${config.addonRef}/content/icons/attachNewFile.png`
      );
      expect(addon.data.icons.matchAttachment).toBe(
        `chrome://${config.addonRef}/content/icons/matchAttachment.png`
      );
      expect(addon.data.icons.renameMoveAttachment).toBe(
        `chrome://${config.addonRef}/content/icons/renameMoveAttachment.png`
      );
      expect(addon.data.icons.openUsing).toBe(
        `chrome://${config.addonRef}/content/icons/openUsing.png`
      );
      expect(addon.data.icons.renameAttachment).toBe(
        `chrome://${config.addonRef}/content/icons/renameAttachment.png`
      );
      expect(addon.data.icons.moveFile).toBe(
        `chrome://${config.addonRef}/content/icons/moveAttachment.png`
      );
      expect(addon.data.icons.undoMoveFile).toBe(
        `chrome://${config.addonRef}/content/icons/undoMoveAttachment.png`
      );
      expect(addon.data.icons.collection).toBe(
        "chrome://zotero/skin/treesource-collection@2x.png"
      );
    });

    it("should set folderSep based on Zotero.isWin", () => {
      // Test non-Windows (default mock)
      const addonLinux = new Addon();
      expect(addonLinux.data.folderSep).toBe("/");

      // Test Windows
      (global as any).Zotero.isWin = true;
      const addonWindows = new Addon();
      expect(addonWindows.data.folderSep).toBe("\\");

      // Reset
      (global as any).Zotero.isWin = false;
    });

    it("should initialize notifierID as empty string", () => {
      const addon = new Addon();

      expect(addon.data.notifierID).toBe("");
    });

    it("should initialize locale as undefined", () => {
      const addon = new Addon();

      expect(addon.data.locale).toBeUndefined();
    });

    it("should initialize prefs as undefined", () => {
      const addon = new Addon();

      expect(addon.data.prefs).toBeUndefined();
    });

    it("should initialize dialog as undefined", () => {
      const addon = new Addon();

      expect(addon.data.dialog).toBeUndefined();
    });

    it("should assign hooks from imported hooks module", () => {
      const addon = new Addon();

      expect(addon.hooks).toBeDefined();
      expect(addon.hooks.onStartup).toBeDefined();
      expect(addon.hooks.onShutdown).toBeDefined();
      expect(addon.hooks.onMainWindowLoad).toBeDefined();
      expect(addon.hooks.onMainWindowUnload).toBeDefined();
      expect(addon.hooks.onPrefsEvent).toBeDefined();
    });

    it("should initialize api as empty object", () => {
      const addon = new Addon();

      expect(addon.api).toEqual({});
    });
  });

  describe("data object", () => {
    it("should have all required properties", () => {
      const addon = new Addon();

      expect(Object.keys(addon.data)).toEqual(
        expect.arrayContaining([
          "alive",
          "env",
          "ztoolkit",
          "icons",
          "folderSep",
          "notifierID",
        ])
      );
    });

    it("should allow modifying data properties", () => {
      const addon = new Addon();

      addon.data.alive = false;
      expect(addon.data.alive).toBe(false);

      addon.data.notifierID = "test-notifier";
      expect(addon.data.notifierID).toBe("test-notifier");
    });
  });

  describe("icons object", () => {
    it("should contain all expected icon keys", () => {
      const addon = new Addon();

      const expectedIconKeys = [
        "favicon",
        "attachNewFile",
        "matchAttachment",
        "renameMoveAttachment",
        "openUsing",
        "renameAttachment",
        "moveFile",
        "undoMoveFile",
        "collection",
      ];

      expectedIconKeys.forEach((key) => {
        expect(addon.data.icons).toHaveProperty(key);
      });
    });

    it("should have string values for all icons", () => {
      const addon = new Addon();

      Object.values(addon.data.icons).forEach((iconPath) => {
        expect(typeof iconPath).toBe("string");
        expect(iconPath).toBeTruthy();
      });
    });
  });

  describe("hooks object", () => {
    it("should have all lifecycle hook methods", () => {
      const addon = new Addon();

      expect(typeof addon.hooks.onStartup).toBe("function");
      expect(typeof addon.hooks.onShutdown).toBe("function");
      expect(typeof addon.hooks.onMainWindowLoad).toBe("function");
      expect(typeof addon.hooks.onMainWindowUnload).toBe("function");
      expect(typeof addon.hooks.onPrefsEvent).toBe("function");
    });
  });
});
