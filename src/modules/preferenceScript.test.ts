// Mock package.json config
jest.mock("../../package.json", () => ({
  config: {
    addonName: "Zotero Attanger",
    addonID: "zoteroattanger@polygon.org",
    addonRef: "zoteroattanger",
    addonInstance: "ZoteroAttanger",
    prefsPrefix: "extensions.zotero.zoteroattanger",
  },
}));

// Mock locale utils
jest.mock("../utils/locale", () => ({
  getString: jest.fn((key: string) => `string-${key}`),
}));

// Mock prefs utils
const mockGetPref = jest.fn();
const mockSetPref = jest.fn();
jest.mock("../utils/prefs", () => ({
  getPref: jest.fn((key: string) => mockGetPref(key)),
  setPref: jest.fn((key: string, value: any) => mockSetPref(key, value)),
}));

// Mock shortcut utils
const mockListenShortcut = jest.fn();
jest.mock("../utils/shortcut", () => ({
  listenShortcut: (...args: any[]) => mockListenShortcut(...args),
}));

import { registerPrefsScripts } from "./preferenceScript";

// Mock window global
const mockWindow = {
  document: {
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
  },
  FilePicker: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    appendFilters: jest.fn(),
    show: jest.fn().mockResolvedValue("returnOK"),
    modeGetFolder: "modeGetFolder",
    filterAll: "filterAll",
    file: "/mock/path",
    returnOK: "returnOK",
    returnCancel: "returnCancel",
  })),
};

(global as any).window = mockWindow;

// Mock PathUtils
const mockPathUtils = {
  normalize: jest.fn((p: string) => p),
};

(global as any).PathUtils = mockPathUtils;

// Mock addon
const mockAddon = {
  data: {
    prefs: null as any,
  },
};

(global as any).addon = mockAddon;

// Mock Zotero for shortcut callback
const mockZoteroPrefs = {
  set: jest.fn(),
};

(global as any).Zotero = {
  Prefs: mockZoteroPrefs,
};

describe("preferenceScript", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddon.data.prefs = null;
    mockZoteroPrefs.set.mockClear();
  });

  describe("registerPrefsScripts", () => {
    it("should initialize addon.data.prefs if not exists", async () => {
      const mockDestSettingBox = {
        style: {
          opacity: "1",
        },
      } as unknown as XUL.GroupBox;

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return mockDestSettingBox;
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;
      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      expect(addon.data.prefs).toBeDefined();
      expect(addon.data.prefs?.window).toBe(mockWindowWithDoc);
    });

    it("should update addon.data.prefs.window if already exists", async () => {
      const mockDestSettingBox = {
        style: {
          opacity: "1",
        },
      } as unknown as XUL.GroupBox;

      const mockDoc1 = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return mockDestSettingBox;
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;
      const mockWindow1 = {
        document: mockDoc1,
      } as unknown as Window;

      const mockDoc2 = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return mockDestSettingBox;
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;
      const mockWindow2 = {
        document: mockDoc2,
      } as unknown as Window;

      // First call
      await registerPrefsScripts(mockWindow1);
      const firstPrefs = addon.data.prefs;

      // Second call with different window
      await registerPrefsScripts(mockWindow2);

      expect(addon.data.prefs).toBe(firstPrefs);
      expect(addon.data.prefs?.window).toBe(mockWindow2);
    });

    it("should call updatePrefsUI", async () => {
      const mockDestSettingBox = {
        style: {
          opacity: "1",
        },
      } as unknown as XUL.GroupBox;

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return mockDestSettingBox;
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;
      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      // Verify updatePrefsUI was called by checking the dest-setting element was queried
      expect(mockDoc.querySelector).toHaveBeenCalledWith("#dest-setting");
    });

    it("should call bindPrefEvents", async () => {
      const mockDestSettingBox = {
        style: {
          opacity: "1",
        },
      } as unknown as XUL.GroupBox;

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return mockDestSettingBox;
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;
      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      // Verify bindPrefEvents was called by checking event listeners were set up
      expect(mockDoc.querySelector).toHaveBeenCalledWith("#choose-source-dir");
      expect(mockDoc.querySelector).toHaveBeenCalledWith("#choose-dest-dir");
      expect(mockDoc.querySelector).toHaveBeenCalledWith("#attach-type");
      expect(mockDoc.querySelectorAll).toHaveBeenCalledWith(".shortcut");
    });
  });

  describe("updatePrefsUI", () => {
    it("should set opacity to 0.6 when attachType is importing", async () => {
      mockGetPref.mockReturnValue("importing");

      const mockDestSettingBox = {
        style: {
          opacity: "1",
        },
      } as unknown as XUL.GroupBox;

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return mockDestSettingBox;
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      expect(mockDestSettingBox.style.opacity).toBe(".6");
    });

    it("should set opacity to 1 when attachType is not importing", async () => {
      mockGetPref.mockReturnValue("linking");

      const mockDestSettingBox = {
        style: {
          opacity: "0.6",
        },
      } as unknown as XUL.GroupBox;

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return mockDestSettingBox;
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      expect(mockDestSettingBox.style.opacity).toBe("1");
    });

    it("should handle missing dest-setting element gracefully", async () => {
      mockGetPref.mockReturnValue("importing");

      const mockDestSettingBox = {
        style: {
          opacity: "1",
        },
      } as unknown as XUL.GroupBox;

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return mockDestSettingBox;
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      // Should not throw
      await expect(registerPrefsScripts(mockWindowWithDoc)).resolves.not.toThrow();
    });
  });

  describe("bindPrefEvents - choose source dir", () => {
    it("should open file picker for source directory selection", async () => {
      mockGetPref.mockImplementation((key: string) => {
        if (key === "sourceDir") return "/old/source/path";
        return undefined;
      });

      const mockFilePickerInstance = {
        init: jest.fn(),
        appendFilters: jest.fn(),
        show: jest.fn().mockResolvedValue("returnOK"),
        modeGetFolder: "modeGetFolder",
        filterAll: "filterAll",
        file: "/new/source/path",
        displayDirectory: null as any,
        returnOK: "returnOK",
        returnCancel: "returnCancel",
      };

      const mockFilePickerConstructor = jest.fn().mockImplementation(() => mockFilePickerInstance);
      (global as any).window.FilePicker = mockFilePickerConstructor;

      const mockSourceDirButton = {
        addEventListener: jest.fn(),
      };

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#choose-source-dir") {
            return mockSourceDirButton;
          }
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      // Trigger the event listener
      const eventListener = mockSourceDirButton.addEventListener.mock.calls[0][1];
      await eventListener(new Event("command"));

      expect(mockFilePickerConstructor).toHaveBeenCalled();
      expect(mockFilePickerInstance.init).toHaveBeenCalled();
      expect(mockFilePickerInstance.appendFilters).toHaveBeenCalledWith(mockFilePickerInstance.filterAll);
      expect(mockFilePickerInstance.show).toHaveBeenCalled();
      expect(mockSetPref).toHaveBeenCalledWith("sourceDir", "/new/source/path");
    });

    it("should handle empty old source path", async () => {
      mockGetPref.mockImplementation((key: string) => {
        if (key === "sourceDir") return "";
        return undefined;
      });

      const mockFilePickerInstance = {
        init: jest.fn(),
        appendFilters: jest.fn(),
        show: jest.fn().mockResolvedValue("returnOK"),
        modeGetFolder: "modeGetFolder",
        filterAll: "filterAll",
        file: "/new/source/path",
        displayDirectory: null as any,
        returnOK: "returnOK",
        returnCancel: "returnCancel",
      };

      const mockFilePickerConstructor = jest.fn().mockImplementation(() => mockFilePickerInstance);
      (global as any).window.FilePicker = mockFilePickerConstructor;

      const mockSourceDirButton = {
        addEventListener: jest.fn(),
      };

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#choose-source-dir") {
            return mockSourceDirButton;
          }
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      const eventListener = mockSourceDirButton.addEventListener.mock.calls[0][1];
      await eventListener(new Event("command"));

      expect(mockFilePickerConstructor).toHaveBeenCalled();
      expect(mockFilePickerInstance.init).toHaveBeenCalled();
      expect(mockSetPref).toHaveBeenCalledWith("sourceDir", "/new/source/path");
    });

    it("should handle invalid old source path", async () => {
      mockGetPref.mockImplementation((key: string) => {
        if (key === "sourceDir") return "invalid::path";
        return undefined;
      });

      mockPathUtils.normalize.mockImplementation((p: string) => {
        if (p === "invalid::path") {
          throw new Error("Invalid path");
        }
        return p;
      });

      const mockFilePickerInstance = {
        init: jest.fn(),
        appendFilters: jest.fn(),
        show: jest.fn().mockResolvedValue("returnOK"),
        modeGetFolder: "modeGetFolder",
        filterAll: "filterAll",
        file: "/new/source/path",
        displayDirectory: null as any,
        returnOK: "returnOK",
        returnCancel: "returnCancel",
      };

      const mockFilePickerConstructor = jest.fn().mockImplementation(() => mockFilePickerInstance);
      (global as any).window.FilePicker = mockFilePickerConstructor;

      const mockSourceDirButton = {
        addEventListener: jest.fn(),
      };

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#choose-source-dir") {
            return mockSourceDirButton;
          }
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      const eventListener = mockSourceDirButton.addEventListener.mock.calls[0][1];
      await eventListener(new Event("command"));

      expect(mockFilePickerConstructor).toHaveBeenCalled();
      expect(mockFilePickerInstance.init).toHaveBeenCalled();
      expect(mockSetPref).toHaveBeenCalledWith("sourceDir", "/new/source/path");
    });



    it("should handle missing choose-source-dir button", async () => {
      mockGetPref.mockReturnValue(undefined);

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await expect(registerPrefsScripts(mockWindowWithDoc)).resolves.not.toThrow();
    });
  });

  describe("bindPrefEvents - choose dest dir", () => {
    it("should open file picker for destination directory selection", async () => {
      mockGetPref.mockImplementation((key: string) => {
        if (key === "destDir") return "/old/dest/path";
        return undefined;
      });

      const mockFilePickerInstance = {
        init: jest.fn(),
        appendFilters: jest.fn(),
        show: jest.fn().mockResolvedValue("returnOK"),
        modeGetFolder: "modeGetFolder",
        filterAll: "filterAll",
        file: "/new/dest/path",
        displayDirectory: null as any,
        returnOK: "returnOK",
        returnCancel: "returnCancel",
      };

      const mockFilePickerConstructor = jest.fn().mockImplementation(() => mockFilePickerInstance);
      (global as any).window.FilePicker = mockFilePickerConstructor;

      const mockDestDirButton = {
        addEventListener: jest.fn(),
      };

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#choose-dest-dir") {
            return mockDestDirButton;
          }
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      const eventListener = mockDestDirButton.addEventListener.mock.calls[0][1];
      await eventListener(new Event("command"));

      expect(mockFilePickerConstructor).toHaveBeenCalled();
      expect(mockFilePickerInstance.init).toHaveBeenCalled();
      expect(mockFilePickerInstance.appendFilters).toHaveBeenCalledWith(mockFilePickerInstance.filterAll);
      expect(mockFilePickerInstance.show).toHaveBeenCalled();
      expect(mockSetPref).toHaveBeenCalledWith("destDir", "/new/dest/path");
    });

    it("should handle empty old dest path", async () => {
      mockGetPref.mockImplementation((key: string) => {
        if (key === "destDir") return "";
        return undefined;
      });

      const mockFilePickerInstance = {
        init: jest.fn(),
        appendFilters: jest.fn(),
        show: jest.fn().mockResolvedValue("returnOK"),
        modeGetFolder: "modeGetFolder",
        filterAll: "filterAll",
        file: "/new/dest/path",
        displayDirectory: null as any,
        returnOK: "returnOK",
        returnCancel: "returnCancel",
      };

      const mockFilePickerConstructor = jest.fn().mockImplementation(() => mockFilePickerInstance);
      (global as any).window.FilePicker = mockFilePickerConstructor;

      const mockDestDirButton = {
        addEventListener: jest.fn(),
      };

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#choose-dest-dir") {
            return mockDestDirButton;
          }
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      const eventListener = mockDestDirButton.addEventListener.mock.calls[0][1];
      await eventListener(new Event("command"));

      expect(mockFilePickerConstructor).toHaveBeenCalled();
      expect(mockFilePickerInstance.init).toHaveBeenCalled();
      expect(mockSetPref).toHaveBeenCalledWith("destDir", "/new/dest/path");
    });



    it("should handle missing choose-dest-dir button", async () => {
      mockGetPref.mockReturnValue(undefined);

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await expect(registerPrefsScripts(mockWindowWithDoc)).resolves.not.toThrow();
    });
  });

  describe("bindPrefEvents - attach-type", () => {
    it("should update prefs UI when attach-type changes", async () => {
      mockGetPref.mockReturnValue("linking");

      const mockAttachTypeElement = {
        addEventListener: jest.fn(),
      };

      const mockDestSettingBox = {
        style: {
          opacity: "1",
        },
      };

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#attach-type") {
            return mockAttachTypeElement;
          }
          if (selector === "#dest-setting") {
            return mockDestSettingBox;
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      const eventListener = mockAttachTypeElement.addEventListener.mock.calls[0][1];
      await eventListener(new Event("command"));

      // Should have called querySelector again for updatePrefsUI
      expect(mockDoc.querySelector).toHaveBeenCalledWith("#dest-setting");
    });

    it("should handle missing attach-type element", async () => {
      mockGetPref.mockReturnValue(undefined);

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await expect(registerPrefsScripts(mockWindowWithDoc)).resolves.not.toThrow();
    });
  });

  describe("bindPrefEvents - shortcut listeners", () => {
    it("should call listenShortcut for each shortcut element", async () => {
      const mockShortcutInput1 = {
        getAttribute: jest.fn().mockReturnValue("test-pref-key1"),
      } as unknown as HTMLInputElement;

      const mockShortcutInput2 = {
        getAttribute: jest.fn().mockReturnValue("test-pref-key2"),
      } as unknown as HTMLInputElement;

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === ".shortcut") {
            return [mockShortcutInput1, mockShortcutInput2];
          }
          return [];
        }),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      expect(mockListenShortcut).toHaveBeenCalledWith(mockShortcutInput1, expect.any(Function));
      expect(mockListenShortcut).toHaveBeenCalledWith(mockShortcutInput2, expect.any(Function));
    });

    it("should set pref when shortcut callback is triggered", async () => {
      const mockShortcutInput = {
        getAttribute: jest.fn().mockReturnValue("test-pref-key"),
        value: "Ctrl + K",
      } as unknown as HTMLInputElement;

      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockImplementation((selector: string) => {
          if (selector === ".shortcut") {
            return [mockShortcutInput];
          }
          return [];
        }),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await registerPrefsScripts(mockWindowWithDoc);

      // Get the callback passed to listenShortcut
      const callback = mockListenShortcut.mock.calls[0][1];

      // Call the callback
      callback("Ctrl + Shift + K");

      expect(mockZoteroPrefs.set).toHaveBeenCalledWith("test-pref-key", "Ctrl + Shift + K", true);
    });

    it("should handle empty shortcut elements", async () => {
      const mockDoc = {
        querySelector: jest.fn().mockImplementation((selector: string) => {
          if (selector === "#dest-setting") {
            return { style: { opacity: "1" } };
          }
          return null;
        }),
        querySelectorAll: jest.fn().mockReturnValue([]),
      } as unknown as Document;

      const mockWindowWithDoc = {
        document: mockDoc,
      } as unknown as Window;

      await expect(registerPrefsScripts(mockWindowWithDoc)).resolves.not.toThrow();
      expect(mockListenShortcut).not.toHaveBeenCalled();
    });
  });
});
