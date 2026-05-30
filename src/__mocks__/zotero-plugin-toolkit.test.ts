import { BasicTool } from "./zotero-plugin-toolkit";

describe("zotero-plugin-toolkit mock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (globalThis as any).__mockGetGlobal;
  });

  afterEach(() => {
    delete (globalThis as any).__mockGetGlobal;
  });

  describe("BasicTool", () => {
    it("should create a BasicTool instance with getGlobal method", () => {
      const tool = new BasicTool();
      expect(tool).toBeDefined();
      expect(tool.getGlobal).toBeDefined();
      expect(typeof tool.getGlobal).toBe("function");
    });

    it("should return undefined from getGlobal when no mock is set", () => {
      const tool = new BasicTool();
      const result = tool.getGlobal("someArg");
      expect(result).toBeUndefined();
    });

    it("should call the global __mockGetGlobal when set", () => {
      const mockValue = { foo: "bar" };
      const mockGetGlobal = jest.fn().mockReturnValue(mockValue);
      (globalThis as any).__mockGetGlobal = mockGetGlobal;

      const tool = new BasicTool();
      const result = tool.getGlobal("testArg");

      expect(mockGetGlobal).toHaveBeenCalledWith("testArg");
      expect(result).toBe(mockValue);
    });

    it("should pass multiple arguments to __mockGetGlobal", () => {
      const mockGetGlobal = jest.fn().mockReturnValue("result");
      (globalThis as any).__mockGetGlobal = mockGetGlobal;

      const tool = new BasicTool();
      tool.getGlobal("arg1", "arg2", "arg3");

      expect(mockGetGlobal).toHaveBeenCalledWith("arg1", "arg2", "arg3");
    });

    it("should return undefined when __mockGetGlobal is deleted after creation", () => {
      const mockGetGlobal = jest.fn().mockReturnValue("value");
      (globalThis as any).__mockGetGlobal = mockGetGlobal;

      const tool = new BasicTool();
      delete (globalThis as any).__mockGetGlobal;

      const result = tool.getGlobal("test");
      expect(result).toBeUndefined();
    });

    it("should be a mock function (jest.fn)", () => {
      expect(BasicTool).toBeDefined();
      expect(jest.isMockFunction(BasicTool)).toBe(true);
    });
  });
});
