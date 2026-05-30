import { getPref, setPref, clearPref } from "./prefs";

// Mock Zotero.Prefs
const mockZoteroPrefs = {
  get: jest.fn(),
  set: jest.fn(),
  clear: jest.fn(),
};

(global as any).Zotero = {
  Prefs: mockZoteroPrefs,
};

// Mock config from package.json
jest.mock("../../package.json", () => ({
  config: {
    prefsPrefix: "test-pref-prefix",
  },
}));

describe("prefs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPref", () => {
    it("should call Zotero.Prefs.get with the correct key", () => {
      getPref("testKey");
      expect(mockZoteroPrefs.get).toHaveBeenCalledWith("test-pref-prefix.testKey", true);
    });

    it("should return the value from Zotero.Prefs.get", () => {
      const mockValue = "testValue";
      mockZoteroPrefs.get.mockReturnValue(mockValue);
      const result = getPref("testKey");
      expect(result).toBe(mockValue);
    });

    it("should handle different key types", () => {
      getPref("some.nested.key");
      expect(mockZoteroPrefs.get).toHaveBeenCalledWith("test-pref-prefix.some.nested.key", true);
    });
  });

  describe("setPref", () => {
    it("should call Zotero.Prefs.set with string value", () => {
      setPref("testKey", "stringValue");
      expect(mockZoteroPrefs.set).toHaveBeenCalledWith("test-pref-prefix.testKey", "stringValue", true);
    });

    it("should call Zotero.Prefs.set with number value", () => {
      setPref("testKey", 42);
      expect(mockZoteroPrefs.set).toHaveBeenCalledWith("test-pref-prefix.testKey", 42, true);
    });

    it("should call Zotero.Prefs.set with boolean value", () => {
      setPref("testKey", true);
      expect(mockZoteroPrefs.set).toHaveBeenCalledWith("test-pref-prefix.testKey", true, true);
    });

    it("should return the value from Zotero.Prefs.set", () => {
      const mockReturnValue = true;
      mockZoteroPrefs.set.mockReturnValue(mockReturnValue);
      const result = setPref("testKey", "value");
      expect(result).toBe(mockReturnValue);
    });
  });

  describe("clearPref", () => {
    it("should call Zotero.Prefs.clear with the correct key", () => {
      clearPref("testKey");
      expect(mockZoteroPrefs.clear).toHaveBeenCalledWith("test-pref-prefix.testKey", true);
    });

    it("should return the value from Zotero.Prefs.clear", () => {
      const mockReturnValue = true;
      mockZoteroPrefs.clear.mockReturnValue(mockReturnValue);
      const result = clearPref("testKey");
      expect(result).toBe(mockReturnValue);
    });
  });
});
