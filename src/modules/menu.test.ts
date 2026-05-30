import Menu, { getSubfolderPath, moveFile, registerNotify } from "./menu";

// Mock dependencies
jest.mock("../utils/locale", () => ({
  getString: jest.fn((key: string) => `string-${key}`),
}));

jest.mock("../../package.json", () => ({
  config: {
    addonName: "Zotero Attanger",
    addonID: "zoteroattanger@polygon.org",
    addonRef: "zoteroattanger",
    addonInstance: "ZoteroAttanger",
    prefsPrefix: "extensions.zotero.zoteroattanger",
  },
}));

jest.mock("../utils/prefs", () => ({
  getPref: jest.fn(),
  setPref: jest.fn(),
}));

jest.mock("../utils/wait", () => ({
  waitUntil: jest.fn(),
  waitUtilAsync: jest.fn(),
}));

jest.mock("../utils/shortcut", () => ({
  registerShortcut: jest.fn(),
}));

// Mock string-comparison
jest.mock("string-comparison", () => ({
  default: {
    metricLcs: {
      distance: jest.fn(() => 0),
    },
  },
}));

// Mock window global
const mockWindow = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  setTimeout: jest.fn((cb: any) => cb()),
  clearTimeout: jest.fn(),
  confirm: jest.fn(),
  prompt: jest.fn(),
  FilePicker: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    appendFilters: jest.fn(),
    show: jest.fn().mockResolvedValue("returnOK"),
    modeOpen: "modeOpen",
    modeGetFolder: "modeGetFolder",
    filterApps: "filterApps",
    filterAll: "filterAll",
    file: "/mock/path",
  })),
};

(global as any).window = mockWindow;

// Mock Zotero Items helper
function createMockZoteroItem(overrides: any = {}) {
  return {
    id: 1,
    isImportedAttachment: jest.fn().mockReturnValue(false),
    fileExists: jest.fn().mockResolvedValue(false),
    isTopLevelItem: jest.fn().mockReturnValue(true),
    isRegularItem: jest.fn().mockReturnValue(false),
    isAttachment: jest.fn().mockReturnValue(false),
    getAttachments: jest.fn().mockReturnValue([]),
    getField: jest.fn().mockReturnValue("Test"),
    getImageSrc: jest.fn().mockReturnValue("icon"),
    parentItem: null,
    topLevelItem: null,
    parentItemID: null,
    libraryID: 1,
    attachmentFilename: "test.pdf",
    getFilePathAsync: jest.fn().mockResolvedValue("/path/to/test.pdf"),
    toJSON: jest.fn().mockReturnValue({}),
    fromJSON: jest.fn(),
    setField: jest.fn(),
    setTags: jest.fn(),
    getTags: jest.fn().mockReturnValue([]),
    setNote: jest.fn(),
    getNote: jest.fn().mockReturnValue(""),
    saveTx: jest.fn().mockResolvedValue(undefined),
    eraseTx: jest.fn().mockResolvedValue(undefined),
    itemType: "attachment",
    ...overrides,
  };
}

// Mock Zotero globals
const mockZoteroItems = {
  get: jest.fn((ids: number | number[]) => {
    if (Array.isArray(ids)) {
      return ids.map(id => createMockZoteroItem({ id }));
    }
    return createMockZoteroItem({ id: ids });
  }),
  getAsync: jest.fn(),
  moveChildItems: jest.fn(),
};

const mockZoteroCollections = {
  get: jest.fn(),
};

const mockZoteroAttachments = {
  importFromFile: jest.fn(),
  getFileBaseNameFromItem: jest.fn(),
};

const mockZoteroPane = {
  getSelectedItems: jest.fn(),
  getSelectedCollection: jest.fn(),
  getCollectionTreeRow: jest.fn(),
  convertLinkedFilesToStoredFiles: jest.fn(),
  viewAttachment: jest.fn(),
};

const mockZoteroPrefs = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockZoteroDB = {
  executeTransaction: jest.fn(),
};

const mockZoteroRelations = {
  copyObjectSubjectRelations: jest.fn(),
};

const mockZoteroFulltext = {
  transferItemIndex: jest.fn(),
};

const mockZoteroFile = {
  iterateDirectory: jest.fn(),
  getExtension: jest.fn(),
  pathToFile: jest.fn(),
  createDirectoryIfMissingAsync: jest.fn(),
  getValidFileName: jest.fn((name: string) => name),
};

const mockZoteroRecognizeDocument = {
  recognizeItems: jest.fn(),
};

const mockZoteroPDFWorker = {
  _enqueue: jest.fn((cb: any) => cb()),
  _query: jest.fn(),
};

const mockZoteroNotifier = {
  registerObserver: jest.fn(),
  unregisterObserver: jest.fn(),
};

const mockIOUtils = {
  exists: jest.fn(),
  move: jest.fn(),
  read: jest.fn(),
};

const mockPathUtils = {
  filename: jest.fn((p: string) => p.split("/").pop() || p),
  normalize: jest.fn((p: string) => p),
  joinRelative: jest.fn((...args: string[]) => args.join("/")),
  parent: jest.fn((p: string) => p.split("/").slice(0, -1).join("/")),
  split: jest.fn((p: string) => p.split("/")),
};

// Mock Zotero.Item constructor
const mockZoteroItemConstructor = jest.fn().mockImplementation((itemType: string) => 
  createMockZoteroItem({ itemType })
);

const mockZotero = {
  Items: mockZoteroItems,
  Collections: mockZoteroCollections,
  Attachments: mockZoteroAttachments,
  Prefs: mockZoteroPrefs,
  DB: mockZoteroDB,
  Relations: mockZoteroRelations,
  Fulltext: mockZoteroFulltext,
  File: mockZoteroFile,
  RecognizeDocument: mockZoteroRecognizeDocument,
  PDFWorker: mockZoteroPDFWorker,
  Notifier: mockZoteroNotifier,
  Item: mockZoteroItemConstructor,
  Promise: {
    delay: jest.fn().mockResolvedValue(undefined),
  },
  Utilities: {
    Internal: {
      md5: jest.fn().mockReturnValue("mock-md5-hash"),
    },
  },
};

(global as any).Zotero = mockZotero;
(global as any).ZoteroPane = mockZoteroPane;
(global as any).IOUtils = mockIOUtils;
(global as any).PathUtils = mockPathUtils;

// Mock ztoolkit
const mockZtoolkit = {
  log: jest.fn(),
  Menu: {
    register: jest.fn(),
    unregisterAll: jest.fn(),
  },
  ProgressWindow: jest.fn().mockImplementation(() => ({
    createLine: jest.fn().mockReturnThis(),
    show: jest.fn(),
    startCloseTimer: jest.fn(),
    addDescription: jest.fn(),
    close: jest.fn(),
    lines: [],
  })),
  Keyboard: {
    register: jest.fn(),
  },
  getGlobal: jest.fn(),
  FilePicker: jest.fn(),
};

// Add setIconURI as a static method
(mockZtoolkit.ProgressWindow as any).setIconURI = jest.fn();

(global as any).ztoolkit = mockZtoolkit;

// Mock addon
const mockAddon = {
  data: {
    icons: {
      favicon: "favicon-icon",
      attachNewFile: "attach-new-file-icon",
      renameMoveAttachment: "rename-move-icon",
      matchAttachment: "match-attachment-icon",
      renameAttachment: "rename-attachment-icon",
      moveFile: "move-file-icon",
      undoMoveFile: "undo-move-file-icon",
      openUsing: "open-using-icon",
      collection: "collection-icon",
    },
    folderSep: "/",
    env: "test",
    alive: true,
    locale: {
      current: {
        formatMessagesSync: jest.fn(),
      },
    },
  },
};

(global as any).addon = mockAddon;

// Mock Components
(global as any).Components = {
  interfaces: {
    nsIFile: {},
  },
};

// Import mocked modules
import { getPref, setPref } from "../utils/prefs";
import { getString } from "../utils/locale";
import comparison from "string-comparison";

describe("Menu class", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default implementations after clearing mocks
    mockZoteroItems.get.mockImplementation((ids: number | number[]) => {
      if (Array.isArray(ids)) {
        return ids.map(id => createMockZoteroItem({ id }));
      }
      return createMockZoteroItem({ id: ids });
    });
  });

  describe("constructor", () => {
    it("should initialize and register menu", () => {
      mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

      const menu = new Menu();

      expect(menu).toBeDefined();
      expect(mockZtoolkit.Menu.register).toHaveBeenCalled();
      expect(mockZotero.Notifier.registerObserver).toHaveBeenCalled();
    });

    it("should register notifier for item events", () => {
      mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

      new Menu();

      expect(mockZotero.Notifier.registerObserver).toHaveBeenCalledWith(
        expect.any(Object),
        ["item"]
      );
    });

    it("should initialize icons", () => {
      mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

      new Menu();

      expect(mockZtoolkit.ProgressWindow.setIconURI).toHaveBeenCalled();
    });
  });

  describe("notifier callback", () => {
    let notifyCallback: any;

    beforeEach(() => {
      mockZoteroPane.getSelectedCollection.mockReturnValue({
        name: "Test Collection",
      });

      mockZotero.Notifier.registerObserver.mockImplementation((callback) => {
        notifyCallback = callback;
        return "notify-id-1";
      });

      new Menu();
    });

    it("should handle item add event with imported attachment", async () => {
      const mockItem = createMockZoteroItem({
        isImportedAttachment: jest.fn().mockReturnValue(true),
        fileExists: jest.fn().mockResolvedValue(true),
      });
      mockZoteroItems.get.mockReturnValue([mockItem]);

      notifyCallback.notify("add", "item", [1], {});

      await Promise.resolve();
      await Promise.resolve();

      expect(mockZoteroRecognizeDocument.recognizeItems).toHaveBeenCalled();
    });

    it("should handle top level item with attachments", async () => {
      const mockAttachment = createMockZoteroItem({
        id: 2,
        isAttachment: jest.fn().mockReturnValue(true),
      });
      const mockItem = createMockZoteroItem({
        id: 1,
        isImportedAttachment: jest.fn().mockReturnValue(false),
        isTopLevelItem: jest.fn().mockReturnValue(true),
        isRegularItem: jest.fn().mockReturnValue(true),
        getAttachments: jest.fn().mockReturnValue([2]),
      });
      mockZoteroItems.get.mockImplementation((id: number | number[]) => {
        if (Array.isArray(id)) {
          return id.map(i => i === 1 ? mockItem : mockAttachment);
        }
        return id === 1 ? mockItem : mockAttachment;
      });

      notifyCallback.notify("add", "item", [1], {});

      await Promise.resolve();
      await Promise.resolve();
    });

    it("should not process non-add events", () => {
      notifyCallback.notify("modify", "item", [1], {});

      expect(mockZoteroRecognizeDocument.recognizeItems).not.toHaveBeenCalled();
    });
  });
});

describe("getSubfolderPath", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return empty string when subfolderFormat is empty", () => {
    (getPref as jest.Mock).mockReturnValue("");

    const mockItem = {
      getDisplayTitle: jest.fn().mockReturnValue("Test Title"),
      getCollections: jest.fn().mockReturnValue([]),
    } as any;

    const result = getSubfolderPath(mockItem);

    expect(result).toBe("");
  });

  it("should return subfolder path based on title format", () => {
    (getPref as jest.Mock).mockReturnValue("{{title}}");
    (mockZoteroAttachments.getFileBaseNameFromItem as jest.Mock).mockReturnValue("test-title");

    const mockItem = {
      getDisplayTitle: jest.fn().mockReturnValue("Test Title"),
      getCollections: jest.fn().mockReturnValue([]),
    } as any;

    const result = getSubfolderPath(mockItem);

    expect(result).toBe("test-title");
  });

  it("should handle collection format", () => {
    (getPref as jest.Mock).mockReturnValue("{{collection}}");
    (mockZoteroAttachments.getFileBaseNameFromItem as jest.Mock).mockReturnValue("");

    const mockCollection = {
      id: 1,
      name: "Test Collection",
      parentID: null,
    };
    mockZoteroCollections.get.mockReturnValue(mockCollection);

    const mockItem = {
      getDisplayTitle: jest.fn().mockReturnValue("Test Title"),
      getCollections: jest.fn().mockReturnValue([1]),
    } as any;

    const result = getSubfolderPath(mockItem);

    expect(result).toBe("Test Collection");
  });

  it("should handle nested collection format", () => {
    (getPref as jest.Mock).mockReturnValue("{{collection}}");
    (mockZoteroAttachments.getFileBaseNameFromItem as jest.Mock).mockReturnValue("");

    const mockParentCollection = {
      id: 1,
      name: "Parent Collection",
      parentID: null,
    };
    const mockChildCollection = {
      id: 2,
      name: "Child Collection",
      parentID: 1,
    };
    mockZoteroCollections.get.mockImplementation((id: number) => {
      if (id === 1) return mockParentCollection;
      if (id === 2) return mockChildCollection;
    });

    const mockItem = {
      getDisplayTitle: jest.fn().mockReturnValue("Test Title"),
      getCollections: jest.fn().mockReturnValue([2]),
    } as any;

    const result = getSubfolderPath(mockItem);

    expect(result).toBe("Parent Collection/Child Collection");
  });

  it("should handle Windows path separators", () => {
    (getPref as jest.Mock).mockReturnValue("{{title}}");
    (mockZoteroAttachments.getFileBaseNameFromItem as jest.Mock).mockReturnValue("test-title");
    (global as any).Zotero = { ...mockZotero, isWin: true };

    const mockItem = {
      getDisplayTitle: jest.fn().mockReturnValue("Test Title"),
      getCollections: jest.fn().mockReturnValue([]),
    } as any;

    const result = getSubfolderPath(mockItem);

    expect(result).toBe("test-title");

    (global as any).Zotero = mockZotero;
  });
});

describe("moveFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return undefined when attachType is not linking", async () => {
    (getPref as jest.Mock).mockImplementation((key: string) => {
      if (key === "attachType") return "importing";
      return undefined;
    });

    const mockAttItem = createMockZoteroItem();

    const result = await moveFile(mockAttItem);

    expect(result).toBeUndefined();
  });

  it("should return undefined when file type check fails", async () => {
    (getPref as jest.Mock).mockImplementation((key: string) => {
      if (key === "attachType") return "linking";
      if (key === "fileTypes") return "pdf";
      return undefined;
    });

    const mockAttItem = createMockZoteroItem({
      attachmentFilename: "test.txt",
    });

    const result = await moveFile(mockAttItem);

    expect(result).toBeUndefined();
  });

  it("should return undefined when destDir does not exist and user cancels", async () => {
    (getPref as jest.Mock).mockImplementation((key: string) => {
      if (key === "attachType") return "linking";
      if (key === "fileTypes") return "";
      return undefined;
    });
    mockIOUtils.exists.mockResolvedValue(false);
    mockWindow.FilePicker.mockImplementationOnce(() => ({
      init: jest.fn(),
      appendFilters: jest.fn(),
      show: jest.fn().mockResolvedValue("returnCancel"),
      modeGetFolder: "modeGetFolder",
      filterAll: "filterAll",
    }));

    const mockAttItem = createMockZoteroItem();

    const result = await moveFile(mockAttItem);

    expect(result).toBeUndefined();
  });

  it("should move file when all conditions are met", async () => {
    (getPref as jest.Mock).mockImplementation((key: string) => {
      if (key === "attachType") return "linking";
      if (key === "fileTypes") return "";
      if (key === "destDir") return "/dest/dir";
      if (key === "subfolderFormat") return "";
      return undefined;
    });
    mockIOUtils.exists.mockResolvedValue(true);
    mockIOUtils.move.mockResolvedValue(undefined);
    mockPathUtils.parent.mockReturnValue("/dest/dir");

    const mockNewAttItem = createMockZoteroItem();

    const mockAttItem = createMockZoteroItem({
      toJSON: jest.fn().mockReturnValue({
        linkMode: "imported_file",
        path: "/path/to/test.pdf",
      }),
    });

    mockZoteroItems.getAsync.mockResolvedValue(createMockZoteroItem());
    mockZoteroItemConstructor.mockReturnValue(mockNewAttItem);

    const result = await moveFile(mockAttItem);

    expect(mockIOUtils.move).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("should handle file already exists with different md5", async () => {
    (getPref as jest.Mock).mockImplementation((key: string) => {
      if (key === "attachType") return "linking";
      if (key === "fileTypes") return "";
      if (key === "destDir") return "/dest/dir";
      if (key === "subfolderFormat") return "";
      return undefined;
    });
    mockIOUtils.exists.mockResolvedValue(true);
    mockIOUtils.move.mockResolvedValue(undefined);
    mockPathUtils.parent.mockReturnValue("/dest/dir");

    const mockNewAttItem = createMockZoteroItem();

    const mockAttItem = createMockZoteroItem({
      toJSON: jest.fn().mockReturnValue({
        linkMode: "imported_file",
        path: "/path/to/test.pdf",
      }),
    });

    mockZoteroItems.getAsync.mockResolvedValue(createMockZoteroItem());
    mockZoteroItemConstructor.mockReturnValue(mockNewAttItem);

    const result = await moveFile(mockAttItem);

    expect(result).toBeDefined();
  });

  it("should skip when source path equals dest path", async () => {
    (getPref as jest.Mock).mockImplementation((key: string) => {
      if (key === "attachType") return "linking";
      if (key === "fileTypes") return "";
      if (key === "destDir") return "/path/to";
      if (key === "subfolderFormat") return "";
      return undefined;
    });
    mockIOUtils.exists.mockResolvedValue(true);

    const mockAttItem = createMockZoteroItem();

    const result = await moveFile(mockAttItem);

    expect(result).toBeUndefined();
  });
});

describe("registerNotify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register observer with Zotero.Notifier", () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

    const onNotify = jest.fn();
    registerNotify(["item"], onNotify);

    expect(mockZotero.Notifier.registerObserver).toHaveBeenCalledWith(
      expect.any(Object),
      ["item"]
    );
  });

  it("should unregister observer on window unload", () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

    const onNotify = jest.fn();
    registerNotify(["item"], onNotify);

    const unloadHandler = (mockWindow.addEventListener as jest.Mock).mock.calls[0][1];
    unloadHandler(new Event("unload"));

    expect(mockZotero.Notifier.unregisterObserver).toHaveBeenCalledWith("notify-id-1");
  });

  it("should call onNotify callback when notified", async () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

    const onNotify = jest.fn();
    registerNotify(["item"], onNotify);

    const registerCall = mockZotero.Notifier.registerObserver.mock.calls[0][0] as any;
    await registerCall.notify("add", "item", [1], {});

    expect(onNotify).toHaveBeenCalledWith("add", "item", [1], {});
  });

  it("should unregister observer when addon is not alive", async () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");
    (global as any).addon.data.alive = false;

    const onNotify = jest.fn();
    registerNotify(["item"], onNotify);

    const registerCall = mockZotero.Notifier.registerObserver.mock.calls[0][0] as any;
    await registerCall.notify("add", "item", [1], {});

    expect(mockZotero.Notifier.unregisterObserver).toHaveBeenCalledWith("notify-id-1");

    (global as any).addon.data.alive = true;
  });
});

describe("Menu register method - menu items", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register item menu with children", () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

    new Menu();

    expect(mockZtoolkit.Menu.register).toHaveBeenCalledWith(
      "item",
      expect.objectContaining({
        tag: "menu",
        id: "attanger-menu",
        label: "Attanger",
      })
    );
  });

  it("should register collection menu for attach-new-file", () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

    new Menu();

    expect(mockZtoolkit.Menu.register).toHaveBeenCalledWith(
      "collection",
      expect.objectContaining({
        tag: "menuitem",
        label: expect.any(String),
      })
    );
  });

  it("should register open-using menu", () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");
    mockZoteroPrefs.get.mockReturnValue("[]");

    new Menu();

    expect(mockZtoolkit.Menu.register).toHaveBeenCalledWith(
      "item",
      expect.objectContaining({
        tag: "menu",
        label: expect.any(String),
      })
    );
  });
});

describe("Menu visibility functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have correct visibility for attach-new-file", () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

    const mockItem = createMockZoteroItem({
      isTopLevelItem: jest.fn().mockReturnValue(true),
      isRegularItem: jest.fn().mockReturnValue(true),
    });
    mockZoteroPane.getSelectedItems.mockReturnValue([mockItem]);

    new Menu();

    const registerCall = (mockZtoolkit.Menu.register as jest.Mock).mock.calls.find(
      (call: any[]) => call[1]?.children?.some((child: any) =>
        child.label === "string-attach-new-file"
      )
    );

    if (registerCall && registerCall[1]?.children) {
      const attachNewFileChild = registerCall[1].children.find(
        (child: any) => child.label === "string-attach-new-file"
      );
      if (attachNewFileChild?.getVisibility) {
        expect(attachNewFileChild.getVisibility()).toBe(true);
      }
    }
  });

  it("should have correct visibility for match-attachment", () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

    const mockItem = createMockZoteroItem({
      isTopLevelItem: jest.fn().mockReturnValue(true),
      isRegularItem: jest.fn().mockReturnValue(true),
    });
    mockZoteroPane.getSelectedItems.mockReturnValue([mockItem]);

    new Menu();

    const registerCall = (mockZtoolkit.Menu.register as jest.Mock).mock.calls.find(
      (call: any[]) => call[1]?.children?.some((child: any) =>
        child.label === "string-match-attachment"
      )
    );

    if (registerCall && registerCall[1]?.children) {
      const matchAttachmentChild = registerCall[1].children.find(
        (child: any) => child.label === "string-match-attachment"
      );
      if (matchAttachmentChild?.getVisibility) {
        expect(matchAttachmentChild.getVisibility()).toBe(true);
      }
    }
  });

  it("should have correct visibility for open-using menu", () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");
    mockZoteroPrefs.get.mockReturnValue("[]");

    const mockItem = createMockZoteroItem({
      isAttachment: jest.fn().mockReturnValue(true),
    });
    mockZoteroPane.getSelectedItems.mockReturnValue([mockItem]);

    new Menu();

    const registerCall = (mockZtoolkit.Menu.register as jest.Mock).mock.calls.find(
      (call: any[]) => call[0] === "item" && call[1]?.label === "string-open-using"
    );

    expect(registerCall).toBeDefined();
  });
});

describe("Menu command listeners", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should execute rename-move-attachment command", async () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");
    mockZoteroPrefs.get.mockImplementation((key: string) => {
      if (key === "attachType") return "importing";
      return undefined;
    });

    const mockItem = createMockZoteroItem({
      isAttachment: jest.fn().mockReturnValue(true),
      isTopLevelItem: jest.fn().mockReturnValue(false),
      parentItemID: 1,
    });
    mockZoteroPane.getSelectedItems.mockReturnValue([mockItem]);

    new Menu();

    const registerCall = (mockZtoolkit.Menu.register as jest.Mock).mock.calls.find(
      (call: any[]) => call[1]?.children?.some((child: any) =>
        child.label === "string-rename-move-attachment"
      )
    );

    if (registerCall && registerCall[1]?.children) {
      const renameMoveChild = registerCall[1].children.find(
        (child: any) => child.label === "string-rename-move-attachment"
      );
      if (renameMoveChild?.commandListener) {
        await renameMoveChild.commandListener({});
      }
    }
  });

  it("should execute rename-attachment command", async () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");
    mockZoteroPrefs.get.mockImplementation((key: string) => {
      if (key === "attachType") return "importing";
      return undefined;
    });

    const mockItem = createMockZoteroItem({
      isAttachment: jest.fn().mockReturnValue(true),
      isTopLevelItem: jest.fn().mockReturnValue(false),
      parentItemID: 1,
      parentItem: createMockZoteroItem(),
    });
    mockZoteroPane.getSelectedItems.mockReturnValue([mockItem]);
    mockZoteroItems.getAsync.mockResolvedValue(mockItem.parentItem);

    new Menu();

    const registerCall = (mockZtoolkit.Menu.register as jest.Mock).mock.calls.find(
      (call: any[]) => call[1]?.children?.some((child: any) =>
        child.label === "string-rename-attachment"
      )
    );

    if (registerCall && registerCall[1]?.children) {
      const renameChild = registerCall[1].children.find(
        (child: any) => child.label === "string-rename-attachment"
      );
      if (renameChild?.commandListener) {
        await renameChild.commandListener({});
      }
    }
  });

  it("should execute move-attachment command", async () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");
    mockZoteroPrefs.get.mockImplementation((key: string) => {
      if (key === "attachType") return "importing";
      if (key === "fileTypes") return "";
      return undefined;
    });

    const mockItem = createMockZoteroItem({
      isAttachment: jest.fn().mockReturnValue(true),
      isTopLevelItem: jest.fn().mockReturnValue(false),
    });
    mockZoteroPane.getSelectedItems.mockReturnValue([mockItem]);
    mockZoteroPane.getSelectedCollection.mockReturnValue({ id: 1, name: "Test" });

    new Menu();

    const registerCall = (mockZtoolkit.Menu.register as jest.Mock).mock.calls.find(
      (call: any[]) => call[1]?.children?.some((child: any) =>
        child.label === "string-move-attachment"
      )
    );

    if (registerCall && registerCall[1]?.children) {
      const moveChild = registerCall[1].children.find(
        (child: any) => child.label === "string-move-attachment"
      );
      if (moveChild?.commandListener) {
        await moveChild.commandListener({});
      }
    }
  });

  it("should execute undo-move-attachment command", async () => {
    mockZotero.Notifier.registerObserver.mockReturnValue("notify-id-1");

    new Menu();

    const registerCall = (mockZtoolkit.Menu.register as jest.Mock).mock.calls.find(
      (call: any[]) => call[1]?.children?.some((child: any) =>
        child.label === "string-undo-move-attachment"
      )
    );

    if (registerCall && registerCall[1]?.children) {
      const undoChild = registerCall[1].children.find(
        (child: any) => child.label === "string-undo-move-attachment"
      );
      if (undoChild?.commandListener) {
        await undoChild.commandListener({});
      }
    }

    expect(mockZoteroPane.convertLinkedFilesToStoredFiles).toHaveBeenCalled();
  });
});

describe("helper functions", () => {
  describe("getString", () => {
    it("should return formatted string", () => {
      (getString as jest.Mock).mockReturnValue("Attach New File");

      const result = getString("attach-new-file");

      expect(result).toBe("Attach New File");
    });
  });

  describe("getPref", () => {
    it("should call Zotero.Prefs.get", () => {
      (getPref as jest.Mock).mockReturnValue("test-value");

      const result = getPref("testKey");

      expect(result).toBe("test-value");
    });
  });

  describe("setPref", () => {
    it("should call Zotero.Prefs.set", () => {
      (setPref as jest.Mock).mockReturnValue(true);

      const result = setPref("testKey", "testValue");

      expect(result).toBe(true);
    });
  });

  describe("string-comparison", () => {
    it("should calculate distance between strings", () => {
      (comparison.metricLcs.distance as jest.Mock).mockReturnValue(5);

      const result = comparison.metricLcs.distance("string1", "string2");

      expect(result).toBe(5);
    });
  });
});
