import { getString } from "./locale";

describe("locale", () => {
  describe("getString", () => {
    beforeEach(() => {
      // Mock addon.data.locale
      (global as any).addon = {
        data: {
          locale: {
            current: {
              formatMessagesSync: jest.fn(),
            },
          },
        },
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should return formatted string with single argument", () => {
      const mockPattern = {
        value: "Hello World",
        attributes: {},
      };
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        mockPattern,
      ]);

      const result = getString("test-key");

      expect(result).toBe("Hello World");
      expect(
        (global as any).addon.data.locale.current.formatMessagesSync,
      ).toHaveBeenCalledWith([{ id: "zoteroattanger-test-key", args: undefined }]);
    });

    it("should return the key with prefix when pattern is null", () => {
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        null,
      ]);

      const result = getString("missing-key");

      expect(result).toBe("zoteroattanger-missing-key");
    });

    it("should return the key with prefix when pattern is undefined", () => {
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        undefined,
      ]);

      const result = getString("missing-key");

      expect(result).toBe("zoteroattanger-missing-key");
    });

    it("should return branch value when branch option is provided", () => {
      const mockPattern = {
        value: "Default value",
        attributes: {
          "branch-example": "Branch value",
        },
      };
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        mockPattern,
      ]);

      const result = getString("test-key", { branch: "branch-example" });

      expect(result).toBe("Branch value");
    });

    it("should return key with prefix when branch is not found", () => {
      const mockPattern = {
        value: "Default value",
        attributes: {
          "other-branch": "Other value",
        },
      };
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        mockPattern,
      ]);

      const result = getString("test-key", { branch: "missing-branch" });

      expect(result).toBe("zoteroattanger-test-key");
    });

    it("should return value when pattern has no attributes and branch is requested", () => {
      const mockPattern = {
        value: "Default value",
        attributes: undefined,
      };
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        mockPattern,
      ]);

      // When attributes is undefined, the code falls through to return pattern.value
      const result = getString("test-key", { branch: "some-branch" });

      expect(result).toBe("Default value");
    });

    it("should return value when branch is not provided but pattern has attributes", () => {
      const mockPattern = {
        value: "Default value",
        attributes: {
          "some-branch": "Branch value",
        },
      };
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        mockPattern,
      ]);

      const result = getString("test-key");

      expect(result).toBe("Default value");
    });

    it("should pass args to formatMessagesSync", () => {
      const mockPattern = {
        value: "I have 2 apples",
        attributes: {},
      };
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        mockPattern,
      ]);

      const result = getString("test-key", { args: { count: 2 } });

      expect(result).toBe("I have 2 apples");
      expect(
        (global as any).addon.data.locale.current.formatMessagesSync,
      ).toHaveBeenCalledWith([{ id: "zoteroattanger-test-key", args: { count: 2 } }]);
    });

    it("should handle string branch argument (two-argument overload)", () => {
      const mockPattern = {
        value: "Default value",
        attributes: {
          "branch-example": "Branch value",
        },
      };
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        mockPattern,
      ]);

      const result = getString("test-key", "branch-example");

      expect(result).toBe("Branch value");
    });

    it("should handle options with both branch and args", () => {
      const mockPattern = {
        value: "Default",
        attributes: {
          "branch-example": "Branch with args: 5",
        },
      };
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        mockPattern,
      ]);

      const result = getString("test-key", { branch: "branch-example", args: { count: 5 } });

      expect(result).toBe("Branch with args: 5");
      expect(
        (global as any).addon.data.locale.current.formatMessagesSync,
      ).toHaveBeenCalledWith([{ id: "zoteroattanger-test-key", args: { count: 5 } }]);
    });

    it("should throw error for invalid arguments (more than 2)", () => {
      expect(() => (getString as any)("key", {}, "extra")).toThrow("Invalid arguments");
    });

    it("should return key with prefix when value is empty string and no branch", () => {
      const mockPattern = {
        value: "",
        attributes: {},
      };
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        mockPattern,
      ]);

      const result = getString("test-key");

      expect(result).toBe("zoteroattanger-test-key");
    });

    it("should return key with prefix when value is null and no branch", () => {
      const mockPattern = {
        value: null,
        attributes: {},
      };
      ((global as any).addon.data.locale.current.formatMessagesSync as jest.Mock).mockReturnValue([
        mockPattern,
      ]);

      const result = getString("test-key");

      expect(result).toBe("zoteroattanger-test-key");
    });
  });
});
