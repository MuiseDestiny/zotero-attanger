const path = require("node:path");
const crypto = require("node:crypto");
const esbuild = require("esbuild");

const PREF_PREFIX = "extensions.zotero.zoteroattanger";

let bundledMenuCode;

function getBundledMenuCode() {
  if (!bundledMenuCode) {
    const result = esbuild.buildSync({
      entryPoints: [path.join(process.cwd(), "src/modules/menu.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      write: false,
      logLevel: "silent",
    });
    bundledMenuCode = result.outputFiles[0].text;
  }
  return bundledMenuCode;
}

class FakeClock {
  constructor() {
    this.now = 0;
    this.nextID = 0;
    this.tasks = new Map();
    this.cleared = [];
    this.intervals = new Map();
  }

  setTimeout(callback, delay = 0) {
    const id = this.nextID++;
    this.tasks.set(id, {
      callback,
      at: this.now + Math.max(0, Number(delay) || 0),
    });
    return id;
  }

  clearTimeout(id) {
    this.cleared.push(id);
    this.tasks.delete(id);
  }

  setInterval(callback, delay = 0) {
    const id = this.nextID++;
    this.intervals.set(id, { callback, delay });
    return id;
  }

  clearInterval(id) {
    this.intervals.delete(id);
  }

  async runIntervals() {
    for (const { callback } of [...this.intervals.values()]) {
      await callback();
      await this.settle();
    }
  }

  async settle() {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
    await new Promise((resolve) => setImmediate(resolve));
  }

  async runAll(limit = 100) {
    let runs = 0;
    while (this.tasks.size) {
      if (++runs > limit) throw new Error("Fake clock exceeded task limit");
      const [id, task] = [...this.tasks.entries()].sort(
        ([leftID, left], [rightID, right]) =>
          left.at - right.at || leftID - rightID,
      )[0];
      this.tasks.delete(id);
      this.now = task.at;
      await task.callback();
      await this.settle();
    }
    await this.settle();
  }
}

function createHarness(options = {}) {
  const clock = new FakeClock();
  const items = new Map();
  const observers = new Map();
  const menuRegistrations = [];
  const keyboardRegistrations = [];
  const logs = [];
  const delays = [];
  const activeIntervals = new Set();
  let nextIntervalID = 0;
  const fileContents = new Map(
    Object.entries(options.fileContents || {}).map(([filePath, value]) => [
      filePath,
      Buffer.from(value),
    ]),
  );
  const files = new Set([...(options.files || []), ...fileContents.keys()]);
  for (const filePath of files) {
    if (!fileContents.has(filePath)) {
      fileContents.set(filePath, Buffer.from(`content:${filePath}`));
    }
  }
  const directories = new Set([
    "/",
    "/storage",
    "/zotero",
    ...(options.directories || ["/source", "/dest"]),
  ]);
  const calls = {
    copy: [],
    copyOptions: [],
    copyFallback: [],
    move: [],
    moveOptions: [],
    stat: [],
    relink: [],
    convertLinkedToStored: [],
    moveChildItems: [],
    copyRelations: [],
    transferIndex: [],
    importFromFile: [],
    linkFromFile: [],
    recognize: [],
    remove: [],
    unregister: [],
    newItems: [],
  };
  let nextObserverID = 1;
  let nextItemID = 10000;

  const defaultPrefs = {
    attachType: "linking",
    autoMove: false,
    autoRecognizeImportedPDF: true,
    autoRemoveEmptyFolder: false,
    autoRenameOnModify: false,
    autoRenameOnModifyDebounceEnabled: true,
    autoRenameOnModifyDebounceMs: 1000,
    autoRenameOnModifyDelayEnabled: false,
    autoRenameOnModifyDelayMs: 0,
    destDir: "/dest",
    fileTypes: "pdf,doc,docx,txt,rtf,djvu,epub",
    filenameAsPrefixRules: "",
    filenameSkipAutoMoveRenameRules: "",
    filenameSkipRenameRules: "",
    removeDiacritics: false,
    moveWithoutDeleting: false,
    readPDFtitle: "nonCJK",
    sourceDir: "/source",
    subfolderFormat: "",
    syncAttachmentTitle: false,
  };
  const prefs = new Map();
  for (const [key, value] of Object.entries({
    ...defaultPrefs,
    ...(options.prefs || {}),
  })) {
    prefs.set(`${PREF_PREFIX}.${key}`, value);
  }
  prefs.set("autoRenameFiles", options.autoRenameFiles || false);

  const harness = {
    calls,
    clock,
    delays,
    directories,
    files,
    fileContents,
    items,
    keyboardRegistrations,
    logs,
    menuRegistrations,
    observers,
    prefs,
    selectedCollection: undefined,
    selectedItems: [],
  };

  function destinationExists(destination) {
    const error = new Error(`Destination already exists: ${destination}`);
    error.name = "NoModificationAllowedError";
    error.becauseExists = true;
    return error;
  }

  function copyContents(source, destination) {
    files.add(destination);
    fileContents.set(
      destination,
      Buffer.from(fileContents.get(source) || `content:${source}`),
    );
  }

  function removePath(filePath, recursive = false) {
    files.delete(filePath);
    fileContents.delete(filePath);
    directories.delete(filePath);
    if (recursive) {
      for (const existingPath of [...files, ...directories]) {
        if (existingPath.startsWith(`${filePath}/`)) {
          files.delete(existingPath);
          fileContents.delete(existingPath);
          directories.delete(existingPath);
        }
      }
    }
  }

  function canonicalFilePath(filePath) {
    for (const [symlink, target] of Object.entries(options.symlinks || {})) {
      if (filePath === symlink || filePath.startsWith(`${symlink}/`)) {
        return path.posix.normalize(target + filePath.slice(symlink.length));
      }
    }
    return filePath;
  }

  function fileObject(filePath) {
    let normalized = path.posix.normalize(filePath);
    return {
      get path() {
        return normalized;
      },
      set path(value) {
        normalized = value;
      },
      leafName: path.posix.basename(normalized),
      parent: fileObjectParent(normalized),
      target: options.symlinks?.[normalized] || normalized,
      exists: () => files.has(normalized) || directories.has(normalized),
      isDirectory: () => directories.has(normalized),
      isFile: () => files.has(normalized),
      isSymlink: () => Boolean(options.symlinks?.[normalized]),
      normalize: () => {
        normalized = canonicalFilePath(normalized);
      },
      equals: (other) =>
        canonicalFilePath(normalized) === canonicalFilePath(other.path),
      isHidden: () => path.posix.basename(normalized).startsWith("."),
      lastModifiedTime: options.modifiedTimes?.[normalized] || 1,
      fileSize: fileContents.get(normalized)?.length || 0,
      QueryInterface() {
        return this;
      },
      copyTo: (parent, leafName) => {
        const destination = path.posix.join(parent.path, leafName);
        calls.copyFallback.push([normalized, destination]);
        if (options.copyFallback) {
          return options.copyFallback(normalized, destination);
        }
        if (files.has(destination) || directories.has(destination)) {
          throw destinationExists(destination);
        }
        copyContents(normalized, destination);
      },
      moveTo: (parent, leafName) => {
        const destination = path.posix.join(parent.path, leafName);
        if (files.has(destination) || directories.has(destination)) {
          throw destinationExists(destination);
        }
        copyContents(normalized, destination);
        removePath(normalized);
      },
      remove: (recursive) => {
        calls.remove.push(normalized);
        removePath(normalized, recursive);
      },
      QueryInterface() {
        return this;
      },
      get directoryEntries() {
        const entries = [...files, ...directories]
          .filter((entry) => path.posix.dirname(entry) === normalized)
          .map(fileObject);
        let index = 0;
        return {
          hasMoreElements: () => index < entries.length,
          getNext: () => entries[index++],
        };
      },
    };
  }

  function fileObjectParent(filePath) {
    const parentPath = path.posix.dirname(filePath);
    return {
      path: parentPath,
      parent: parentPath === "/" ? undefined : fileObjectParent(parentPath),
      leafName: path.posix.basename(parentPath),
      target: options.symlinks?.[parentPath] || parentPath,
      isSymlink: () => Boolean(options.symlinks?.[parentPath]),
      normalize() {
        this.path = canonicalFilePath(this.path);
      },
      exists: () => directories.has(parentPath),
      isDirectory: () => directories.has(parentPath),
      isFile: () => files.has(parentPath),
    };
  }

  class MockCreatedItem {
    constructor(itemType) {
      this.id = nextItemID++;
      this.key = `AT${String(this.id).padStart(6, "0")}`;
      this.itemType = itemType;
      this.deleted = false;
      this.attachmentLinkMode = 2;
      this.attachmentContentType = "application/pdf";
      this.fields = {};
      this.tags = [];
      this.note = "";
      this.renameCalls = [];
      this.collectionIDs = [];
      calls.newItems.push(this);
    }

    get attachmentFilename() {
      return path.posix.basename(this.currentPath || "");
    }

    fromJSON(json) {
      this.json = { ...json };
      this.parentItemID = json.parentItemID || json.parentItem || undefined;
      this.parentItem = this.parentItemID
        ? items.get(this.parentItemID)
        : undefined;
      if (json.path) this.currentPath = json.path;
      this.attachmentLinkMode = json.linkMode === "imported_file" ? 0 : 2;
      this.fields.title = json.title || path.posix.basename(json.path || "");
      if (json.note) this.note = json.note;
      if (json.tags) this.tags = json.tags;
      if (json.collections) this.collectionIDs = json.collections;
    }

    async saveTx() {
      if (options.onCreatedItemSave) {
        await options.onCreatedItemSave(this, harness);
      }
      items.set(this.id, this);
      this.saveCount = (this.saveCount || 0) + 1;
      if (
        this.saveCount === 1 &&
        this.parentItem &&
        !this.parentItem.attachmentIDs.includes(this.id)
      ) {
        this.parentItem.attachmentIDs.push(this.id);
      }
      if (this.saveCount === 1 && options.notifyOnCreatedItemSave) {
        const addedIDs = options.notifyCreatedItemWithParent
          ? [this.id, this.parentItemID]
          : [this.id];
        await harness.notify("add", addedIDs);
      }
      return this.id;
    }

    async save() {
      return this.saveTx();
    }

    async eraseTx() {
      if (this.isImportedAttachment()) removePath(this.currentPath);
      items.delete(this.id);
      if (this.parentItem) {
        this.parentItem.attachmentIDs = this.parentItem.attachmentIDs.filter(
          (id) => id !== this.id,
        );
      }
      this.erased = true;
    }

    async erase() {
      return this.eraseTx();
    }

    setTags(tags) {
      this.tags = tags;
    }

    setNote(note) {
      this.note = note;
    }

    getNote() {
      return this.note;
    }

    getTags() {
      return this.tags;
    }

    getCollections() {
      return this.collectionIDs;
    }

    setCollections(collectionIDs) {
      this.collectionIDs = collectionIDs;
    }

    toJSON() {
      return {
        title: this.fields.title,
        linkMode: this.isImportedAttachment() ? "imported_file" : "linked_file",
        parentItemID: this.parentItemID,
        tags: this.tags,
        note: this.note,
        collections: this.collectionIDs,
      };
    }

    isAttachment() {
      return true;
    }

    isImportedAttachment() {
      return this.attachmentLinkMode === 0 || this.attachmentLinkMode === 1;
    }

    isLinkedFileAttachment() {
      return this.attachmentLinkMode === 2;
    }

    isEditable() {
      return true;
    }

    get attachmentPath() {
      return this.currentPath;
    }

    set attachmentPath(value) {
      this.currentPath = value;
    }

    async fileExists() {
      return files.has(this.currentPath);
    }

    async relinkAttachmentFile(filePath) {
      calls.relink.push([this.id, filePath]);
      this.currentPath = filePath;
      await this.saveTx();
      return true;
    }

    async getFilePathAsync() {
      return this.currentPath;
    }

    async renameAttachmentFile(newName) {
      this.renameCalls.push(newName);
      const previousPath = this.currentPath;
      this.currentPath = path.posix.join(
        path.posix.dirname(previousPath),
        newName,
      );
      if (files.delete(previousPath)) {
        copyContents(previousPath, this.currentPath);
        fileContents.delete(previousPath);
      }
      return true;
    }

    getField(name) {
      return this.fields[name] || "";
    }

    setField(name, value) {
      this.fields[name] = value;
    }

    getDisplayTitle() {
      return this.fields.title || "";
    }

    getImageSrc() {
      return "attachment-pdflink";
    }

    isTopLevelItem() {
      return !this.parentItemID;
    }

    isRegularItem() {
      return false;
    }
  }

  function snapshotDatabase() {
    return [...items.entries()].map(([id, item]) => ({
      id,
      item,
      deleted: item.deleted,
      parentItemID: item.parentItemID,
      parentItem: item.parentItem,
      topLevelItem: item.topLevelItem,
      attachmentIDs: item.attachmentIDs && [...item.attachmentIDs],
      collectionIDs: item.collectionIDs && [...item.collectionIDs],
      collections: item.getCollections?.() && [...item.getCollections()],
      attachmentPath: item.attachmentPath,
      attachmentLinkMode: item.attachmentLinkMode,
      title: item.getField?.("title"),
      tags: item.getTags?.().map((tag) => ({ ...tag })),
      note: item.getNote?.(),
    }));
  }

  function restoreDatabase(snapshot) {
    items.clear();
    for (const state of snapshot) {
      const item = state.item;
      item.deleted = state.deleted;
      item.parentItemID = state.parentItemID;
      item.parentItem = state.parentItem;
      item.topLevelItem = state.topLevelItem;
      if (state.attachmentIDs) item.attachmentIDs = state.attachmentIDs;
      if (state.collectionIDs) item.collectionIDs = state.collectionIDs;
      if (state.collections) item.setCollections?.(state.collections);
      if (state.attachmentPath) item.attachmentPath = state.attachmentPath;
      if (state.attachmentLinkMode !== undefined) {
        item.attachmentLinkMode = state.attachmentLinkMode;
      }
      if (state.title !== undefined) item.setField?.("title", state.title);
      if (state.tags) item.setTags?.(state.tags);
      if (state.note !== undefined) item.setNote?.(state.note);
      items.set(state.id, item);
    }
  }

  const ProgressWindow = class {
    static setIconURI() {}

    constructor() {
      this.lines = [];
    }

    createLine(line) {
      this.lines.push({ ...line, _hbox: { style: {} } });
      return this;
    }

    show() {
      return this;
    }

    addDescription() {
      return this;
    }

    close() {}

    startCloseTimer() {}
  };

  global.window = {
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
    setInterval: clock.setInterval.bind(clock),
    clearInterval: clock.clearInterval.bind(clock),
    confirm: () => false,
    prompt: () => "",
  };
  global.document = {};
  global.PathUtils = {
    filename: (value) => path.posix.basename(value),
    joinRelative: (...parts) => path.posix.join(...parts),
    normalize: (value) => path.posix.normalize(value),
    parent: (value) => path.posix.dirname(value),
    split: (value) => value.split(/[\\/]/),
  };
  global.IOUtils = {
    exists: async (value) => files.has(value) || directories.has(value),
    stat: async (filePath) => {
      calls.stat.push(filePath);
      if (options.ioStat) return options.ioStat(filePath, harness);
      if (!files.has(filePath) && !directories.has(filePath)) {
        const error = new Error(`File not found: ${filePath}`);
        error.name = "NotFoundError";
        throw error;
      }
      return {
        type: directories.has(filePath) ? "directory" : "regular",
        size: fileContents.get(filePath)?.length || 0,
        lastModified: options.modifiedTimes?.[filePath] || 1,
      };
    },
    copy: async (source, destination, copyOptions = {}) => {
      calls.copy.push([source, destination]);
      calls.copyOptions.push(copyOptions);
      if (
        (copyOptions.noOverwrite || options.rejectExistingCopy) &&
        (files.has(destination) || directories.has(destination))
      ) {
        throw destinationExists(destination);
      }
      if (options.ioCopy) {
        await options.ioCopy(source, destination, harness, copyOptions);
        if (files.has(destination) && !fileContents.has(destination)) {
          fileContents.set(
            destination,
            Buffer.from(fileContents.get(source) || `content:${source}`),
          );
        }
      } else {
        copyContents(source, destination);
      }
    },
    move: async (source, destination, moveOptions = {}) => {
      calls.move.push([source, destination]);
      calls.moveOptions.push(moveOptions);
      if (
        moveOptions.noOverwrite &&
        (files.has(destination) || directories.has(destination))
      ) {
        throw destinationExists(destination);
      }
      if (options.ioMove) {
        await options.ioMove(source, destination, harness, moveOptions);
      } else {
        copyContents(source, destination);
        removePath(source);
      }
    },
    remove: async (value, removeOptions = {}) => {
      calls.remove.push(value);
      if (options.ioRemove) {
        await options.ioRemove(value, harness, removeOptions);
      } else {
        removePath(value, removeOptions.recursive);
      }
    },
    read: async (filePath) => Uint8Array.from(fileContents.get(filePath) || []),
    readUTF8: async (filePath) => {
      if (!files.has(filePath)) {
        const error = new Error(`File not found: ${filePath}`);
        error.name = "NotFoundError";
        throw error;
      }
      return fileContents.get(filePath).toString("utf8");
    },
    writeUTF8: async (filePath, value) => {
      if (options.writeUTF8) await options.writeUTF8(filePath, value, harness);
      files.add(filePath);
      fileContents.set(filePath, Buffer.from(value, "utf8"));
    },
  };
  global.Components = {
    interfaces: { nsIFile: class {} },
  };
  global.OS = { File: {} };
  global.addon = {
    data: {
      alive: true,
      folderSep: "/",
      icons: {},
      notifierID: "",
    },
  };
  global.ztoolkit = {
    Keyboard: {
      register: (callback) => keyboardRegistrations.push(callback),
    },
    Menu: {
      register: (type, config) => menuRegistrations.push({ type, config }),
      unregister: () => {},
      unregisterAll: async () => {},
    },
    ProgressWindow,
    getGlobal: (name) => {
      if (name === "setInterval") {
        return (callback, delay) => {
          const id = nextIntervalID++;
          activeIntervals.add(id);
          if (delay >= 30_000) {
            clock.intervals.set(id, { callback, delay });
          } else {
            queueMicrotask(() => {
              if (activeIntervals.has(id)) callback();
            });
          }
          return id;
        };
      }
      if (name === "clearInterval") {
        return (id) => {
          clock.intervals.delete(id);
          return activeIntervals.delete(id);
        };
      }
      return global[name];
    },
    log: (...args) => logs.push(args),
  };
  global.ZoteroPane = {
    convertLinkedFilesToStoredFiles: async () => {},
    getCollectionTreeRow: () => ({ isCollection: () => true }),
    getSelectedCollection: () => harness.selectedCollection,
    getSelectedItems: () => harness.selectedItems,
    getSelectedLibraryID: () => 1,
    viewAttachment: async () => {},
  };
  global.Zotero = {
    Attachments: {
      LINK_MODE_IMPORTED_FILE: 0,
      LINK_MODE_IMPORTED_URL: 1,
      LINK_MODE_LINKED_FILE: 2,
      LINK_MODE_LINKED_URL: 3,
      getFileBaseNameFromItem: (item) =>
        options.baseName || item.fileBaseName || "renamed",
      importFromFile: async (input) => {
        calls.importFromFile.push(input);
        if (options.importedItem) return options.importedItem;
        if (options.importFromFile) {
          return options.importFromFile(input, harness);
        }
        const id = nextItemID++;
        const storageDir = `/storage/AT${String(id).padStart(6, "0")}`;
        const destination = path.posix.join(
          storageDir,
          path.posix.basename(input.file),
        );
        directories.add(storageDir);
        copyContents(input.file, destination);
        return createAttachment(harness, {
          id,
          mode: "imported",
          parent: items.get(input.parentItemID),
          libraryID: input.libraryID,
          path: destination,
        });
      },
      linkFromFile: async (input) => {
        calls.linkFromFile.push(input);
        return options.linkedItem;
      },
      convertLinkedFileToStoredFile: async (item, conversionOptions = {}) => {
        calls.convertLinkedToStored.push([item.id, conversionOptions]);
        if (options.convertLinkedToStored) {
          return options.convertLinkedToStored(
            item,
            conversionOptions,
            harness,
          );
        }
        const source = await item.getFilePathAsync();
        const storageDir = `/storage/${item.key}`;
        const destination = path.posix.join(
          storageDir,
          path.posix.basename(source),
        );
        directories.add(storageDir);
        copyContents(source, destination);
        item.attachmentLinkMode = 0;
        item.attachmentPath = destination;
        await item.saveTx();
        if (conversionOptions.move) removePath(source);
        return item;
      },
    },
    Collections: {
      get: (id) => items.get(id),
    },
    DB: {
      executeTransaction: async (callback) => {
        const snapshot = snapshotDatabase();
        try {
          if (options.transaction) {
            return await options.transaction(callback, harness);
          }
          return await callback();
        } catch (error) {
          restoreDatabase(snapshot);
          throw error;
        }
      },
    },
    File: {
      createDirectoryIfMissingAsync: async (value) => directories.add(value),
      getExtension: (value) => path.posix.extname(value).slice(1),
      getValidFileName: (value) => value,
      iterateDirectory: async (directory, callback) => {
        for (const filePath of files) {
          if (path.posix.dirname(filePath) === directory) {
            await callback({
              path: filePath,
              name: path.posix.basename(filePath),
              isDir: false,
            });
          }
        }
      },
      pathToFile: options.pathToFile || fileObject,
    },
    Fulltext: {
      transferItemIndex: async (original, replacement) => {
        calls.transferIndex.push([original.id, replacement.id]);
        if (options.transferItemIndex) {
          await options.transferItemIndex(original, replacement, harness);
        }
      },
    },
    Item: MockCreatedItem,
    Items: {
      get: (ids) => {
        if (Array.isArray(ids)) return ids.map((id) => items.get(Number(id)));
        return items.get(Number(ids));
      },
      getAsync: async (id) => items.get(Number(id)),
      getByLibraryAndKey: (libraryID, key) =>
        [...items.values()].find(
          (item) => item.libraryID === libraryID && item.key === key,
        ),
      getByLibraryAndKeyAsync: async (libraryID, key) =>
        [...items.values()].find(
          (item) => item.libraryID === libraryID && item.key === key,
        ),
      getAll: async (libraryID) =>
        [...items.values()].filter(
          (item) => !libraryID || item.libraryID === libraryID,
        ),
      moveChildItems: async (original, replacement) => {
        calls.moveChildItems.push([original.id, replacement.id]);
        if (options.moveChildItems) {
          await options.moveChildItems(original, replacement, harness);
        }
        for (const item of items.values()) {
          if (item.parentItemID === original.id) {
            item.parentItemID = replacement.id;
            item.parentItem = replacement;
          }
        }
      },
    },
    Libraries: {
      userLibraryID: 1,
      getAll: () =>
        [...new Set([1, ...[...items.values()].map((item) => item.libraryID)])]
          .filter(Boolean)
          .map((libraryID) => ({ libraryID })),
      get: (id) => ({
        libraryID: id,
        libraryType: id === 1 ? "user" : "group",
        editable: !options.readOnlyLibraries?.includes(id),
        filesEditable: !options.readOnlyFileLibraries?.includes(id),
      }),
    },
    Notifier: {
      registerObserver: (observer) => {
        const id = `observer-${nextObserverID++}`;
        observers.set(id, observer);
        return id;
      },
      unregisterObserver: (id) => {
        calls.unregister.push(id);
        observers.delete(id);
      },
    },
    PDFWorker: {
      _enqueue: options.pdfWorkerEnqueue || (async (callback) => callback()),
      _query: options.pdfWorkerQuery || (async () => ({})),
    },
    Prefs: {
      clear: (key) => prefs.delete(key),
      get: (key) => prefs.get(key),
      set: (key, value) => {
        prefs.set(key, value);
        return value;
      },
    },
    Promise: {
      defer: () => {
        let resolve;
        const promise = new Promise((res) => {
          resolve = res;
        });
        return { promise, resolve };
      },
      delay: async (milliseconds) => {
        delays.push(milliseconds);
        if (options.delay) await options.delay(milliseconds);
      },
    },
    RecognizeDocument: {
      recognizeItems: async (recognizedItems) => {
        calls.recognize.push(recognizedItems.map((item) => item.id));
        if (options.recognizeItems) {
          await options.recognizeItems(recognizedItems, harness);
        }
      },
    },
    Relations: {
      copyObjectSubjectRelations: async (original, replacement) => {
        calls.copyRelations.push([original.id, replacement.id]);
        if (options.copyRelations) {
          await options.copyRelations(original, replacement, harness);
        }
      },
    },
    Utilities: {
      Internal: {
        md5: (file) => {
          const filePath = typeof file === "string" ? file : file.path;
          return options.md5
            ? options.md5(filePath)
            : crypto
                .createHash("md5")
                .update(fileContents.get(filePath) || `content:${filePath}`)
                .digest("hex");
        },
        md5Async: async (file) => {
          const filePath = typeof file === "string" ? file : file.path;
          return options.md5
            ? options.md5(filePath)
            : crypto
                .createHash("md5")
                .update(fileContents.get(filePath) || `content:${filePath}`)
                .digest("hex");
        },
      },
      removeDiacritics:
        options.removeDiacritics ||
        ((value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
    },
    DataDirectory: { dir: "/zotero" },
    getMainWindows: () => [],
    getStorageDirectory: () => ({ path: "/storage" }),
    isWin: false,
  };

  const module = { exports: {} };
  new Function("module", "exports", "require", getBundledMenuCode())(
    module,
    module.exports,
    require,
  );
  harness.module = module.exports;

  harness.setPref = (key, value) => prefs.set(`${PREF_PREFIX}.${key}`, value);
  harness.writeFile = (filePath, content) => {
    files.add(filePath);
    fileContents.set(filePath, Buffer.from(content));
  };
  harness.notify = async (event, ids) => {
    for (const observer of [...observers.values()]) {
      await observer.notify(event, "item", ids, {});
    }
  };
  harness.cleanup = () => {
    delete global.window;
    delete global.document;
    delete global.PathUtils;
    delete global.IOUtils;
    delete global.Components;
    delete global.OS;
    delete global.addon;
    delete global.ztoolkit;
    delete global.ZoteroPane;
    delete global.Zotero;
  };
  return harness;
}

function createRegularItem(harness, options = {}) {
  const fields = { title: options.title || "Parent" };
  const item = {
    id: options.id || 1,
    key: options.key || `IT${String(options.id || 1).padStart(6, "0")}`,
    deleted: options.deleted || false,
    fileBaseName: options.fileBaseName || "renamed",
    libraryID: options.libraryID || 1,
    attachmentIDs: options.attachmentIDs || [],
    collectionIDs: options.collectionIDs || [],
    getAttachments() {
      return [...this.attachmentIDs];
    },
    getCollections() {
      return [...this.collectionIDs];
    },
    getDisplayTitle() {
      return fields.title;
    },
    getField(name) {
      return fields[name] || "";
    },
    getImageSrc() {
      return "item-icon";
    },
    isAttachment() {
      return false;
    },
    isRegularItem() {
      return true;
    },
    isTopLevelItem() {
      return true;
    },
    isEditable() {
      return options.editable !== false;
    },
  };
  harness.items.set(item.id, item);
  return item;
}

function createAttachment(harness, options = {}) {
  let currentPath = options.path || `/source/${options.filename || "old.pdf"}`;
  let title = options.title || path.posix.basename(currentPath);
  let note = options.note || "";
  let tags = options.tags || [];
  let collectionIDs = options.collectionIDs || [];
  const calls = {
    erase: 0,
    pathReads: 0,
    rename: [],
    save: 0,
    setField: [],
    relink: [],
  };
  const parent = options.parent;
  const attachment = {
    id: options.id || 2,
    key: options.key || `AT${String(options.id || 2).padStart(6, "0")}`,
    deleted: options.deleted || false,
    libraryID: options.libraryID || 1,
    parentItemID: parent?.id,
    parentItem: parent,
    topLevelItem: parent || undefined,
    attachmentContentType: options.contentType || "application/pdf",
    attachmentLinkMode: options.mode === "linked" ? 2 : 0,
    get attachmentPath() {
      return currentPath;
    },
    set attachmentPath(value) {
      currentPath = value;
    },
    get attachmentFilename() {
      return path.posix.basename(currentPath);
    },
    calls,
    async eraseTx() {
      calls.erase++;
      if (options.onErase) await options.onErase(this);
      if (this.isImportedAttachment()) {
        const storageDirectory = path.posix.dirname(currentPath);
        for (const existingPath of [...harness.files, ...harness.directories]) {
          if (
            existingPath === currentPath ||
            (storageDirectory.startsWith("/storage/") &&
              (existingPath === storageDirectory ||
                existingPath.startsWith(`${storageDirectory}/`)))
          ) {
            harness.files.delete(existingPath);
            harness.fileContents.delete(existingPath);
            harness.directories.delete(existingPath);
          }
        }
      }
      harness.items.delete(this.id);
      if (this.parentItem) {
        this.parentItem.attachmentIDs = this.parentItem.attachmentIDs.filter(
          (id) => id !== this.id,
        );
      }
    },
    async erase() {
      return this.eraseTx();
    },
    async fileExists() {
      if (options.fileExists) return options.fileExists(this);
      return options.exists !== false;
    },
    async getFilePathAsync() {
      calls.pathReads++;
      return currentPath;
    },
    getDisplayTitle() {
      return title;
    },
    getField(name) {
      return name === "title" ? title : "";
    },
    getImageSrc() {
      return "attachment-pdflink";
    },
    getNote() {
      return note;
    },
    getTags() {
      return tags;
    },
    getCollections() {
      return collectionIDs;
    },
    getAnnotations() {
      return [...harness.items.values()].filter(
        (item) => item.parentItemID === this.id && item.isAnnotation?.(),
      );
    },
    setCollections(value) {
      collectionIDs = value;
    },
    setTags(value) {
      tags = value;
    },
    setNote(value) {
      note = value;
    },
    fromJSON(json) {
      if (json.path) currentPath = json.path;
      if (json.title) title = json.title;
      if (json.tags) tags = json.tags;
      if (json.note) note = json.note;
      if (json.collections) collectionIDs = json.collections;
      if (json.parentItemID || json.parentItem) {
        this.parentItemID = json.parentItemID || json.parentItem;
        this.parentItem = harness.items.get(this.parentItemID);
      }
      if (json.linkMode) {
        this.attachmentLinkMode = json.linkMode === "linked_file" ? 2 : 0;
      }
    },
    isAttachment() {
      return true;
    },
    isImportedAttachment() {
      return this.attachmentLinkMode === 0 || this.attachmentLinkMode === 1;
    },
    isLinkedFileAttachment() {
      return this.attachmentLinkMode === 2;
    },
    isRegularItem() {
      return false;
    },
    isTopLevelItem() {
      return !parent;
    },
    isEditable() {
      return options.editable !== false;
    },
    async relinkAttachmentFile(filePath) {
      calls.relink.push(filePath);
      harness.calls.relink.push([this.id, filePath]);
      if (options.onRelink) await options.onRelink(this, filePath);
      currentPath = filePath;
      await this.saveTx();
      return true;
    },
    async renameAttachmentFile(newName) {
      calls.rename.push(newName);
      if (options.renameResult === false) return false;
      const previousPath = currentPath;
      currentPath = path.posix.join(path.posix.dirname(currentPath), newName);
      if (harness.files.delete(previousPath)) {
        harness.files.add(currentPath);
        harness.fileContents.set(
          currentPath,
          Buffer.from(
            harness.fileContents.get(previousPath) || `content:${previousPath}`,
          ),
        );
        harness.fileContents.delete(previousPath);
      }
      return true;
    },
    async saveTx() {
      calls.save++;
      if (options.onSave) await options.onSave(this);
      return this.id;
    },
    async save() {
      return this.saveTx();
    },
    setField(name, value) {
      calls.setField.push([name, value]);
      if (name === "title") title = value;
    },
    toJSON() {
      return {
        linkMode: this.isLinkedFileAttachment()
          ? "linked_file"
          : "imported_file",
        parentItemID: this.parentItemID,
        title,
        note,
        tags,
        collections: collectionIDs,
      };
    },
  };
  harness.items.set(attachment.id, attachment);
  if (parent && !parent.attachmentIDs.includes(attachment.id)) {
    parent.attachmentIDs.push(attachment.id);
  }
  return attachment;
}

module.exports = {
  PREF_PREFIX,
  createAttachment,
  createHarness,
  createRegularItem,
};
