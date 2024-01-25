import { getString } from "../utils/locale";
import { config } from "../../package.json";
import { getPref, setPref } from "../utils/prefs";
import { waitUntil, waitUtilAsync } from "../utils/wait";

export default class Menu {
  constructor() {
    this.init();
    this.register();
    const callback = {
      notify: async (
        event: string,
        type: string,
        ids: number[] | string[],
        extraData: { [key: string]: any },
      ) => {
        ztoolkit.log(event, type, extraData);
        if (type == "item" && event == "add") {
          window.setTimeout(async () => {
            const items = Zotero.Items.get(ids as number[]);
            const attItems = [];
            for (const item of items) {
              if (
                item.isImportedAttachment() &&
                !item.isTopLevelItem() &&
                (await item.fileExists())
              ) {
                attItems.push(item);
              }
              if (item.isTopLevelItem()) {
                // 等待是否有新增附件
                await Zotero.Promise.delay(1000);
                for (const id of item.getAttachments()) {
                  attItems.push(Zotero.Items.get(id));
                }
              }
            }
            if (attItems.length > 0) {
              attItems.map(async (att: Zotero.Item) => {
                try {
                  if (Zotero.Prefs.get("autoRenameFiles")) {
                    await renameFile(att);
                  }
                  if (
                    getPref("autoMove") &&
                    getPref("attachType") == "linking"
                  ) {
                    att = (await moveFile(att)) as Zotero.Item;
                  }
                } catch (e) {
                  ztoolkit.log(e);
                }
                showAttachmentItem(att);
              });
            }
          });
        }
      },
    };

    // Register the callback in Zotero as an item observer
    addon.data.notifierID = Zotero.Notifier.registerObserver(callback, [
      "tab",
      "item",
      "file",
    ]);

    // Unregister callback when the window closes (important to avoid a memory leak)
    window.addEventListener(
      "unload",
      (e: Event) => {
        Zotero.Notifier.unregisterObserver(addon.data.notifierID);
      },
      false,
    );
  }

  private init() {
    for (const name in addon.data.icons) {
      ztoolkit.ProgressWindow.setIconURI(name, addon.data.icons[name]);
    }
  }

  private register() {
    // 分隔符
    ztoolkit.Menu.register("item", {
      tag: "menuseparator",
      getVisibility: () => {
        const items = ZoteroPane.getSelectedItems();
        return items.some((i) => i.isTopLevelItem() || i.isAttachment());
      },
    });
    // 附加新文件
    //   条目
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      label: getString("attach-new-file"),
      icon: addon.data.icons.attachNewFile,
      getVisibility: () => {
        // 只选择一个父级条目
        const items = ZoteroPane.getSelectedItems();
        return (
          items.length == 1 &&
          items[0].isTopLevelItem() &&
          items[0].isRegularItem()
        );
      },
      commandListener: async (ev) => {
        const item = ZoteroPane.getSelectedItems()[0];
        await attachNewFile({
          libraryID: item.libraryID,
          parentItemID: item.id,
          collections: undefined,
        });
      },
    });
    //   分类
    ztoolkit.Menu.register("collection", {
      tag: "menuitem",
      label: getString("attach-new-file"),
      icon: addon.data.icons.attachNewFile,
      commandListener: async (ev) => {
        const collection =
          ZoteroPane.getSelectedCollection() as Zotero.Collection;
        if (!collection) {
          // 非collection暂不处理
          new ztoolkit.ProgressWindow("Attach New File")
            .createLine({
              text: "Please select a Zotero Collection",
              type: "attachNewFile",
            })
            .show();
        }
        await attachNewFile({
          libraryID: collection.libraryID,
          parentItemID: undefined,
          collections: [collection.id],
        });
      },
    });
    // 附件管理
    ztoolkit.Menu.register("item", {
      tag: "menu",
      getVisibility: () => {
        return getAttachmentItems().length > 0;
      },
      label: getString("attachment-manager"),
      icon: addon.data.icons.favicon,
      subElementOptions: [
        {
          tag: "menuitem",
          label: getString("rename-attachment"),
          icon: addon.data.icons.renameAttachment,
          commandListener: async (ev) => {
            for (const item of getAttachmentItems()) {
              try {
                const attItem = await renameFile(item);
                attItem && showAttachmentItem(attItem);
              } catch (e) {
                ztoolkit.log(e);
              }
            }
          },
        },
        {
          tag: "menuitem",
          label: getString("move-attachment"),
          icon: addon.data.icons.moveFile,
          commandListener: async (ev) => {
            for (const item of getAttachmentItems()) {
              try {
                const attItem = await moveFile(item);
                attItem && showAttachmentItem(attItem);
              } catch (e) {
                ztoolkit.log(e);
              }
            }
          },
        },
        {
          tag: "menuitem",
          label: "恢复PDF标注",
          commandListener: async () => {
            ZoteroPane.getSelectedItems().forEach(async (item) => {
              const attItem = Zotero.Items.get(item.getAttachments()[0]);
              const trashedAttItem = item
                .getAttachments(true)
                .filter((i) => i != attItem.id)
                .map((i) => Zotero.Items.get(i))
                .find((i) => i.getAnnotations().length > 0);
              if (trashedAttItem) {
                await transferItem(trashedAttItem, attItem);
              }
            });
          },
        },
      ],
    });
    // 打开方式
    const fileHandlerArr = JSON.parse(
      (Zotero.Prefs.get(`${config.addonRef}.openUsing`) as string) || "[]",
    );
    const setPref = (fileHandlerArr: string[]) => {
      window.setTimeout(async () => {
        Zotero.Prefs.set(
          `${config.addonRef}.openUsing`,
          JSON.stringify(fileHandlerArr),
        );
        await ztoolkit.Menu.unregisterAll();
        new Menu();
      });
    };
    ztoolkit.Menu.register("item", {
      tag: "menu",
      getVisibility: () => getAttachmentItems(false).length > 0,
      label: getString("open-using"),
      icon: addon.data.icons.openUsing,
      subElementOptions: [
        {
          tag: "menuitem",
          label: "Zotero",
          commandListener: async (ev) => {
            // 第二个参数应该从文件分析得出，默认pdf
            openUsing("", "pdf");
          },
        },
        {
          tag: "menuitem",
          label: "System",
          commandListener: async (ev) => {
            openUsing("system", "pdf");
          },
        },
        ...((() => {
          const children = [];
          for (const fileHandler of fileHandlerArr) {
            children.push({
              tag: "menuitem",
              label: OS.Path.basename(fileHandler),
              commandListener: async (ev: MouseEvent) => {
                if (ev.button == 2) {
                  if (window.confirm("Delete?")) {
                    const _fileHandlerArr = fileHandlerArr.filter(
                      (i: string) => i != fileHandler,
                    ) as string[];
                    setPref(_fileHandlerArr);
                  }
                } else {
                  openUsing(fileHandler, "pdf");
                }
              },
            });
          }
          return children;
        })() as any),
        {
          tag: "menuitem",
          label: getString("choose-other-app"),
          commandListener: async (ev) => {
            // #42 Multiple extensions may be included, separated by a semicolon and a space.
            const filename = await new ztoolkit.FilePicker(
              "Select Application",
              "open",
              [["Application", "*.exe; *.app"]], // support windows .exe and macOS .app both.
            ).open();
            if (filename && fileHandlerArr.indexOf(filename) == -1) {
              fileHandlerArr.push(filename);
              setPref(fileHandlerArr);
              openUsing(filename, "pdf");
            }
          },
        },
      ],
    });
  }
}

/**
 * 获取所有附件条目
 */
function getAttachmentItems(hasParent = true) {
  const attachmentItems = [];
  for (const item of ZoteroPane.getSelectedItems()) {
    if (item.isAttachment() && (hasParent ? !item.isTopLevelItem() : true)) {
      attachmentItems.push(item);
    } else if (item.isRegularItem()) {
      for (const id of item.getAttachments()) {
        const _item = Zotero.Items.get(id);
        if (_item.isAttachment()) {
          attachmentItems.push(_item);
        }
      }
    }
  }

  return attachmentItems;
}

async function openUsing(fileHandler: string, fileType = "pdf") {
  const _fileHandler = Zotero.Prefs.get(`fileHandler.${fileType}`) as string;
  Zotero.Prefs.set(`fileHandler.${fileType}`, fileHandler);
  const selectedItems = ZoteroPane.getSelectedItems();
  const ids: number[] = [];
  await Promise.all(
    selectedItems.map(async (item: Zotero.Item) => {
      if (item.isAttachment()) {
        ids.push(item.id);
      } else {
        ids.push((await item.getBestAttachments())[0].id);
      }
    }),
  );
  await ZoteroPane.viewAttachment(ids);
  Zotero.Prefs.set(`fileHandler.${fileType}`, _fileHandler);
}

/**
 * Get the last modified file from directory
 * @param  {string} path Path to directory
 * @return {string}      Path to last modified file in folder or undefined.
 */
function getLastFileInFolder(path: string) {
  const dir = Zotero.File.pathToFile(path);
  const files = dir.directoryEntries;
  let lastmod = { lastModifiedTime: 0, path: undefined };
  while (files.hasMoreElements()) {
    // get next file
    const file = files.getNext().QueryInterface(Components.interfaces.nsIFile);
    // skip if directory, hidden file or certain file types
    if (file.isDirectory() || file.isHidden()) {
      continue;
    }
    // check modification time
    if (file.isFile() && file.lastModifiedTime > lastmod.lastModifiedTime) {
      lastmod = file;
    }
  }
  // return sorted directory entries
  return lastmod.path;
}

/**
 * 重命名文件，但不重命名Zotero内显示的名称 - 来自Zotero官方代码
 * @param item
 * @returns
 */
async function renameFile(attItem: Zotero.Item) {
  if (!checkFileType(attItem)) {
    return;
  }
  const file = (await attItem.getFilePathAsync()) as string;
  const parentItemID = attItem.parentItemID as number;
  const parentItem = await Zotero.Items.getAsync(parentItemID);
  // getFileBaseNameFromItem
  let newName = Zotero.Attachments.getFileBaseNameFromItem(parentItem);

  const extRE = /\.[^.]+$/;
  const origFilename = PathUtils.split(file).pop() as string;
  const ext = origFilename.match(extRE);
  if (ext) {
    newName = newName + ext[0];
  }
  const origFilenameNoExt = origFilename.replace(extRE, "");
  const renamed = await attItem.renameAttachmentFile(newName, false, true);
  if (renamed !== true) {
    ztoolkit.log("renamed = " + renamed);
    return await renameFile(attItem);
  }
  // const origTitle = attItem.getField("title");
  // if (origTitle == origFilename || origTitle == origFilenameNoExt) {
  attItem.setField("title", newName);
  await attItem.saveTx();
  // }
  return attItem;
}

/**
 * 移动文件
 * @param item Attachment Item
 */
export async function moveFile(attItem: Zotero.Item) {
  if (!checkFileType(attItem)) {
    return;
  }
  // 1. 目标根路径
  let destDir: string | boolean = getPref("destDir") as string;
  if (!destDir) {
    destDir = await new ztoolkit.FilePicker(
      "Select Destination Directory",
      "folder",
    ).open();
    if (destDir) {
      setPref("destDir", destDir);
    } else {
      return;
    }
  }
  // 2. 中间路径
  let subfolder = "";
  const subfolderFormat = getPref("subfolderFormat") as string;
  // Zotero.Attachments.getFileBaseNameFromItem 补充不支持的变量
  // 3. 得到最终路径
  // @ts-ignore 未添加属性
  const _getValidFileName = Zotero.File.getValidFileName;
  // @ts-ignore 未添加属性
  Zotero.File.getValidFileName = (s: string) => s;
  if (subfolderFormat.length > 0) {
    subfolder = subfolderFormat
      .split(/[\\/]/)
      .map((formatString: string) => {
        ztoolkit.log(formatString);
        if (formatString == "{{collection}}") {
          return getCollectionPathsOfItem(attItem.topLevelItem);
        } else {
          return Zotero.Attachments.getFileBaseNameFromItem(
            attItem.topLevelItem,
            formatString,
          );
        }
      })
      .join(addon.data.folderSep);
    if (Zotero.isWin) {
      subfolder = subfolder.replace(/[/]/g, "\\");
    } else {
      subfolder = subfolder.replace(/[\\]/g, "/");
    }
    // @ts-ignore 未添加属性
    Zotero.File.getValidFileName = _getValidFileName;
    ztoolkit.log("subfolder", subfolder);
    destDir = OS.Path.join(destDir, subfolder);
  }
  const sourcePath = (await attItem.getFilePathAsync()) as string;
  if (!sourcePath) {
    return;
  }
  const filename = OS.Path.basename(sourcePath);
  let destPath = OS.Path.join(destDir, filename);
  // window.alert(destPath)
  if (await OS.File.exists(destPath)) {
    await Zotero.Promise.delay(1000);
    // Click to enter a specified suffix.
    const popupWin = new ztoolkit.ProgressWindow("Attanger", {
      closeTime: -1,
      closeOtherProgressWindows: true,
    })
      .createLine({
        text: "The target file already exists; a numeric suffix will be automatically added to the filename.",
        icon: addon.data.icons.moveFile,
      })
      .show();
    // Zotero.ProgressWindowSet.remove(popupWin)
    popupWin.addDescription(
      `<a href="https://zotero.org">Click to enter a specified suffix.</a>`,
    );
    await waitUtilAsync(() =>
      // @ts-ignore oriate
      Boolean(popupWin.lines && popupWin.lines[0]._itemText),
    );
    const lock = Zotero.Promise.defer();
    const timer = window.setTimeout(() => {
      popupWin.close();
      lock.resolve();
    }, 3e3);
    // @ts-ignore private
    popupWin.lines[0]._hbox.ownerDocument
      .querySelector("label[href]")
      .addEventListener("click", async (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        window.clearTimeout(timer);
        popupWin.close();
        const suffix = window.prompt("Suffix") as string;
        destPath = await addSuffixToFilename(destPath, suffix);
        lock.resolve();
      });

    await lock.promise;
    destPath = await addSuffixToFilename(destPath);
  }
  // 创建中间路径
  if (!(await OS.File.exists(destDir))) {
    const create = [destDir];
    let parent = OS.Path.dirname(destDir);
    while (!(await OS.File.exists(parent))) {
      create.push(parent);
      parent = OS.Path.dirname(parent);
    }
    await Promise.all(create.reverse().map(async (f) =>
      await Zotero.File.createDirectoryIfMissingAsync(f)
    ));
  }
  // await Zotero.File.createDirectoryIfMissingAsync(destDir);
  // 移动文件到目标文件夹
  if (sourcePath !== destPath) {
    try {
      await OS.File.move(sourcePath, destPath);
    } catch (e) {
      ztoolkit.log(e);
      return await moveFile(attItem);
    }
  }
  const options = {
    file: destPath,
    libraryID: attItem.topLevelItem.libraryID,
    parentItemID: attItem.topLevelItem.id,
    collections: undefined,
  };
  const newAttItem = await Zotero.Attachments.linkFromFile(options);
  window.setTimeout(async () => {
    // 迁移标注
    await transferItem(attItem, newAttItem);
    removeEmptyFolder(OS.Path.dirname(sourcePath));
    await attItem.eraseTx();
  });
  return newAttItem;
}

async function attachNewFile(options: {
  libraryID: number;
  parentItemID: number | undefined;
  collections: number[] | undefined;
}) {
  let sourceDir: string | boolean = getPref("sourceDir") as string;
  if (!(await OS.File.exists(sourceDir))) {
    sourceDir = await new ztoolkit.FilePicker(
      "Select Source Directory",
      "folder",
    ).open();
    if (sourceDir) {
      setPref("sourceDir", sourceDir);
    } else {
      return;
    }
  }
  const path = getLastFileInFolder(sourceDir);
  if (!path) {
    new ztoolkit.ProgressWindow(config.addonName)
      .createLine({ text: "No File Found", type: "default" })
      .show();
  } else {
    const attItem = await Zotero.Attachments.importFromFile({
      file: path,
      ...options,
    });
    showAttachmentItem(attItem);
    if (!attItem.parentItemID) {
      Zotero.RecognizeDocument.autoRecognizeItems([attItem]);
    }
    removeFile(path);
  }
}

function removeFile(file: any, force = false) {
  if (addon.data.env == "development" && force == false) {
    return;
  }
  file = Zotero.File.pathToFile(file);
  if (!file.exists()) return;
  try {
    // remove file
    if (!file.isDirectory()) {
      file.remove(false);
    }
    // ... for directories, remove them if no non-hidden files are inside
    else {
      const files = file.directoryEntries;
      while (files.hasMoreElements()) {
        const f = files.getNext().QueryInterface(Components.interfaces.nsIFile);
        if (!f.isHidden()) return;
      }
      file.remove(true);
    }
  } catch (err) {
    ztoolkit.log(err);
  }
}

/**
 * 获取Item的分类路径
 * @param item
 * @returns
 */
function getCollectionPathsOfItem(item: Zotero.Item) {
  const getCollectionPath = function (collectionID: number): string {
    const collection = Zotero.Collections.get(
      collectionID,
    ) as Zotero.Collection;
    if (!collection.parentID) {
      return collection.name;
    }
    return OS.Path.normalize(
      getCollectionPath(collection.parentID) +
      addon.data.folderSep +
      collection.name,
    ) as string;
  };
  try {
    return [ZoteroPane.getSelectedCollection()!.id].map(getCollectionPath)[0];
  } catch {
    return item.getCollections().map(getCollectionPath).slice(0, 1)[0];
  }
}

function checkFileType(attItem: Zotero.Item) {
  const fileTypes = getPref("fileTypes") as string;
  if (!fileTypes) return true;
  const pos = attItem.attachmentFilename.lastIndexOf("."),
    fileType =
      pos == -1 ? "" : attItem.attachmentFilename.substr(pos + 1).toLowerCase(),
    regex = fileTypes.toLowerCase().replace(/,/gi, "|");
  // return value
  return fileType.search(new RegExp(regex)) >= 0 ? true : false;
}

/**
 * 向popupWin添加附件行
 * @param attItem
 * @param type
 */
function showAttachmentItem(attItem: Zotero.Item) {
  const popupWin = new ztoolkit.ProgressWindow("Attanger", {
    closeTime: -1,
    closeOtherProgressWindows: true,
  });
  // 显示父行
  if (attItem.isTopLevelItem()) {
    popupWin
      .createLine({
        text: (ZoteroPane.getSelectedCollection() as Zotero.Collection).name,
        icon: addon.data.icons.collection,
      })
      .show();
  } else {
    const parentItem = attItem.parentItem as Zotero.Item;
    popupWin
      .createLine({
        text: parentItem.getField("title") as string,
        icon: parentItem.getImageSrc(),
      })
      .show();
  }
  // 显示附件行
  popupWin.createLine({
    text: attItem.getField("title") as string,
    icon: attItem.getImageSrc(),
  });
  // 设置透明度 调整缩进
  // @ts-ignore lines私有变量
  const lines = popupWin.lines;
  waitUntil(
    () => lines?.[1]?._hbox,
    () => {
      const hbox = lines?.[1]?._hbox;
      if (hbox) {
        hbox.style.opacity = "1";
        hbox.style.marginLeft = "2em";
      }
    },
    10,
  );
  popupWin.startCloseTimer(3000);
}

/**
 * Remove empty folders recursively within zotfile directories
 * @param  {String|nsIFile} folder Folder as nsIFile.
 * @return {void}
 */
async function removeEmptyFolder(path: string) {
  if (!getPref("autoRemoveEmptyFolder") as boolean) {
    return false;
  }
  const folder = Zotero.File.pathToFile(path);
  let rootFolders = [Zotero.getStorageDirectory().path];
  const source_dir = getPref("sourceDir") as string;
  const dest_dir = getPref("destDir") as string;
  if (source_dir != "") {
    rootFolders.push(source_dir);
  }
  if (dest_dir != "") {
    rootFolders.push(dest_dir);
  }
  rootFolders = rootFolders.map((path) => OS.Path.normalize(path));
  // 不属于插件相关根目录，不处理
  if (!rootFolders.find((dir) => folder.path.startsWith(dir))) {
    return false;
  }
  if (folder.directoryEntries.hasMoreElements()) {
    return true;
  } else {
    removeFile(folder, true);
    return await removeEmptyFolder(OS.Path.dirname(folder.path));
  }
}

/**
 * 迁移数据
 */
async function transferItem(
  originalItem: Zotero.Item,
  targetItem: Zotero.Item,
) {
  ztoolkit.log("迁移标注");
  await Zotero.DB.executeTransaction(async function () {
    await Zotero.Items.moveChildItems(originalItem, targetItem);
  });
  // 迁移相关
  ztoolkit.log("迁移相关");
  await Zotero.Relations.copyObjectSubjectRelations(originalItem, targetItem);
  // 迁移索引
  ztoolkit.log("迁移索引");
  await Zotero.DB.executeTransaction(async function () {
    await Zotero.Fulltext.transferItemIndex(originalItem, targetItem);
  });
  // 迁移标签
  ztoolkit.log("迁移标签");
  targetItem.setTags(originalItem.getTags());
  // 迁移PDF笔记
  ztoolkit.log("迁移PDF笔记");
  targetItem.setNote(originalItem.getNote());
  await targetItem.saveTx();
}

/**
 * 为文件添加后缀，如果存在
 * @param filename
 * @returns
 */
async function addSuffixToFilename(filename: string, suffix?: string) {
  let incr = 0;
  let destPath, destName;

  // 提取文件名（不含扩展名）和扩展名
  const [root, ext] = (() => {
    const parts = filename.split(".");
    const ext = parts.length > 1 ? parts.pop() : "";
    return [parts.join("."), ext];
  })();
  if (suffix) {
    // 直接返回不在考虑是否存在
    return ext ? `${root}_${suffix}.${ext}` : `${root}_${suffix}`;
  }
  while (true) {
    // 如果存在数字后缀，则添加它
    if (incr) {
      destName = ext ? `${root}_${incr}.${ext}` : `${root}_${incr}`;
    } else {
      destName = filename;
    }

    destPath = destName; // 假设 destPath 是目标文件路径

    // 检查文件是否存在
    if (await OS.File.exists(destPath)) {
      incr++;
    } else {
      return destPath;
    }
  }
}
