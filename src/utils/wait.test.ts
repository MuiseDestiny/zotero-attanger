import { waitUntil, waitUtilAsync } from "./wait";

describe("wait", () => {
  let mockIntervalId: number;
  let registeredCallbacks: Array<{ callback: () => void; interval: number }>;
  let mockSetInterval: jest.Mock;
  let mockClearInterval: jest.Mock;
  let currentTime: number;

  beforeEach(() => {
    mockIntervalId = 0;
    registeredCallbacks = [];
    currentTime = 0;
    mockSetInterval = jest.fn((cb: () => void, interval: number) => {
      mockIntervalId++;
      registeredCallbacks.push({ callback: cb, interval });
      return mockIntervalId;
    });
    mockClearInterval = jest.fn((id: number) => {
      registeredCallbacks = registeredCallbacks.filter(
        (item) => item.interval !== id
      );
    });

    (global as unknown as { ztoolkit: { getGlobal: jest.Mock } }).ztoolkit = {
      getGlobal: jest.fn((name: string) => {
        if (name === "setInterval") return mockSetInterval;
        if (name === "clearInterval") return mockClearInterval;
      }),
    };

    // Mock Date.now to control time
    jest.spyOn(global.Date, "now").mockImplementation(() => currentTime);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    registeredCallbacks = [];
  });

  const triggerInterval = (times: number, advanceTime: number = 100) => {
    for (let i = 0; i < times; i++) {
      currentTime += advanceTime;
      registeredCallbacks.forEach(({ callback }) => callback());
    }
  };

  describe("waitUntil", () => {
    it("should call callback when condition is immediately true", () => {
      const condition = jest.fn().mockReturnValue(true);
      const callback = jest.fn();

      waitUntil(condition, callback, 100, 1000);

      triggerInterval(1);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(condition).toHaveBeenCalledTimes(1);
      expect(mockClearInterval).toHaveBeenCalledTimes(1);
    });

    it("should call callback when condition becomes true after retries", () => {
      const condition = jest.fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      const callback = jest.fn();

      waitUntil(condition, callback, 100, 1000);

      triggerInterval(3);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(condition).toHaveBeenCalledTimes(3);
      expect(mockClearInterval).toHaveBeenCalledTimes(1);
    });

    it("should not call callback when condition never becomes true before timeout", () => {
      const condition = jest.fn().mockReturnValue(false);
      const callback = jest.fn();

      waitUntil(condition, callback, 100, 500);

      // Trigger 6 times (600ms > 500ms timeout)
      triggerInterval(6);

      expect(callback).not.toHaveBeenCalled();
      expect(mockClearInterval).toHaveBeenCalledTimes(1);
    });

    it("should use default interval of 100ms", () => {
      const condition = jest.fn().mockReturnValue(true);
      const callback = jest.fn();

      waitUntil(condition, callback);

      triggerInterval(1);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 100);
    });

    it("should use default timeout of 10000ms", () => {
      const condition = jest.fn().mockReturnValue(false);
      const callback = jest.fn();

      waitUntil(condition, callback, 100);

      // Trigger 101 times (10100ms > 10000ms timeout)
      triggerInterval(101);

      expect(callback).not.toHaveBeenCalled();
      expect(mockClearInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe("waitUtilAsync", () => {
    it("should resolve when condition is immediately true", async () => {
      const condition = jest.fn().mockReturnValue(true);

      const promise = waitUtilAsync(condition, 100, 1000);

      triggerInterval(1);

      await expect(promise).resolves.toBeUndefined();
      expect(condition).toHaveBeenCalledTimes(1);
      expect(mockClearInterval).toHaveBeenCalledTimes(1);
    });

    it("should resolve when condition becomes true after retries", async () => {
      const condition = jest.fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValue(true);

      const promise = waitUtilAsync(condition, 100, 1000);

      triggerInterval(3);

      await expect(promise).resolves.toBeUndefined();
      expect(condition).toHaveBeenCalledTimes(3);
      expect(mockClearInterval).toHaveBeenCalledTimes(1);
    });

    it("should reject when condition never becomes true before timeout", async () => {
      const condition = jest.fn().mockReturnValue(false);

      const promise = waitUtilAsync(condition, 100, 500);

      // Trigger 6 times (600ms > 500ms timeout)
      triggerInterval(6);

      await expect(promise).rejects.toBeUndefined();
      expect(mockClearInterval).toHaveBeenCalledTimes(1);
    });

    it("should use default interval of 100ms", async () => {
      const condition = jest.fn().mockReturnValue(true);

      const promise = waitUtilAsync(condition);

      triggerInterval(1);

      await expect(promise).resolves.toBeUndefined();
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 100);
    });

    it("should use default timeout of 10000ms", async () => {
      const condition = jest.fn().mockReturnValue(false);

      const promise = waitUtilAsync(condition, 100);

      // Trigger 101 times (10100ms > 10000ms timeout)
      triggerInterval(101);

      await expect(promise).rejects.toBeUndefined();
      expect(mockClearInterval).toHaveBeenCalledTimes(1);
    });
  });
});
