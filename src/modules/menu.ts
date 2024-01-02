import { getString } from "../utils/locale";
import { config } from "../../package.json";
import { getPref, setPref } from "../utils/prefs";
import { waitUntil } from "../utils/wait";

export default class Menu {
  constructor() {
    this.init();
    this.register();
    let queue: number[] = [];
    const callback = {
      notify: async (
        event: string,
        type: string,
        ids: number[] | string[],
        extraData: { [key: string]: any },
      ) => {
        if (type == "item") {
          let atts = Zotero.Items.get(ids as number[]).filter(
            (att) =>
              att.isImportedAttachment() &&
              !att.isTopLevelItem() &&
              att.fileExists(),
          ) as Zotero.Item[];
          for (const att of atts) {
            if (queue.indexOf(att.id) >= 0) {
              atts = atts.filter((_att) => _att.id != att.id);
            } else {
              queue.push(att.id);
            }
          }
          if (atts.length > 0) {
            atts.map(async (att: Zotero.Item) => {
              try {
                if (Zotero.Prefs.get("autoRenameFiles")) {
                  await renameFile(att);
                }
                if (getPref("autoMove") && getPref("attachType") == "linking") {
                  att = (await moveFile(att)) as Zotero.Item;
                }
              } catch (e) {
                ztoolkit.log(e);
              }

              queue = queue.filter((id) => att.id != id);
              showAttachmentItem(att);
            });
          }
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
    // addon.data.icons =
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
                await renameFile(item);
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
                await moveFile(item);
              } catch (e) {
                ztoolkit.log(e);
              }
            }
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
      getVisibility: () => getAttachmentItems().length > 0,
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
          label: Zotero.locale == "zh-CN" ? "系统" : "System",
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
function getAttachmentItems() {
  const attachmentItems = [];
  for (const item of ZoteroPane.getSelectedItems()) {
    if (item.isAttachment()) {
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
  if (!renamed) {
    Zotero.debug("Could not rename file (" + renamed + ")");
    return;
  }
  // TODO: 做成选项是否重命名条目名称
  const origTitle = attItem.getField("title");
  if (origTitle == origFilename || origTitle == origFilenameNoExt) {
    attItem.setField("title", newName);
    await attItem.saveTx();
  }
  return newName;
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
  // const folderSep = Zotero.isWin ? "\\" : "/";
  let subfolder = "";
  const subfolderFormat = getPref("subfolderFormat") as string;
  // Zotero.Attachments.getFileBaseNameFromItem 补充不支持的变量
  // 3. 得到最终路径
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
    ztoolkit.log("subfolder", subfolder);
    destDir = OS.Path.join(destDir, subfolder);
  }
  const sourcePath = (await attItem.getFilePathAsync()) as string;
  if (!sourcePath) {
    return;
  }
  ztoolkit.log("sourcePath", sourcePath);
  const filename = OS.Path.basename(sourcePath);
  ztoolkit.log("filename", filename);
  const destPath = OS.Path.join(destDir, filename);
  // 创建中间路径
  ztoolkit.log("destDir", destDir);
  if (!(await OS.File.exists(destDir))) {
    const create = [destDir];
    let parent = OS.Path.dirname(destDir);
    while (!(await OS.File.exists(parent))) {
      create.push(parent);
      parent = OS.Path.dirname(parent);
    }
    await Promise.all(create.reverse().map((f) => OS.File.makeDir(f)));
  }
  // await Zotero.File.createDirectoryIfMissingAsync(destDir);
  // 移动文件到目标文件夹
  if (sourcePath !== destPath) {
    await OS.File.move(sourcePath, destPath);
  }
  const options = {
    file: destPath,
    libraryID: attItem.topLevelItem.libraryID,
    parentItemID: attItem.topLevelItem.id,
    collections: undefined,
  };
  await attItem.eraseTx();
  attItem = await Zotero.Attachments.linkFromFile(options);
  return attItem;
}

async function attachNewFile(options: {
  libraryID: number;
  parentItemID: number | undefined;
  collections: number[] | undefined;
}) {
  const sourceDir = getPref("sourceDir") as string;
  if (!(await OS.File.exists(sourceDir))) {
    window.alert("The source path is not configured or does not exist.");
    return;
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

function removeFile(file: any) {
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
