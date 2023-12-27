import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { DialogHelper } from "zotero-plugin-toolkit/dist/helpers/dialog";
import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";
import { config } from "../package.json";

class Addon {
  public data: {
    alive: boolean;
    // Env type, see build.js
    env: "development" | "production";
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window;
      // columns: Array<ColumnOptions>;
      // rows: Array<{ [dataKey: string]: string }>;
    };
    dialog?: DialogHelper;
    icons: { [name: string]: string };
    folderSep: string;
    notifierID: string;
  };
  // Lifecycle hooks
  public hooks: typeof hooks;
  // APIs
  public api: object;

  constructor() {
    this.data = {
      alive: true,
      env: __env__,
      ztoolkit: createZToolkit(),
      icons: {
        favicon: `chrome://${config.addonRef}/content/icons/favicon.png`,
        attachNewFile: `chrome://${config.addonRef}/content/icons/attachNewFile.png`,
        renameMoveAttachment: `chrome://${config.addonRef}/content/icons/renameMoveAttachment.png`,
        openUsing: `chrome://${config.addonRef}/content/icons/openUsing.png`,
        renameAttachment: "chrome://zotero/skin/bookmark-pencil.png",
        moveFile: `chrome://${config.addonRef}/content/icons/moveAttachment.png`,
        collection: "chrome://zotero/skin/treesource-collection@2x.png",
      },
      folderSep: Zotero.isWin ? "\\" : "/",
      notifierID: "",
    };
    this.hooks = hooks;
    this.api = {};
  }
}

export default Addon;
