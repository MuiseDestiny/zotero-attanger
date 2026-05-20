import { isWindowAlive } from './window';

describe('isWindowAlive', () => {
  it('should return undefined when window is undefined', () => {
    expect(isWindowAlive(undefined)).toBe(undefined);
  });

  it('should return null when window is null', () => {
    expect(isWindowAlive(null as unknown as Window)).toBe(null);
  });

  it('should return true when window is alive and not closed', () => {
    const mockWindow = {
      closed: false,
    } as unknown as Window;

    // Mock Components.utils.isDeadWrapper to return false
    const originalComponents = (global as any).Components;
    (global as any).Components = {
      utils: {
        isDeadWrapper: jest.fn().mockReturnValue(false),
      },
    };

    expect(isWindowAlive(mockWindow)).toBe(true);

    (global as any).Components = originalComponents;
  });

  it('should return false when window is closed', () => {
    const mockWindow = {
      closed: true,
    } as unknown as Window;

    const originalComponents = (global as any).Components;
    (global as any).Components = {
      utils: {
        isDeadWrapper: jest.fn().mockReturnValue(false),
      },
    };

    expect(isWindowAlive(mockWindow)).toBe(false);

    (global as any).Components = originalComponents;
  });

  it('should return false when window is a dead wrapper', () => {
    const mockWindow = {
      closed: false,
    } as unknown as Window;

    const originalComponents = (global as any).Components;
    (global as any).Components = {
      utils: {
        isDeadWrapper: jest.fn().mockReturnValue(true),
      },
    };

    expect(isWindowAlive(mockWindow)).toBe(false);

    (global as any).Components = originalComponents;
  });
});
