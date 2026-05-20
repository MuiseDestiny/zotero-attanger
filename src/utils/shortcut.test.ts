// Mock package.json config
jest.mock("../../package.json", () => ({
  config: {
    addonRef: "test-addon",
  },
}));

// Mock zotero-plugin-toolkit/dist/managers/keyboard
jest.mock("zotero-plugin-toolkit/dist/managers/keyboard", () => ({}), {
  virtual: true,
});

// Mock Zotero.Prefs
const mockZoteroPrefs = {
  get: jest.fn(),
};

// Mock ztoolkit.Keyboard
const mockKeyboardRegister = jest.fn();

// Mock ztoolkit
const mockZToolkit = {
  Keyboard: {
    register: mockKeyboardRegister,
  },
  log: jest.fn(),
};

(global as any).Zotero = {
  Prefs: mockZoteroPrefs,
};

(global as any).ztoolkit = mockZToolkit;

import { registerShortcut, listenShortcut } from "./shortcut";

describe("shortcut", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockZoteroPrefs.get.mockClear();
    mockKeyboardRegister.mockClear();
    mockZToolkit.log.mockClear();
  });

  describe("registerShortcut", () => {
    const mockCallback = jest.fn().mockResolvedValue(undefined);

    it("should not register shortcut if enable pref is false", () => {
      mockZoteroPrefs.get.mockReturnValue(false);

      registerShortcut("testKey", mockCallback);

      expect(mockZoteroPrefs.get).toHaveBeenCalledWith("test-addon.testKey.enable");
      expect(mockKeyboardRegister).not.toHaveBeenCalled();
    });

    it("should not register shortcut if enable pref is undefined", () => {
      mockZoteroPrefs.get.mockReturnValue(undefined);

      registerShortcut("testKey", mockCallback);

      expect(mockZoteroPrefs.get).toHaveBeenCalledWith("test-addon.testKey.enable");
      expect(mockKeyboardRegister).not.toHaveBeenCalled();
    });

    it("should register shortcut if enable pref is true", () => {
      mockZoteroPrefs.get.mockReturnValueOnce(true).mockReturnValueOnce("Ctrl + K");

      registerShortcut("testKey", mockCallback);

      expect(mockZoteroPrefs.get).toHaveBeenCalledWith("test-addon.testKey.enable");
      expect(mockZoteroPrefs.get).toHaveBeenCalledWith("test-addon.testKey");
      expect(mockKeyboardRegister).toHaveBeenCalled();
    });

    it("should replace spaces around + with commas in shortcut string", () => {
      mockZoteroPrefs.get.mockReturnValueOnce(true).mockReturnValueOnce("Ctrl + Shift + K");

      registerShortcut("testKey", mockCallback);

      expect(mockKeyboardRegister).toHaveBeenCalled();
      const registerCallback = mockKeyboardRegister.mock.calls[0][0];

      // Simulate a keyboard event with matching shortcut
      const mockEvent = {} as KeyboardEvent;
      const mockOptions = {
        keyboard: {
          equals: jest.fn().mockReturnValue(true),
        },
      };

      registerCallback(mockEvent, mockOptions);

      expect(mockZToolkit.log).toHaveBeenCalledWith("control,shift,k");
    });

    it("should convert ctrl to control in shortcut string", () => {
      mockZoteroPrefs.get.mockReturnValueOnce(true).mockReturnValueOnce("ctrl + k");

      registerShortcut("testKey", mockCallback);

      expect(mockKeyboardRegister).toHaveBeenCalled();
    });

    it("should handle lowercase shortcut string", () => {
      mockZoteroPrefs.get.mockReturnValueOnce(true).mockReturnValueOnce("ctrl + shift + a");

      registerShortcut("testKey", mockCallback);

      expect(mockKeyboardRegister).toHaveBeenCalled();
    });

    it("should match shortcut with lowercase version", () => {
      mockZoteroPrefs.get.mockReturnValueOnce(true).mockReturnValueOnce("Ctrl + K");

      registerShortcut("testKey", mockCallback);

      const registerCallback = mockKeyboardRegister.mock.calls[0][0];
      const mockEvent = {} as KeyboardEvent;
      const mockOptions = {
        keyboard: {
          equals: jest.fn().mockImplementation((str: string) => str === "control,k"),
        },
      };

      registerCallback(mockEvent, mockOptions);

      expect(mockCallback).toHaveBeenCalled();
    });

    it("should match shortcut with capitalized last character version", () => {
      mockZoteroPrefs.get.mockReturnValueOnce(true).mockReturnValueOnce("Ctrl + K");

      registerShortcut("testKey", mockCallback);

      const registerCallback = mockKeyboardRegister.mock.calls[0][0];
      const mockEvent = {} as KeyboardEvent;
      const mockOptions = {
        keyboard: {
          equals: jest.fn().mockImplementation((str: string) => str === "control,K"),
        },
      };

      registerCallback(mockEvent, mockOptions);

      expect(mockCallback).toHaveBeenCalled();
    });

    it("should call callback when shortcut matches", async () => {
      mockZoteroPrefs.get.mockReturnValueOnce(true).mockReturnValueOnce("Ctrl + K");

      registerShortcut("testKey", mockCallback);

      const registerCallback = mockKeyboardRegister.mock.calls[0][0];
      const mockEvent = {} as KeyboardEvent;
      const mockOptions = {
        keyboard: {
          equals: jest.fn().mockReturnValue(true),
        },
      };

      await registerCallback(mockEvent, mockOptions);

      expect(mockCallback).toHaveBeenCalled();
    });

    it("should log the shortcut string when matched", async () => {
      mockZoteroPrefs.get.mockReturnValueOnce(true).mockReturnValueOnce("Ctrl + K");

      registerShortcut("testKey", mockCallback);

      const registerCallback = mockKeyboardRegister.mock.calls[0][0];
      const mockEvent = {} as KeyboardEvent;
      const mockOptions = {
        keyboard: {
          equals: jest.fn().mockReturnValue(true),
        },
      };

      await registerCallback(mockEvent, mockOptions);

      expect(mockZToolkit.log).toHaveBeenCalledWith("control,k");
    });

    it("should not call callback when shortcut does not match", () => {
      mockZoteroPrefs.get.mockReturnValueOnce(true).mockReturnValueOnce("Ctrl + K");

      registerShortcut("testKey", mockCallback);

      const registerCallback = mockKeyboardRegister.mock.calls[0][0];
      const mockEvent = {} as KeyboardEvent;
      const mockOptions = {
        keyboard: {
          equals: jest.fn().mockReturnValue(false),
        },
      };

      registerCallback(mockEvent, mockOptions);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it("should not call callback when keyboard option is not present", () => {
      mockZoteroPrefs.get.mockReturnValueOnce(true).mockReturnValueOnce("Ctrl + K");

      registerShortcut("testKey", mockCallback);

      const registerCallback = mockKeyboardRegister.mock.calls[0][0];
      const mockEvent = {} as KeyboardEvent;
      const mockOptions = {};

      registerCallback(mockEvent, mockOptions);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe("listenShortcut", () => {
    let mockInputNode: HTMLInputElement;
    let mockCallback: jest.Mock;

    beforeEach(() => {
      mockInputNode = {
        addEventListener: jest.fn(),
        value: "",
      } as unknown as HTMLInputElement;
      mockCallback = jest.fn();
    });

    it("should add keydown event listener to input node", () => {
      listenShortcut(mockInputNode, mockCallback);

      expect(mockInputNode.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    it("should capture Ctrl key in shortcut", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        key: "K",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("Ctrl + K");
      expect(mockCallback).toHaveBeenCalledWith("Ctrl + K");
    });

    it("should capture Meta key in shortcut", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
        altKey: false,
        key: "K",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("Meta + K");
      expect(mockCallback).toHaveBeenCalledWith("Meta + K");
    });

    it("should capture Shift key in shortcut", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
        altKey: false,
        key: "K",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("Shift + K");
      expect(mockCallback).toHaveBeenCalledWith("Shift + K");
    });

    it("should capture Alt key in shortcut", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: true,
        key: "K",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("Alt + K");
      expect(mockCallback).toHaveBeenCalledWith("Alt + K");
    });

    it("should capture multiple modifier keys", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: true,
        metaKey: true,
        shiftKey: true,
        altKey: true,
        key: "K",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("Ctrl + Meta + Shift + Alt + K");
      expect(mockCallback).toHaveBeenCalledWith("Ctrl + Meta + Shift + Alt + K");
    });

    it("should not include modifier-only keys in the shortcut display", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        key: "Shift",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("Ctrl");
      expect(mockCallback).toHaveBeenCalledWith("Ctrl");
    });

    it("should not include key when only modifier keys are pressed", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        key: "Control",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("Ctrl");
      expect(mockCallback).toHaveBeenCalledWith("Ctrl");
    });

    it("should handle Meta key press alone", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        key: "Meta",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("");
      expect(mockCallback).toHaveBeenCalledWith("");
    });

    it("should handle Alt key press alone", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        key: "Alt",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("");
      expect(mockCallback).toHaveBeenCalledWith("");
    });

    it("should convert key to uppercase", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        key: "k",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("K");
      expect(mockCallback).toHaveBeenCalledWith("K");
    });

    it("should prevent default event behavior", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        key: "K",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("should stop event propagation", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        key: "K",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it("should handle Ctrl + Shift + K combination", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
        key: "K",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("Ctrl + Shift + K");
      expect(mockCallback).toHaveBeenCalledWith("Ctrl + Shift + K");
    });

    it("should handle Ctrl + Alt + Shift + Meta + K combination", () => {
      listenShortcut(mockInputNode, mockCallback);

      const eventListener = (mockInputNode.addEventListener as jest.Mock).mock.calls[0][1];
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ctrlKey: true,
        metaKey: true,
        shiftKey: true,
        altKey: true,
        key: "K",
      } as unknown as KeyboardEvent;

      eventListener(mockEvent);

      expect(mockInputNode.value).toBe("Ctrl + Meta + Shift + Alt + K");
      expect(mockCallback).toHaveBeenCalledWith("Ctrl + Meta + Shift + Alt + K");
    });
  });
});
