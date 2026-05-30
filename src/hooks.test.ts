import hooks from "./hooks";

// Mock config from package.json
jest.mock("../package.json", () => ({
  config: {
    addonID: "zoteroattanger@polygon.org",
    addonRef: "zoteroattanger",
    addonInstance: "ZoteroAttanger",
  },
}));

// Mock locale utilities
jest.mock("./utils/locale", () => ({
  initLocale: jest.fn(),
  getString: jest.fn(),
}));

// Mock preferenceScript module
jest.mock("./modules/preferenceScript", () => ({
  registerPrefsScripts: jest.fn(),
}));

// Mock ztoolkit utility
jest.mock("./utils/ztoolkit", () => ({
  createZToolkit: jest.fn(),
}));

// Mock Menu class - must be a proper constructor mock with __esModule
jest.mock("./modules/menu", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  })),
}));

// Mock Zotero global
const mockZotero = {
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

(global as any).Zotero = mockZotero;

// Mock addon global
const mockAddon = {
  data: {
    ztoolkit: {} as any,
    dialog: undefined as any,
    notifierID: "test-notifier-id",
    alive: true,
  },
};

(global as any).addon = mockAddon;

// Mock ztoolkit global
const mockZToolkit = {
  unregisterAll: jest.fn(),
};

(global as any).ztoolkit = mockZToolkit;

// Mock rootURI
(global as any).rootURI = "chrome://zoteroattanger/content/";

// Mock window global for Node.js environment
(global as any).window = {};

describe("hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset addon data
    mockAddon.data.alive = true;
    mockAddon.data.dialog = undefined;
    mockZToolkit.unregisterAll.mockClear();
    mockZotero.PreferencePanes.register.mockClear();
    mockZotero.Notifier.unregisterObserver.mockClear();
  });

  describe("onStartup", () => {
    it("should wait for all Zotero promises", async () => {
      await hooks.onStartup();
      expect(mockZotero.initializationPromise).toBeDefined();
      expect(mockZotero.unlockPromise).toBeDefined();
      expect(mockZotero.uiReadyPromise).toBeDefined();
    });

    it("should call initLocale", async () => {
      const { initLocale } = require("./utils/locale");
      await hooks.onStartup();
      expect(initLocale).toHaveBeenCalled();
    });

    it("should register preference pane with correct config", async () => {
      await hooks.onStartup();
      expect(mockZotero.PreferencePanes.register).toHaveBeenCalledWith({
        pluginID: "zoteroattanger@polygon.org",
        src: "chrome://zoteroattanger/content/chrome/content/preferences.xhtml",
        label: "Attanger",
        image: "chrome://zoteroattanger/content/icons/favicon.png",
      });
    });

    it("should call onMainWindowLoad with window", async () => {
      const mockWindow = {} as Window;
      // Mock window global for the internal call
      (global as any).window = mockWindow;
      const { createZToolkit } = require("./utils/ztoolkit");
      (createZToolkit as jest.Mock).mockReturnValue({ unregisterAll: jest.fn() });

      await hooks.onStartup();
      // onMainWindowLoad is called internally with window
      expect(mockAddon.data.ztoolkit).toBeDefined();
    });
  });

  describe("onMainWindowLoad", () => {
    it("should create ztoolkit instance", async () => {
      const mockWindow = {} as Window;
      const { createZToolkit } = require("./utils/ztoolkit");
      const mockToolkit = { someMethod: jest.fn() };
      (createZToolkit as jest.Mock).mockReturnValue(mockToolkit);

      await hooks.onMainWindowLoad(mockWindow);

      expect(createZToolkit).toHaveBeenCalled();
      expect(mockAddon.data.ztoolkit).toBe(mockToolkit);
    });

    it("should create new Menu instance", async () => {
      const mockWindow = {} as Window;
      const MenuMock = require("./modules/menu").default;

      await hooks.onMainWindowLoad(mockWindow);

      expect(MenuMock).toHaveBeenCalled();
    });
  });

  describe("onMainWindowUnload", () => {
    it("should call ztoolkit.unregisterAll", async () => {
      const mockWindow = {} as Window;
      await hooks.onMainWindowUnload(mockWindow);
      expect(mockZToolkit.unregisterAll).toHaveBeenCalled();
    });

    it("should close dialog window if it exists", async () => {
      const mockWindow = {} as Window;
      const mockDialog = {
        window: {
          close: jest.fn(),
        },
      };
      mockAddon.data.dialog = mockDialog;

      await hooks.onMainWindowUnload(mockWindow);

      expect(mockDialog.window.close).toHaveBeenCalled();
    });

    it("should not throw when dialog is undefined", async () => {
      const mockWindow = {} as Window;
      mockAddon.data.dialog = undefined;

      await expect(hooks.onMainWindowUnload(mockWindow)).resolves.not.toThrow();
    });
  });

  describe("onShutdown", () => {
    it("should call ztoolkit.unregisterAll", () => {
      hooks.onShutdown();
      expect(mockZToolkit.unregisterAll).toHaveBeenCalled();
    });

    it("should close dialog window if it exists", () => {
      const mockDialog = {
        window: {
          close: jest.fn(),
        },
      };
      mockAddon.data.dialog = mockDialog;

      hooks.onShutdown();

      expect(mockDialog.window.close).toHaveBeenCalled();
    });

    it("should unregister notifier observer", () => {
      mockAddon.data.notifierID = "test-notifier-id";
      hooks.onShutdown();
      expect(mockZotero.Notifier.unregisterObserver).toHaveBeenCalledWith("test-notifier-id");
    });

    it("should set addon.data.alive to false", () => {
      mockAddon.data.alive = true;
      hooks.onShutdown();
      expect(mockAddon.data.alive).toBe(false);
    });

    it("should delete Zotero[config.addonInstance]", () => {
      (global as any).Zotero.ZoteroAttanger = { someProp: "value" };
      hooks.onShutdown();
      expect((global as any).Zotero.ZoteroAttanger).toBeUndefined();
    });
  });

  describe("onPrefsEvent", () => {
    it("should call registerPrefsScripts on load event", async () => {
      const { registerPrefsScripts } = require("./modules/preferenceScript");
      const mockPrefsWindow = { document: {} } as any;

      await hooks.onPrefsEvent("load", { window: mockPrefsWindow });

      expect(registerPrefsScripts).toHaveBeenCalledWith(mockPrefsWindow);
    });

    it("should do nothing for unknown event types", async () => {
      const { registerPrefsScripts } = require("./modules/preferenceScript");

      await hooks.onPrefsEvent("unknown", { data: "test" });

      expect(registerPrefsScripts).not.toHaveBeenCalled();
    });

    it("should do nothing for save event", async () => {
      const { registerPrefsScripts } = require("./modules/preferenceScript");

      await hooks.onPrefsEvent("save", { window: {} });

      expect(registerPrefsScripts).not.toHaveBeenCalled();
    });
  });
});
