// Mock for zotero-plugin-toolkit
// Use a global variable to share the mock implementation between test and mock file
declare global {
  var __mockGetGlobal: jest.Mock<any, any> | undefined;
}

export const BasicTool = jest.fn().mockImplementation(() => ({
  getGlobal: (...args: any[]) => {
    if (globalThis.__mockGetGlobal) {
      return globalThis.__mockGetGlobal(...args);
    }
    return undefined;
  },
}));
