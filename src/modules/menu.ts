/*eslint no-constant-condition: ["error", { "checkLoops": false }]*/
import { getString } from "../utils/locale";
import { config } from "../../package.json";
import { getPref, setPref } from "../utils/prefs";
import { waitUntil, waitUtilAsync } from "../utils/wait";
import comparison from "string-comparison";
import { registerShortcut } from "../utils/shortcut";

const filenameExtRE = /\.[^.]+$/;
const ATTANGER_MENU_ID = "attanger-menu";
const RENAME_MOVE_MENU_ID = "attanger-rename-move-attachment";
const MOVE_MENU_ID = "attanger-move-attachment";
const UNDO_MOVE_MENU_ID = "attanger-undo-move-attachment";

/**
 * 避免因为选中A操作移动，移动过程中点击了B分类
 */
let selectedCollection: Zotero.Collection | undefined
export default class Menu {
  constructor() {
    addon.data.menu = this;
    registerNotify(["item"],
      async (event: _ZoteroTypes.Notifier.Event, type: _ZoteroTypes.Notifier.Type, ids: string[] | number[], extraData: _ZoteroTypes.anyObj) => {
        ztoolkit.log(event, type, extraData);
        if (type == "item" && event == "add") {
          window.setTimeout(async () => {
            const items = Zotero.Items.get(ids as number[]);
            const attItems = [];
            for (const item of items) {
              if (
                item.isAttachment() &&
                (await item.fileExists())
              ) {
                if (item.isImportedAttachment()) {
                  await Zotero.RecognizeDocument.recognizeItems([item]);
                }
                attItems.push(item);
              }
              if (item.isTopLevelItem() && item.isRegularItem()) {
                // 等待是否有新增附件
                await Zotero.Promise.delay(1000);
                for (const id of item.getAttachments()) {
                  const att = Zotero.Items.get(id);
                  if (
                    att.isAttachment() &&
                    (await att.fileExists())
                  ) {
                    attItems.push(att);
                  }
                }
              }
            }
            ztoolkit.log(attItems)
            if (attItems.length > 0) {
              attItems.map(async (att: Zotero.Item) => {
                try {
                  const canProcess = checkFileType(att);
                  const filenameNoExt = canProcess
                    ? await getAttachmentFilenameNoExt(att)
                    : null;
                  if (isFilenameMatched("filenameSkipAutoMoveRenameRules", filenameNoExt)) {
                    showAttachmentItem(att);
                    return;
                  }
                  if (
                    canProcess &&
                    getPref("autoMove") &&
                    getPref("attachType") == "linking"
                  ) {
                    att = (await moveFile(att)) as Zotero.Item;
                  }
                  if (canProcess && Zotero.Prefs.get("autoRenameFiles")) {
                    await renameFile(att);
                  }
                } catch (e) {
                  ztoolkit.log(e);
                }
                showAttachmentItem(att);
              });
            }
          });
        }
      }
    )
    this.init();
    this.register();

  }

  private init() {
    for (const name in addon.data.icons) {
      ztoolkit.ProgressWindow.setIconURI(name, addon.data.icons[name]);
    }
  }

  private getMoveMenuStringKey(moveKey: string, copyKey: string) {
    return getPref("moveWithoutDeleting") ? copyKey : moveKey;
  }

  public refreshItemMenu() {
    for (const win of Zotero.getMainWindows()) {
      win.document.getElementById(RENAME_MOVE_MENU_ID)?.setAttribute(
        "label",
        getString(
          this.getMoveMenuStringKey(
            "rename-move-attachment",
            "rename-copy-attachment",
          ),
        ),
      );
      win.document.getElementById(MOVE_MENU_ID)?.setAttribute(
        "label",
        getString(this.getMoveMenuStringKey("move-attachment", "copy-attachment")),
      );
      win.document.getElementById(UNDO_MOVE_MENU_ID)?.setAttribute(
        "label",
        getString(
          this.getMoveMenuStringKey(
            "undo-move-attachment",
            "undo-copy-attachment",
          ),
        ),
      );
    }
  }

  private register() {
    const attachNewFileCallback = async () => {
      const item = ZoteroPane.getSelectedItems()[0];
      await attachNewFile({
        libraryID: item.libraryID,
        parentItemID: item.id,
        collections: undefined,
      });
    };

    ztoolkit.Menu.register("item", {
      tag: "menu",
      id: ATTANGER_MENU_ID,
      label: "Attanger",
      icon: addon.data.icons.favicon,
      children: [
        // 附加新文件
        {
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
          commandListener: async () => {
            await attachNewFileCallback();
          },
        },
        // 重命名并移动
        {
          tag: "menuitem",
          id: RENAME_MOVE_MENU_ID,
          label: getString(
            this.getMoveMenuStringKey(
              "rename-move-attachment",
              "rename-copy-attachment",
            ),
          ),
          icon: addon.data.icons.renameMoveAttachment,
          commandListener: async (_ev) => {
            selectedCollection = ZoteroPane.getSelectedCollection()
            const attachmentItems = getAttachmentItems(false);
            if (!attachmentItems.length) {
              showMoveMessage("No attachment selected.");
              return;
            }
            for (const item of attachmentItems) {
              try {
                const movedItem = await moveFile(item) as Zotero.Item;
                if (!movedItem) {
                  showMoveMessage(
                    `Move skipped or failed: ${item.getDisplayTitle()}`,
                  );
                  continue;
                }
                const renamedItem = await renameFile(movedItem);
                showAttachmentItem(renamedItem || movedItem);
              } catch (e) {
                ztoolkit.log(e);
                showMoveMessage(`Move error: ${(e as Error).message || e}`);
              }
            }
          },
        },
        {tag: "menuseparator"},
        // 匹配附件
        {
          tag: "menuitem",
          label: getString("match-attachment"),
          icon: addon.data.icons.matchAttachment,
          getVisibility: () => {
            const items = ZoteroPane.getSelectedItems();
            return items.some((i) => i.isTopLevelItem() && i.isRegularItem());
          },
          commandListener: async (_ev) => {
            await matchAttachment();
          },
        },
        // 精确匹配附件(匹配插件自己生成的附件)
        {
          tag: "menuitem",
          label: getString("match-attanger-attachment"),
          icon: addon.data.icons.matchAttachment,
          getVisibility: () => {
            const items = ZoteroPane.getSelectedItems();
            return items.some((i) => i.isTopLevelItem() && i.isRegularItem());
          },
          commandListener: async (_ev) => {
            await matchAttangerAttachment();
          },
        },
        { tag: "menuseparator" },
        {
          tag: "menuitem",
          label: getString("rename-attachment"),
          icon: addon.data.icons.renameAttachment,
          commandListener: async (_ev) => {
            const attachmentItems = getAttachmentItems();
            if (!attachmentItems.length) {
              showRenameMessage(
                "No child attachment selected. Select a regular item or a child attachment with a parent item.",
              );
              return;
            }
            for (const item of attachmentItems) {
              try {
                const attItem = await renameFile(item);
                if (attItem) {
                  showAttachmentItem(attItem);
                } else {
                  showRenameMessage(
                    `Rename skipped or failed: ${item.getDisplayTitle()}`,
                  );
                }
              } catch (e) {
                ztoolkit.log(e);
                showRenameMessage(`Rename error: ${(e as Error).message || e}`);
              }
            }
          },
        },
        {
          tag: "menuitem",
          id: MOVE_MENU_ID,
          label: getString(
            this.getMoveMenuStringKey("move-attachment", "copy-attachment"),
          ),
          icon: addon.data.icons.moveFile,
          commandListener: async (_ev) => {
            selectedCollection = ZoteroPane.getSelectedCollection()
            for (const item of getAttachmentItems(false)) {
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
          id: UNDO_MOVE_MENU_ID,
          label: getString(
            this.getMoveMenuStringKey(
              "undo-move-attachment",
              "undo-copy-attachment",
            ),
          ),
          icon: addon.data.icons.undoMoveFile,
          commandListener: async () => {
            await ZoteroPane.convertLinkedFilesToStoredFiles();
          },
        },

      ]
    })
    // 分隔符
    // ztoolkit.Menu.register("item", {
    //   tag: "menuseparator",
    //   getVisibility: () => {
    //     const items = ZoteroPane.getSelectedItems();
    //     return items.some((i) => i.isTopLevelItem() || i.isAttachment());
    //   },
    // });
    // 匹配附件
    // ztoolkit.Menu.register("item", {
    //   tag: "menuitem",
    //   label: getString("match-attachment"),
    //   icon: addon.data.icons.matchAttachment,
    //   getVisibility: () => {
    //     const items = ZoteroPane.getSelectedItems();
    //     return items.some((i) => i.isTopLevelItem() && i.isRegularItem());
    //   },
    //   commandListener: async (_ev) => {
    //     await matchAttachment();
    //   },
    // });
    registerShortcut("matchAttachment.shortcut", async () => {
      await matchAttachment();
    });
    // 精确匹配附件(匹配插件自己生成的附件)
    // ztoolkit.Menu.register("item", {
    //   tag: "menuitem",
    //   label: getString("match-attanger-attachment"),
    //   icon: addon.data.icons.matchAttachment,
    //   getVisibility: () => {
    //     const items = ZoteroPane.getSelectedItems();
    //     return items.some((i) => i.isTopLevelItem() && i.isRegularItem());
    //   },
    //   commandListener: async (_ev) => {
    //     await matchAttangerAttachment();
    //   },
    // });
    // ztoolkit.Menu.register("item", {
    //   tag: "menuitem",
    //   label: getString("attach-new-file"),
    //   icon: addon.data.icons.attachNewFile,
    //   getVisibility: () => {
    //     // 只选择一个父级条目
    //     const items = ZoteroPane.getSelectedItems();
    //     return (
    //       items.length == 1 &&
    //       items[0].isTopLevelItem() &&
    //       items[0].isRegularItem()
    //     );
    //   },
    //   commandListener: async () => {
    //     await attachNewFileCallback();
    //   },
    // });
    registerShortcut("attachNewFile.shortcut", async () => {
      await attachNewFileCallback();
    });
    // 分类
    ztoolkit.Menu.register("collection", {
      tag: "menuitem",
      label: getString("attach-new-file"),
      icon: addon.data.icons.attachNewFile,
      getVisibility: () => {
        return ZoteroPane.getCollectionTreeRow()?.isCollection();
      },
      commandListener: async (_ev) => {
        const collection = ZoteroPane.getSelectedCollection() as Zotero.Collection;
        await attachNewFile({
          libraryID: collection.libraryID,
          parentItemID: undefined,
          collections: [collection.id],
        });
      },
    });
    this.refreshItemMenu();
    // 附件管理
    // ztoolkit.Menu.register("item", {
    //   tag: "menu",
    //   getVisibility: () => {
    //     return getAttachmentItems(false).length > 0;
    //   },
    //   label: getString("attachment-manager"),
    //   icon: addon.data.icons.favicon,
    //   children: [
    //     {
    //       tag: "menuitem",
    //       label: getString("rename-move-attachment"),
    //       icon: addon.data.icons.renameMoveAttachment,
    //       commandListener: async (_ev) => {
    //         for (const item of getAttachmentItems(false)) {
    //           try {
    //             const attItem = (await renameFile(item)) as Zotero.Item;
    //             attItem && (await moveFile(attItem));
    //             attItem && showAttachmentItem(attItem);
    //           } catch (e) {
    //             ztoolkit.log(e);
    //           }
    //         }
    //       },
    //     },
    //     { tag: "menuseparator" },
    //     {
    //       tag: "menuitem",
    //       label: getString("rename-attachment"),
    //       icon: addon.data.icons.renameAttachment,
    //       commandListener: async (_ev) => {
    //         for (const item of getAttachmentItems()) {
    //           try {
    //             const attItem = await renameFile(item);
    //             attItem && showAttachmentItem(attItem);
    //           } catch (e) {
    //             ztoolkit.log(e);
    //           }
    //         }
    //       },
    //     },
    //     {
    //       tag: "menuitem",
    //       label: getString("move-attachment"),
    //       icon: addon.data.icons.moveFile,
    //       commandListener: async (_ev) => {
    //         for (const item of getAttachmentItems(false)) {
    //           try {
    //             const attItem = await moveFile(item);
    //             attItem && showAttachmentItem(attItem);
    //           } catch (e) {
    //             ztoolkit.log(e);
    //           }
    //         }
    //       },
    //     },


    //     {
    //       tag: "menuitem",
    //       label: getString("undo-move-attachment"),
    //       icon: addon.data.icons.undoMoveFile,
    //       commandListener: async () => {
    //         await ZoteroPane.convertLinkedFilesToStoredFiles();
    //       },
    //     },
    //   ],
    // });
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
      children: [
        {
          tag: "menuitem",
          label: "Zotero",
          commandListener: async (_ev) => {
            // 第二个参数应该从文件分析得出，默认pdf
            openUsing("", "pdf");
          },
        },
        {
          tag: "menuitem",
          label: "System",
          commandListener: async (_ev) => {
            openUsing("system", "pdf");
          },
        },
        ...fileHandlerArr.map((fileHandler: string) =>{
          return (
            {
              tag: "menuitem",
              label: fileHandler.split(/(?:\\|\/)/).slice(-1)[0],

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
            }
          )
        }),
        // ...((() => {
        //   const children = [];
        //   for (const fileHandler of fileHandlerArr) {
        //     children.push({
        //       tag: "menuitem",
        //       label: PathUtils.filename(fileHandler),
        //       commandListener: async (ev: MouseEvent) => {
        //         if (ev.button == 2) {
        //           if (window.confirm("Delete?")) {
        //             const _fileHandlerArr = fileHandlerArr.filter(
        //               (i: string) => i != fileHandler,
        //             ) as string[];
        //             setPref(_fileHandlerArr);
        //           }
        //         } else {
        //           openUsing(fileHandler, "pdf");
        //         }
        //       },
        //     });
        //   }
        //   return children;
        // })() as any),
        {
          tag: "menuitem",
          label: getString("choose-other-app"),
          commandListener: async (_ev) => {
            // @ts-ignore window
            const fp = new window.FilePicker();
            fp.init(window, "Select Destination Directory", fp.modeOpen);
            fp.appendFilters(fp.filterApps);
            if ((await fp.show()) != fp.returnOK) {
              return false;
            }
            const filename = PathUtils.normalize(fp.file);
            // #42 Multiple extensions may be included, separated by a semicolon and a space.
            // const filename = await new ztoolkit.FilePicker(
            //   "Select Application",
            //   "open",
            //   [["Application", "*.exe; *.app"]], // support windows .exe and macOS .app both.
            // ).open();
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
      item
        .getAttachments()
        .map((id) => Zotero.Items.get(id))
        .filter((item) => item.isAttachment())
        .forEach((item) => attachmentItems.push(item));
    }
  }

  return attachmentItems;
}

async function matchAttachment() {
  const items = ZoteroPane.getSelectedItems()
    .filter((i) => i.isTopLevelItem() && i.isRegularItem())
    .sort((a, b) => getPlainTitle(a).length - getPlainTitle(b).length);
  ztoolkit.log(
    "item titles: ",
    items.map((i) => i.getDisplayTitle()),
  );
  const sourceDir = await checkDir("sourceDir", "source path");
  if (!sourceDir) return;
  let files: OS.File.Entry[] = [];
  /* TODO: migrate to IOUtils */
  await Zotero.File.iterateDirectory(
    sourceDir,
    async function (child: OS.File.Entry) {
      if (!child.isDir && /\.(caj|pdf)$/i.test(child.name)) {
        files.push(child);
      }
    },
  );
  ztoolkit.log(
    "found pdf files:",
    files.map((f) => f.path),
  );
  const readPDFTitle = getPref("readPDFtitle") as string;
  ztoolkit.log("read PDF title: ", readPDFTitle);
  for (const item of items) {
    const itemtitle = getPlainTitle(item);
    ztoolkit.log("processing item: ", itemtitle);
    let iniDistance = Infinity;
    let matchedFile: OS.File.Entry | undefined = undefined;
    for (const file of files) {
      let filename = file.name.replace(/\..+?$/, "");

      /* 尝试从PDF元数据或文本中读取标题 */
      try {
        if (!/pdf/i.test(Zotero.File.getExtension(file.path))) {
          throw new Error("This is not a PDF file.");
        }
        ztoolkit.log("check file:", file.name + ": ");
        const data: any = await getPDFData(file.path);
        const lines: Array<any> = [];
        data.pages.forEach((page: Array<any>) => {
          page[page.length - 1][0][0][0][4].forEach(
            (line: Array<Array<Array<any>>>) => {
              const lineObj = { fontSize: 0, text: "" };
              line[0].forEach((word) => {
                lineObj.fontSize += word[4];
                lineObj.text +=
                  word[word.length - 1] + (word[5] > 0 ? " " : "");
              });
              lineObj.fontSize /= line[0].length;
              // ztoolkit.log(lineObj);
              lines.push(lineObj);
            },
          );
        });
        const optTitle =
          data?.metadata?.title ||
          data?.metadata?.Title ||
          lines
            .reduce(
              (max, cur) => {
                if (cur.fontSize > max.fontSize) {
                  return cur;
                } else if (cur.fontSize == max.fontSize) {
                  max.text += ` ${cur.text}`;
                }
                return max;
              },
              { fontSize: -Infinity, text: "" },
            )
            .text.replace(/\s?([\u4e00-\u9fff])\s?/g, "$1");
        ztoolkit.log("optical title: ", optTitle);
        if (
          readPDFTitle != "Never" &&
          optTitle &&
          (!/[\u4e00-\u9fff]/.test(itemtitle) || readPDFTitle == "Always")
        ) {
          filename = cleanLigature(optTitle);
        }
      } catch (e: any) {
        ztoolkit.log(e);
      }
      ztoolkit.log("filename:", filename);
      const distance = comparison.metricLcs.distance(
        itemtitle.toLowerCase(),
        filename.toLowerCase(),
      );
      ztoolkit.log(`【${itemtitle}】 × 【${filename}】 => ${distance}`);
      if (distance <= iniDistance) {
        iniDistance = distance;
        matchedFile = file;
      }
    }
    if (matchedFile) {
      ztoolkit.log("==>", itemtitle, matchedFile.path, iniDistance);
      const attItem = await Zotero.Attachments.importFromFile({
        file: matchedFile.path,
        libraryID: item.libraryID,
        parentItemID: item.id,
      });
      showAttachmentItem(attItem);
      if (!attItem.parentItemID) {
        Zotero.RecognizeDocument.recognizeItems([attItem]);
      }
      removeFile(matchedFile.path);
      files = files.filter((file) => file !== matchedFile);
    }
  }
}

async function matchAttangerAttachment() {
  const sourceDir = await checkDir("sourceDir", "source path");
  if (!sourceDir) {
    ztoolkit.log("source dir is empty, exit");
    return
  }
  const fileTypes = getPref("fileTypes") as string;
  const fileTypeList = fileTypes.split(",")
  // ztoolkit.log('match attanger attachments for these file types: ', fileTypeList);

  const items = ZoteroPane.getSelectedItems()
    .filter((i) => i.isTopLevelItem() && i.isRegularItem())
    .sort((a, b) => getPlainTitle(a).length - getPlainTitle(b).length);

  for (const item of items) {
    // 使用 getCollectionPathsOfItem 获取条目所在的分类路径
    // let collectionPath = getCollectionPathsOfItem(item);
    // if (collectionPath === undefined) collectionPath = ''

    const existAttachments = item
      .getAttachments()
      .map((id) => Zotero.Items.get(id))
      .filter((item) => item.isAttachment())
      .map((item) => item.getField('title'))

    const subfolder = getSubfolderPath(item)

    const realRoot = PathUtils.joinRelative(sourceDir, subfolder); // 拼接出实际文件目录路径
    const attachmentBaseName = Zotero.Attachments.getFileBaseNameFromItem(item);

    ztoolkit.log('item: ', item.getDisplayTitle());
    ztoolkit.log('|  realRoot:', realRoot);
    ztoolkit.log('|  exist attachments:', existAttachments);

    for (const ext of fileTypeList) {
      const fullpath = PathUtils.joinRelative(realRoot, `${attachmentBaseName}.${ext}`)
      const file = Zotero.File.pathToFile(fullpath);
      const basename = file.leafName
      // Check if the file exists before attempting to import
      if (file.exists()) {
        if (!existAttachments.includes(basename)) {
          try {
            const attItem = await Zotero.Attachments.importFromFile({
              file: fullpath,
              libraryID: item.libraryID,
              parentItemID: item.id,
            });
            showAttachmentItem(attItem);
            ztoolkit.log('|  Imported attachment:', attItem.getDisplayTitle());
          } catch (error) {
            ztoolkit.log('|  Error importing attachment:', error);
          }
        } else {
          ztoolkit.log('|  skip exists:', basename);
        }
      }
    }
  }
}

async function openUsing(fileHandler: string, fileType = "pdf") {
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
  const _fileHandler = Zotero.Prefs.get(`fileHandler.${fileType}`) as string;
  Zotero.Prefs.set(`fileHandler.${fileType}`, fileHandler);
  try {
    await ZoteroPane.viewAttachment(ids);
  } catch {
    ztoolkit.log("error when ZoteroPane.viewAttachment(ids)");
  }

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

function getRuleList(prefName: string) {
  return (getPref(prefName) as string || "").split(/,\s*/).filter(Boolean);
}

function isFilenameMatched(prefName: string, filenameNoExt: string | null) {
  if (!filenameNoExt) return false;
  const rules = getRuleList(prefName);
  if (rules.length === 0) return false;
  return rules.some((rule: string) => (new RegExp(rule)).test(filenameNoExt));
}

async function getAttachmentFilenameNoExt(attItem: Zotero.Item) {
  const file = (await attItem.getFilePathAsync()) as string;
  if (!file) return null;
  const origFilename = PathUtils.split(file).pop() as string;
  return origFilename.replace(filenameExtRE, "");
}

async function renameAttachmentFile(attItem: Zotero.Item, newName: string) {
  const renameAttachment = attItem.renameAttachmentFile as any;
  if (renameAttachment.length <= 1) {
    return await renameAttachment.call(attItem, newName, {
      overwrite: false,
      unique: true,
      updateTitle: false,
      out: {},
    });
  }
  return await renameAttachment.call(attItem, newName, false, true);
}

/**
 * 重命名文件，但不重命名Zotero内显示的名称 - 来自Zotero官方代码
 * @param item
 * @returns
 */
async function renameFile(attItem: Zotero.Item, retry = 0) {
  const file = (await attItem.getFilePathAsync()) as string;
  if (!file) {
    ztoolkit.log("renameFile skipped: attachment file not found", attItem);
    return;
  }
  const origFilename = PathUtils.split(file).pop() as string;
  if (!checkFileType(attItem, origFilename)) {
    ztoolkit.log("renameFile skipped: unsupported file type", origFilename);
    return;
  }
  const parentItemID = attItem.parentItemID as number;
  // 无父元素不进行重命名
  if (!parentItemID) {
    ztoolkit.log("renameFile skipped: attachment has no parent item", attItem);
    return attItem
  }
  const parentItem = await Zotero.Items.getAsync(parentItemID);
  // getFileBaseNameFromItem
  let newName = Zotero.Attachments.getFileBaseNameFromItem(parentItem, {
    attachmentTitle: attItem.getField("title") as string,
  } as any);

  const ext = origFilename.match(filenameExtRE);
  if (ext) {
    newName = newName + ext[0];
  }
  // fix https://github.com/MuiseDestiny/zotero-attanger/issues/263
  const origFilenameNoExt = origFilename.replace(filenameExtRE, "");
  if (isFilenameMatched("filenameSkipRenameRules", origFilenameNoExt)) {
    return attItem;
  }
  if (isFilenameMatched("filenameAsPrefixRules", origFilenameNoExt)) {
    newName = origFilenameNoExt + "_" + newName;
  }
  ztoolkit.log({ newName })
  const renamed = await renameAttachmentFile(attItem, newName);
  if (renamed !== true) {
    ztoolkit.log("renamed = " + renamed, "newName", newName);
    await Zotero.Promise.delay(3e3);
    if (retry < 5) {
      return await renameFile(attItem, retry + 1);
    }
    return;
  }
  const origTitle = attItem.getField("title") as string;
  if (shouldSyncAttachmentTitle(attItem, origTitle, origFilename, origFilenameNoExt)) {
    const renamedFile = (await attItem.getFilePathAsync()) as string;
    const actualFilename = renamedFile
      ? PathUtils.split(renamedFile).pop() as string
      : newName;
    ztoolkit.log("renameFile sync attachment title", { origTitle, actualFilename });
    attItem.setField("title", actualFilename);
  }
  await attItem.saveTx();
  return attItem;
}

function shouldSyncAttachmentTitle(
  attItem: Zotero.Item,
  title: string,
  filename: string,
  filenameNoExt: string,
) {
  if (title === filename || title === filenameNoExt) {
    return true;
  }
  return title === "PDF" && attItem.attachmentContentType === "application/pdf";
}

/**
 * 得到附件的中间路径(对于subfolderFormat进行格式化)
 * @param item Item
 */
export function getSubfolderPath(item: Zotero.Item) {
  let subfolder = "";
  const subfolderFormat = getPref("subfolderFormat") as string;
  if (subfolderFormat.length > 0) {
    // Zotero.Attachments.getFileBaseNameFromItem 补充不支持的变量
    // 3. 得到最终路径
    // @ts-ignore 未添加属性
    const _getValidFileName = Zotero.File.getValidFileName;
    // @ts-ignore 未添加属性
    Zotero.File.getValidFileName = (fileName) =>
      // @ts-ignore no-useless-escape
      fileName.replace(/[?\*:|"<>]/g, "");

    subfolder = subfolderFormat
      .split(/(?<=\}\})\/(?=\{\{)/)
      .map((formatString: string) => {
        // ztoolkit.log(formatString);
        if (formatString == "{{collection}}") {
          return getCollectionPathsOfItem(item);
        } else {
          return getValidFolderName(
            Zotero.Attachments.getFileBaseNameFromItem(
              item,
              {formatString} as any,
            ),
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
  }
  return subfolder
}


/**
 * 移动文件
 * @param item Attachment Item
 */
export async function moveFile(attItem: any) {
  const attachType = getPref("attachType")
  if (attachType != "linking") {
    ztoolkit.log("moveFile skipped: attach type is not linking", attachType);
    return;
  }
  let destDir = await checkDir("destDir", "destination directory");
  // 1. 目标根路径
  if (!destDir) return;
  // 2. 中间路径 (计算过程放入函数getSubfolderPath，其被多次复用)
  const subfolder = getSubfolderPath(attItem.topLevelItem);

  if (subfolder.length > 0) {
    destDir = PathUtils.joinRelative(destDir, subfolder);
  }
  const sourcePath = (await attItem.getFilePathAsync()) as string;
  if (!sourcePath) return;
  const filename = PathUtils.filename(sourcePath);
  if (!checkFileType(attItem, filename)) {
    ztoolkit.log("moveFile skipped: unsupported file type", filename);
    return;
  }
  let destPath = PathUtils.joinRelative(destDir, filename);
  if (sourcePath == destPath) {
    ztoolkit.log("moveFile skipped: source already at destination", sourcePath);
    return attItem;
  }
  if (await pathExists(destPath)) {
    ztoolkit.log("目标目录存在", file2md5(sourcePath), file2md5(destPath));
    if (file2md5(sourcePath) != file2md5(destPath)) {
      ztoolkit.log("不是同一个文件");
      // await Zotero.Promise.delay(1000);
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
    } else {
      ztoolkit.log("是同一个文件");
      new ztoolkit.ProgressWindow("Attanger", {
        closeTime: 3000,
        closeOtherProgressWindows: true,
      })
        .createLine({
          text: "The target file already exists",
          icon: addon.data.icons.moveFile,
        })
        .show();
    }
  }
  // 创建中间路径
  if (!(await createDirectoryPath(destDir))) {
    return;
  }
  // await Zotero.File.createDirectoryIfMissingAsync(destDir);
  // 移动文件到目标文件夹
  try {
    await movePath(sourcePath, destPath);
  } catch (e) {
    ztoolkit.log(e);
    return await moveFile(attItem);
  }
  const json = attItem.toJSON();
  json.linkMode = "linked_file";
  json.path = destPath;
  delete json.filename;
  const newAttItem = new Zotero.Item("attachment" as any);
  newAttItem.libraryID = attItem.libraryID;
  newAttItem.fromJSON(json);
  await newAttItem.saveTx();
  window.setTimeout(async () => {
    // 迁移标注
    await transferItem(attItem, newAttItem);
    removeEmptyFolder(PathUtils.parent(sourcePath) as string);
    await attItem.eraseTx();
  });
  return newAttItem;
}

async function attachNewFile(options: {
  libraryID: number;
  parentItemID: number | undefined;
  collections: number[] | undefined;
}) {
  const sourceDir = await checkDir("sourceDir", "source path");
  if (!sourceDir) return;
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
      Zotero.RecognizeDocument.recognizeItems([attItem]);
    }
    removeFile(path);
  }
}

function removeFile(file: any) {
  // 勾选“移动但不删除原文件”时，保留源文件，不做任何删除
  if (getPref("moveWithoutDeleting")) {
    return;
  }
  if (ZoteroPane.getSelectedLibraryID() != 1) {
    return;
  }
  file = Zotero.File.pathToFile(file);
  if (!file.exists()) return;
  try {
    ztoolkit.log("remove file", file.path)
    // remove file
    if (!file.isDirectory()) {
      ztoolkit.log("removeFile", file.path)
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

function file2md5(filepath: string) {
  return Zotero.Utilities.Internal.md5(Zotero.File.pathToFile(filepath));
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
    return (
      getCollectionPath(collection.parentID) +
      addon.data.folderSep +
      collection.name
    );
  };
  const itemCollections = item.getCollections().map(getCollectionPath)
  if (selectedCollection) {
    const preferredCollection = [selectedCollection.id].map(getCollectionPath)[0] as string
    ztoolkit.log({ preferredCollection, itemCollections })
    const isExist = itemCollections.find(i => i == preferredCollection)
    if (isExist) {
      return preferredCollection
    }
    return itemCollections[0] || "";
  } else {
    ztoolkit.log({ itemCollections })
    return itemCollections[0] || "";
  }
  // fix https://github.com/MuiseDestiny/zotero-attanger/issues/264
  // if (selectedCollection) {
  //   return [selectedCollection.id].map(getCollectionPath)[0];
  // } else {
  //   return item.getCollections().map(getCollectionPath).slice(0, 1)[0];
  // }
}

/**
 * 从文件名中删除非法字符
 * Modified from Zotero.File.getValidFileName
 * @param folderName
 * @returns
 */
function getValidFolderName(folderName: string): string {
  // Replace illegal folder name characters
  if (getPref("slashAsSubfolderDelimiter")) {
    folderName = folderName.replace(/[\\:*?"<>|]/g, "");
  } else {
    // eslint-disable-next-line no-useless-escape
    folderName = folderName.replace(/[\/\\:*?"<>|]/g, "");
  }
  // Replace newlines and tabs (which shouldn't be in the string in the first place) with spaces
  folderName = folderName.replace(/[\r\n\t]+/g, " ");
  // Replace various thin spaces
  folderName = folderName.replace(/[\u2000-\u200A]/g, " ");
  // Replace zero-width spaces
  folderName = folderName.replace(/[\u200B-\u200E]/g, "");
  // Strip characters not valid in XML, since they won't sync and they're probably unwanted
  // eslint-disable-next-line no-control-regex
  folderName = folderName.replace(
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g,
    "",
  );
  // Normalize to NFC
  folderName = folderName.normalize();
  // Replace bidi isolation control characters
  folderName = folderName.replace(/[\u2068\u2069]/g, "");
  // Don't allow hidden files
  folderName = folderName.replace(/^\./, "");
  // Don't allow blank or illegal names
  if (!folderName || folderName == "." || folderName == "..") {
    folderName = "_";
  }
  return folderName;
}

function checkFileType(attItem: Zotero.Item, filename?: string) {
  if (!attItem) return false 
  const fileTypes = getPref("fileTypes") as string;
  if (!fileTypes) return true;
  const attachmentFilename = filename || attItem.attachmentFilename || "";
  const pos = attachmentFilename.lastIndexOf("."),
    fileType =
      pos == -1
        ? ""
        : attachmentFilename.substring(pos + 1).toLowerCase(),
    regex = fileTypes.toLowerCase().replace(/,/gi, "|");
  // return value
  return fileType.search(new RegExp(regex)) >= 0 ? true : false;
}

function showRenameMessage(text: string) {
  new ztoolkit.ProgressWindow("Attanger", {
    closeTime: 5000,
    closeOtherProgressWindows: true,
  })
    .createLine({
      text,
      icon: addon.data.icons.renameAttachment,
    })
    .show();
}

function showMoveMessage(text: string) {
  new ztoolkit.ProgressWindow("Attanger", {
    closeTime: 5000,
    closeOtherProgressWindows: true,
  })
    .createLine({
      text,
      icon: addon.data.icons.renameMoveAttachment,
    })
    .show();
}

/**
 * 向popupWin添加附件行
 * @param attItem
 * @param type
 */
function showAttachmentItem(attItem: Zotero.Item) {
  ztoolkit.log("showAttachmentItem", attItem)
  if (!attItem) { return }
  const popupWin = new ztoolkit.ProgressWindow("Attanger", {
    closeTime: -1,
    closeOtherProgressWindows: true,
  });
  // 显示父行
  if (attItem && attItem.isTopLevelItem()) {
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
    icon: attItem.getImageSrc().replace("pdflink", "pdf-link"),
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
 * @param  {String|nsIFile} path Folder as nsIFile.
 * @return {void}
 */
async function removeEmptyFolder(path: string | nsIFile) {
  if (!getPref("autoRemoveEmptyFolder") as boolean) {
    return false;
  }
  if (!path as boolean) {
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
  rootFolders = rootFolders.map((path) => PathUtils.normalize(path));
  // 不属于插件相关根目录，不处理
  if (!rootFolders.find((dir) => folder.path.startsWith(dir))) {
    return false;
  }
  const files = folder.directoryEntries;
  let fileCount = 0;
  while (files.hasMoreElements()) {
    const f = files.getNext().QueryInterface(Components.interfaces.nsIFile);
    fileCount++;
    if (f.leafName !== ".DS_Store" && f.leafName !== "Thumbs.db") {
      return true;
    } else if (fileCount > 1) {
      break;
    }
  }
  ztoolkit.log("Remove empty folder: ", folder.path);
  removeFile(folder);
  return await removeEmptyFolder(PathUtils.parent(folder.path) as string);
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
    if (await pathExists(destPath)) {
      incr++;
    } else {
      return destPath;
    }
  }
}

async function checkDir(prefName: string, prefDisplay: string) {
  let dir = getPref(prefName);
  if (typeof dir !== "string" || !(await pathExists(dir, "directory"))) {
    // @ts-ignore window
    const fp = new window.FilePicker();

    fp.init(window, `Select ${prefDisplay}`, fp.modeGetFolder);
    fp.appendFilters(fp.filterAll);
    if ((await fp.show()) != fp.returnOK) {
      return false;
    }
    dir = PathUtils.normalize(fp.file);

    if (typeof dir === "string") {
      setPref(prefName, dir);
      return dir;
    } else {
      new ztoolkit.ProgressWindow(config.addonName)
        .createLine({ text: "No valid path set", type: "default" })
        .show();
      return false;
    }
  }
  return dir;
}

type PathKind = "file" | "directory";

async function pathExists(path: string, kind?: PathKind) {
  try {
    if (await IOUtils.exists(path)) {
      if (!kind) {
        return true;
      }
      return pathMatchesKind(path, kind);
    }
  } catch (e) {
    ztoolkit.log("IOUtils.exists failed", path, e);
  }

  try {
    const file = Zotero.File.pathToFile(path) as any;
    const exists = file.exists();
    const isDirectory = getNsIFileKind(file, "directory");
    const isFile = getNsIFileKind(file, "file");
    if (!kind) {
      return exists || isDirectory || isFile;
    }
    // Some Windows mount-point roots report exists() as false while
    // isDirectory() still correctly identifies the target as a directory.
    return kind === "directory" ? isDirectory : isFile;
  } catch (e) {
    ztoolkit.log("nsIFile exists fallback failed", path, e);
    return false;
  }
}

function pathMatchesKind(path: string, kind: PathKind) {
  try {
    const file = Zotero.File.pathToFile(path) as any;
    return kind === "directory" ? file.isDirectory() : file.isFile();
  } catch (e) {
    ztoolkit.log("nsIFile type check failed", path, e);
    return false;
  }
}

async function movePath(sourcePath: string, destPath: string) {
  const moveWithoutDeleting = getPref("moveWithoutDeleting") as boolean;
  // 先复制：跨盘 / 跨文件系统安全，同时保留 Windows 兼容性修复
  try {
    await IOUtils.copy(sourcePath, destPath);
  } catch (e) {
    ztoolkit.log("IOUtils.copy failed; retrying with nsIFile.copyTo", e);
    const sourceFile = Zotero.File.pathToFile(sourcePath) as any;
    const destFile = Zotero.File.pathToFile(destPath) as any;
    sourceFile.copyTo(destFile.parent, destFile.leafName);
  }
  // 默认语义是“移动”：复制成功后删除原文件；勾选“移动但不删除”时则保留（即复制）
  if (moveWithoutDeleting) {
    return;
  }
  // 删源前确认目标已写入，避免误删
  if (!(await pathExists(destPath, "file"))) {
    ztoolkit.log("movePath: dest missing after copy, keep source", destPath);
    return;
  }
  try {
    await IOUtils.remove(sourcePath);
  } catch (e) {
    ztoolkit.log("IOUtils.remove failed; retrying with nsIFile.remove", e);
    const sourceFile = Zotero.File.pathToFile(sourcePath) as any;
    sourceFile.remove(false);
  }
}

function getNsIFileKind(file: any, kind: PathKind) {
  try {
    return kind === "directory" ? file.isDirectory() : file.isFile();
  } catch {
    return false;
  }
}

async function createDirectoryPath(destDir: string) {
  if (await pathExists(destDir, "directory")) {
    return true;
  }

  const create: string[] = [];
  let current: string | null = destDir;
  while (current && !(await pathExists(current, "directory"))) {
    if (await pathExists(current, "file")) {
      showPathConflict(current);
      return false;
    }
    create.push(current);
    current = PathUtils.parent(current) as string | null;
  }

  await Promise.all(
    create
      .reverse()
      .map(async (f) => await Zotero.File.createDirectoryIfMissingAsync(f)),
  );
  return true;
}

function showPathConflict(path: string) {
  ztoolkit.log("Cannot create directory because a file already exists", path);
  new ztoolkit.ProgressWindow(config.addonName)
    .createLine({
      text: `Cannot create directory because a file already exists: ${path}`,
      type: "default",
    })
    .show();
}

/**
 * 清除文件名中的格式标记，返回纯文本的标题。
 * 虽然通常用于与文件名进行比较，但并不调用Zotero.File.getValidFileName进行规范化。
 */
function getPlainTitle(item: Zotero.Item) {
  return item
    .getDisplayTitle()
    .replace(/<(?:i|b|sub|sub)>(.+?)<\/(?:i|b|sub|sub)>/g, "$1");
}

function cleanLigature(filename: string) {
  let result = filename;
  interface StringMap {
    [key: string]: string;
  }
  const ligature: StringMap = {
    æ: "ae",
    Æ: "AE",
    œ: "oe",
    Œ: "OE",
    ﬀ: "ff",
    ﬁ: "fi",
    ﬂ: "fl",
    ﬃ: "ffi",
    ﬄ: "ffl",
  };
  Object.keys(ligature).forEach((key) => {
    result = result.replace(new RegExp(key, "g"), ligature[key]);
  });
  return result;
}

/**
 * 对Zotero.PDFWorker.getRecognizerData的重写，以便支持直接给出路径。
 */
async function getPDFData(path: string) {
  return Zotero.PDFWorker._enqueue(async () => {
    const buf = new Uint8Array(await IOUtils.read(path)).buffer;
    let result = {};
    try {
      result = await Zotero.PDFWorker._query("getRecognizerData", { buf }, [
        buf,
      ]);
    } catch (e: any) {
      const error = new Error(
        `Worker 'getRecognizerData' failed: ${JSON.stringify({
          error: e.message,
        })}`,
      );
      try {
        error.name = JSON.parse(e.message).name;
      } catch (e: any) {
        ztoolkit.log(e);
      }
      ztoolkit.log(error);
      throw error;
    }

    ztoolkit.log(`Extracted PDF recognizer data for path ${path}`);

    return result;
  }, false);
}

function unregisterNotify(notifyID: string) {
  Zotero.Notifier.unregisterObserver(notifyID);
}

export function registerNotify(types: _ZoteroTypes.Notifier.Type[], onNotify: (...data: Parameters<_ZoteroTypes.Notifier.Notify>) => Promise<void>) {
  const callback = {
    notify: async (...data: Parameters<_ZoteroTypes.Notifier.Notify>) => {
      if (!addon?.data.alive) {
        unregisterNotify(notifyID);
        return;
      }
      onNotify(...data);
    },
  };

  const notifyID = Zotero.Notifier.registerObserver(callback, types);

  window.addEventListener(
    "unload",
    (e: Event) => {
      unregisterNotify(notifyID);
    },
    false,
  );
}
