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
  });
});
