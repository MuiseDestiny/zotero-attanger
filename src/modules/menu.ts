/*eslint no-constant-condition: ["error", { "checkLoops": false }]*/
import { getString } from "../utils/locale";
import { config } from "../../package.json";
import { getPref, setPref } from "../utils/prefs";
import { waitUntil } from "../utils/wait";
import {
  registerShortcut,
  isShortcutEnabled,
  getShortcutText,
} from "../utils/shortcut";
import {
  getWorkMode,
  shouldMirrorAttachments,
  shouldMoveNewAttachments,
} from "../utils/workMode";
import {
  AttachmentOperationCancelled,
  copyAttachmentFile,
  type FileFingerprint,
  fingerprintMatches,
  hasAttachmentFileReferences,
  isZoteroStoragePath,
  matchingFileContent,
  normalizeAttachmentPath,
  removeVerifiedAttachmentFile,
  runAttachmentOperation,
  sameFiles,
} from "./attachmentFiles";
import {
  createAttachmentFingerprintCache,
  createPDFIdentityCache,
  findDuplicatePDFAttachment,
  fingerprintForMatching,
  MAX_PDF_VISUAL_PAGES,
  samePDFContent,
} from "./attachmentDuplicates";
import {
  ATTACHMENT_MATCH_AMBIGUITY_MARGIN,
  getPDFDocumentRole,
  getPDFPrimaryDOIs,
  getPDFTitleCandidates,
  MIN_ATTACHMENT_MATCH_SCORE,
  normalizeDOI,
  scoreAttachmentMatch,
} from "./attachmentMatching";
import { getExternalCopy, syncExternalCopy } from "./externalCopies";
import { getConfiguredSourceDirs } from "../utils/sourceDirs";
import { convertStoredAttachmentToLinked } from "./attachmentConversions";
import {
  registerContextMenu,
  usesOfficialContextMenus,
  type ContextMenuHandle,
} from "../utils/contextMenu";
import type { MenuitemOptions } from "zotero-plugin-toolkit";

const filenameExtRE = /\.[^.]+$/;
const ATTANGER_MENU_ID = "attanger-menu";
const ATTACH_NEW_FILE_MENU_ID = "attanger-attach-new-file";
const MATCH_ATTACHMENT_MENU_ID = "attanger-match-attachment";
const RENAME_MENU_ID = "attanger-rename-attachment";
const RENAME_MOVE_MENU_ID = "attanger-rename-move-attachment";
const MOVE_MENU_ID = "attanger-move-attachment";
const UNDO_MOVE_MENU_ID = "attanger-undo-move-attachment";
const PDF_RECOGNIZER_TIMEOUT_MS = 30_000;
const EXTERNAL_COPY_DEBOUNCE_MS = 1000;

/**
 * 菜单项后缀显示的快捷键提示，如 " (Ctrl + I)"；快捷键未启用或未设置时为空
 */
function getShortcutHint(shortcutPref: string) {
  if (!isShortcutEnabled(shortcutPref)) return "";
  const shortcut = getShortcutText(shortcutPref);
  return shortcut ? ` (${shortcut})` : "";
}

/**
 * 避免因为选中A操作移动，移动过程中点击了B分类
 */
let selectedCollection: Zotero.Collection | undefined;

function getSelectedCollectionCompat() {
  const pane = ZoteroPane as typeof ZoteroPane & {
    getSelectedCollections?: () => Zotero.Collection[];
  };
  if (pane.getSelectedCollections) {
    return pane.getSelectedCollections()[0];
  }
  return pane.getSelectedCollection() as Zotero.Collection | undefined;
}

/** 正在被 moveFile 处理的源文件路径集合，防止并发重复调用 */
const movingPaths = new Set<string>();
/** Attanger 正在修改的附件，避免自身 saveTx 再次触发自动重命名 */
const attachmentMutationInFlight = new Set<number>();
/** Attanger 新建的链接附件，其 add 通知不应再次触发自动处理 */
const automaticallyCreatedLinkedAttachmentIDs = new Set<number>();
const AUTOMATIC_LINKED_ATTACHMENT_IGNORE_MS = 30_000;
/**
 * Number of running "Undo Move" conversions. Zotero's conversion creates a new
 * stored attachment; without this guard automatic moving would immediately
 * turn it back into a linked file.
 */
let nativeStoredConversionsInFlight = 0;
const CJK_RE =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
export default class Menu {
  private notifierID?: string;
  private pendingAddedItemIDs = new Set<number>();
  private cancelledAutomaticItemIDs = new Set<number>();
  private autoProcessTimer?: number;
  private autoProcessRunning = false;
  private autoRenameOnModifyTimers = new Map<number, number>();
  private autoRenameOnModifyTokens = new Map<number, number>();
  private externalCopyTimer?: number;
  private pendingCopyItemIDs = new Set<number>();
  private reportedCopyProblems = new Map<number, string>();
  private disposed = false;
  // Context-menu registrations; on Zotero 11 these live in Zotero.MenuManager
  // and are not removed by ztoolkit.Menu.unregisterAll().
  private contextMenus: ContextMenuHandle[] = [];
  private itemMenu?: ContextMenuHandle;
  private buildItemMenu?: () => MenuitemOptions;

  constructor() {
    addon.data.menu?.dispose();
    addon.data.menu = this;
    this.notifierID = registerNotify(
      ["item", "file", "collection-item"],
      async (
        event: _ZoteroTypes.Notifier.Event,
        type: _ZoteroTypes.Notifier.Type,
        ids: string[] | number[],
      ) => {
        if (type == "item" && (event == "trash" || event == "delete")) {
          this.cancelAutomaticProcessing(ids, event);
          return;
        }
        if (type == "item" && event == "add") {
          this.queueAddedItems(ids);
        }
        if (type == "item" && event == "modify") {
          await this.queueLinkedAttachmentRenameOnModify(ids);
          this.queueExternalCopyUpdates(ids);
        }
        if (type == "file" && ["modify", "close"].includes(event)) {
          this.queueExternalCopyUpdates(ids);
        }
        if (type == "collection-item") {
          // IDs are "collectionID-itemID"; the item part decides the copy path.
          this.queueExternalCopyUpdates(
            ids.map((id) => String(id).split("-").pop() as string),
          );
        }
      },
    );
    addon.data.notifierID = this.notifierID;
    this.init();
    this.register();
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const menu of this.contextMenus.splice(0)) menu.dispose();
    this.itemMenu = undefined;
    this.buildItemMenu = undefined;
    if (this.autoProcessTimer !== undefined) {
      window.clearTimeout(this.autoProcessTimer);
      this.autoProcessTimer = undefined;
    }
    this.pendingAddedItemIDs.clear();
    this.cancelledAutomaticItemIDs.clear();
    for (const timer of this.autoRenameOnModifyTimers.values()) {
      window.clearTimeout(timer);
    }
    this.autoRenameOnModifyTimers.clear();
    this.autoRenameOnModifyTokens.clear();
    if (this.externalCopyTimer !== undefined) {
      window.clearTimeout(this.externalCopyTimer);
      this.externalCopyTimer = undefined;
    }
    this.pendingCopyItemIDs.clear();
    this.reportedCopyProblems.clear();
    if (this.notifierID) {
      unregisterNotify(this.notifierID);
      if (addon.data.notifierID === this.notifierID) {
        addon.data.notifierID = "";
      }
      this.notifierID = undefined;
    }
  }

  private queueAddedItems(ids: string[] | number[]) {
    if (this.disposed) return;
    for (const id of ids) {
      const numericID = Number(id);
      if (Number.isInteger(numericID)) {
        if (automaticallyCreatedLinkedAttachmentIDs.has(numericID)) {
          this.pendingAddedItemIDs.delete(numericID);
          continue;
        }
        if (
          nativeStoredConversionsInFlight > 0 &&
          Zotero.Items.get(numericID)?.isAttachment()
        ) {
          // Created by "Undo Move"; it must stay a stored attachment.
          continue;
        }
        this.pendingAddedItemIDs.add(numericID);
      }
    }
    if (this.autoProcessTimer !== undefined) {
      window.clearTimeout(this.autoProcessTimer);
    }
    // Connector saves the parent and its attachments in separate add events.
    this.autoProcessTimer = window.setTimeout(() => {
      this.autoProcessTimer = undefined;
      void this.flushAddedItems();
    }, 1000);
  }

  private cancelAutomaticProcessing(
    ids: string[] | number[],
    event: "trash" | "delete",
  ) {
    const itemIDs = new Set(
      ids.map((id) => Number(id)).filter((id) => Number.isInteger(id)),
    );
    for (const itemID of [...itemIDs]) {
      if (attachmentMutationInFlight.has(itemID)) {
        itemIDs.delete(itemID);
        continue;
      }
      const item = Zotero.Items.get(itemID);
      if (item?.isTopLevelItem() && item.isRegularItem()) {
        for (const attachmentID of item.getAttachments()) {
          itemIDs.add(attachmentID);
        }
      }
    }
    for (const itemID of itemIDs) {
      this.pendingAddedItemIDs.delete(itemID);
      this.cancelLinkedAttachmentRenameOnModify(itemID);
      this.pendingCopyItemIDs.delete(itemID);
      if (this.autoProcessRunning) {
        this.cancelledAutomaticItemIDs.add(itemID);
      }
    }
    if (
      this.pendingAddedItemIDs.size === 0 &&
      this.autoProcessTimer !== undefined
    ) {
      window.clearTimeout(this.autoProcessTimer);
      this.autoProcessTimer = undefined;
    }
  }

  private isAutomaticProcessingCancelled(item: Zotero.Item) {
    return (
      this.disposed ||
      this.cancelledAutomaticItemIDs.has(item.id) ||
      item.deleted ||
      Boolean(item.parentItem?.deleted)
    );
  }

  private async flushAddedItems() {
    if (this.disposed || this.autoProcessRunning) return;
    this.autoProcessRunning = true;
    try {
      while (!this.disposed && this.pendingAddedItemIDs.size > 0) {
        const ids = [...this.pendingAddedItemIDs];
        this.pendingAddedItemIDs.clear();
        await this.processAddedItems(ids);
      }
    } finally {
      this.autoProcessRunning = false;
      this.cancelledAutomaticItemIDs.clear();
    }
  }

  private async processAddedItems(ids: number[]) {
    const attachments = new Map<number, Zotero.Item>();
    for (const item of Zotero.Items.get(ids)) {
      try {
        if (!item || this.isAutomaticProcessingCancelled(item)) continue;
        // moveFile replaces an imported attachment with a linked attachment.
        // Its add notification must not start a second rename pass, which can
        // remove the collision suffix and make multiple items share one path.
        if (automaticallyCreatedLinkedAttachmentIDs.has(item.id)) {
          continue;
        }
        if (item.isAttachment() && (await item.fileExists())) {
          if (!this.isAutomaticProcessingCancelled(item)) {
            attachments.set(item.id, item);
          }
        } else if (item.isTopLevelItem() && item.isRegularItem()) {
          for (const attachmentID of item.getAttachments()) {
            const attachment = Zotero.Items.get(attachmentID);
            if (
              attachment &&
              !automaticallyCreatedLinkedAttachmentIDs.has(attachment.id) &&
              !this.isAutomaticProcessingCancelled(attachment) &&
              attachment.isAttachment() &&
              (await attachment.fileExists())
            ) {
              if (!this.isAutomaticProcessingCancelled(attachment)) {
                attachments.set(attachment.id, attachment);
              }
            }
          }
        }
      } catch (e) {
        ztoolkit.log("Failed to inspect added item", item?.id, e);
      }
    }

    for (const attachment of attachments.values()) {
      if (this.isAutomaticProcessingCancelled(attachment)) continue;
      await this.processAddedAttachment(attachment);
    }
  }

  private async processAddedAttachment(att: Zotero.Item) {
    try {
      if (this.isAutomaticProcessingCancelled(att)) return;
      const isStandaloneImportedPDF =
        !att.parentItemID && att.isImportedAttachment() && isPDFAttachment(att);
      if (isStandaloneImportedPDF) {
        if (!getPref("autoRecognizeImportedPDF")) {
          ztoolkit.log(
            "Automatic processing skipped: standalone PDF recognition is disabled",
            att.id,
          );
          return;
        }
        await Zotero.RecognizeDocument.recognizeItems([att]);
        const recognizedAttachment = await Zotero.Items.getAsync(att.id);
        if (!recognizedAttachment?.parentItemID) {
          ztoolkit.log(
            "Automatic processing skipped: PDF recognition created no parent item",
            att.id,
          );
          return;
        }
        att = recognizedAttachment;
        if (this.isAutomaticProcessingCancelled(att)) return;
      }
      const canProcess = checkFileType(att);
      const filenameNoExt = canProcess
        ? await getAttachmentFilenameNoExt(att)
        : null;
      if (this.isAutomaticProcessingCancelled(att)) return;
      if (isFilenameMatched("filenameSkipAutoMoveRenameRules", filenameNoExt)) {
        showAttachmentItem(att);
        return;
      }
      const shouldRename =
        canProcess &&
        canEditAttachment(att) &&
        Boolean(Zotero.Prefs.get("autoRenameFiles"));
      const shouldMoveImportedAttachment =
        canProcess && att.isImportedAttachment() && shouldMoveNewAttachments();
      const shouldMirrorImportedAttachment =
        canProcess && att.isImportedAttachment() && shouldMirrorAttachments();
      if (shouldRename && shouldMoveImportedAttachment) {
        // Imported files are Zotero-managed copies. Rename them before they
        // enter the shared destination so moveFile can resolve collisions.
        this.cancelLinkedAttachmentRenameOnModify(att.id);
        await renameFile(att);
      }
      if (shouldMoveImportedAttachment) {
        const sourceAttachment = att;
        const moved = await moveFile(att, {
          silent: true,
          shouldCancel: () =>
            this.isAutomaticProcessingCancelled(sourceAttachment),
        });
        if (!moved) return;
        att = moved;
      }
      if (this.isAutomaticProcessingCancelled(att)) return;
      if (shouldRename && !shouldMoveImportedAttachment) {
        this.cancelLinkedAttachmentRenameOnModify(att.id);
        await renameFile(att);
      }
      if (shouldMirrorImportedAttachment) {
        // Mirror after renaming so the copy starts with its final filename.
        const sourceAttachment = att;
        await mirrorAttachment(att, {
          silent: true,
          shouldCancel: () =>
            this.isAutomaticProcessingCancelled(sourceAttachment),
        });
      }
    } catch (e) {
      ztoolkit.log(e);
    }
    showAttachmentItem(att);
  }

  private async queueLinkedAttachmentRenameOnModify(ids: string[] | number[]) {
    if (this.disposed || !getPref("autoRenameOnModify")) return;
    const numericIDs = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id));
    const attachmentIDs = this.collectLinkedAttachmentsForModify(numericIDs);
    for (const attachmentID of attachmentIDs) {
      this.scheduleLinkedAttachmentRenameOnModify(attachmentID);
    }
  }

  private collectLinkedAttachmentsForModify(ids: number[]) {
    const attachmentIDs = new Set<number>();
    for (const item of Zotero.Items.get(ids)) {
      if (!item) continue;
      if (item.isAttachment()) {
        if (
          !attachmentMutationInFlight.has(item.id) &&
          isAutoRenameLinkedAttachmentCandidate(item)
        ) {
          attachmentIDs.add(item.id);
        }
        continue;
      }
      if (!item.isTopLevelItem() || !item.isRegularItem()) continue;
      for (const attachmentID of item.getAttachments()) {
        const attachment = Zotero.Items.get(attachmentID);
        if (
          attachment &&
          !attachmentMutationInFlight.has(attachment.id) &&
          isAutoRenameLinkedAttachmentCandidate(attachment)
        ) {
          attachmentIDs.add(attachment.id);
        }
      }
    }
    return [...attachmentIDs];
  }

  private scheduleLinkedAttachmentRenameOnModify(attachmentID: number) {
    const previousTimer = this.autoRenameOnModifyTimers.get(attachmentID);
    if (previousTimer !== undefined) {
      window.clearTimeout(previousTimer);
    }
    const token = (this.autoRenameOnModifyTokens.get(attachmentID) || 0) + 1;
    this.autoRenameOnModifyTokens.set(attachmentID, token);
    const debounceMs = getPref("autoRenameOnModifyDebounceEnabled")
      ? getNonNegativeIntegerPref("autoRenameOnModifyDebounceMs", 1000)
      : 0;
    const timer = window.setTimeout(async () => {
      this.autoRenameOnModifyTimers.delete(attachmentID);
      try {
        const delayMs = getPref("autoRenameOnModifyDelayEnabled")
          ? getNonNegativeIntegerPref("autoRenameOnModifyDelayMs", 0)
          : 0;
        if (delayMs > 0) {
          await Zotero.Promise.delay(delayMs);
        }
        if (
          this.disposed ||
          this.autoRenameOnModifyTokens.get(attachmentID) !== token
        ) {
          return;
        }
        await this.runLinkedAttachmentRenameOnModify(attachmentID);
      } catch (e) {
        ztoolkit.log("Auto rename on modify failed", attachmentID, e);
      } finally {
        if (this.autoRenameOnModifyTokens.get(attachmentID) === token) {
          this.autoRenameOnModifyTokens.delete(attachmentID);
        }
      }
    }, debounceMs);
    this.autoRenameOnModifyTimers.set(attachmentID, timer);
  }

  private cancelLinkedAttachmentRenameOnModify(attachmentID: number) {
    const timer = this.autoRenameOnModifyTimers.get(attachmentID);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.autoRenameOnModifyTimers.delete(attachmentID);
    }
    this.autoRenameOnModifyTokens.delete(attachmentID);
  }

  private async runLinkedAttachmentRenameOnModify(attachmentID: number) {
    if (
      this.disposed ||
      !getPref("autoRenameOnModify") ||
      attachmentMutationInFlight.has(attachmentID)
    ) {
      return;
    }
    const attachment = await Zotero.Items.getAsync(attachmentID);
    if (!attachment || !(await canAutoRenameLinkedAttachment(attachment))) {
      return;
    }
    const filenameNoExt = await getAttachmentFilenameNoExt(attachment);
    if (isFilenameMatched("filenameSkipAutoMoveRenameRules", filenameNoExt)) {
      return;
    }
    try {
      await renameFile(attachment);
    } catch (e) {
      ztoolkit.log(e);
      showLinkedAttachmentRenameError(attachment);
    }
  }

  private queueExternalCopyUpdates(ids: string[] | number[]) {
    if (this.disposed || !shouldMirrorAttachments()) return;
    for (const id of ids) {
      const item = Zotero.Items.get(Number(id));
      if (!item || attachmentMutationInFlight.has(item.id)) continue;
      const attachmentIDs = item.isAttachment()
        ? [item.id]
        : item.isRegularItem()
          ? item.getAttachments()
          : [];
      for (const attachmentID of attachmentIDs) {
        if (!attachmentMutationInFlight.has(attachmentID)) {
          this.pendingCopyItemIDs.add(attachmentID);
        }
      }
    }
    if (!this.pendingCopyItemIDs.size) return;
    if (this.externalCopyTimer !== undefined) {
      window.clearTimeout(this.externalCopyTimer);
    }
    this.externalCopyTimer = window.setTimeout(async () => {
      this.externalCopyTimer = undefined;
      const itemIDs = [...this.pendingCopyItemIDs];
      this.pendingCopyItemIDs.clear();
      for (const itemID of itemIDs) {
        if (this.disposed || !shouldMirrorAttachments()) break;
        const attachment = Zotero.Items.get(itemID);
        // Only refresh attachments that already have a mirror; new ones are
        // exported by add-time processing or the manual menu command.
        if (attachment && (await getExternalCopy(attachment).catch(() => 0))) {
          await this.updateExternalCopy(attachment);
        }
      }
    }, EXTERNAL_COPY_DEBOUNCE_MS);
  }

  private async updateExternalCopy(attachment: Zotero.Item) {
    const shouldCancel = () =>
      this.disposed ||
      attachment.deleted ||
      Boolean(attachment.parentItem?.deleted);
    if (shouldCancel()) return;
    try {
      const result = await mirrorAttachment(attachment, {
        silent: true,
        fastCheck: true,
        shouldCancel,
      });
      if (result?.status === "conflict") {
        this.reportExternalCopyProblem(attachment, "copy-conflict");
      } else if (result && result.status !== "cancelled") {
        this.reportedCopyProblems.delete(attachment.id);
      }
    } catch (error) {
      ztoolkit.log("External copy update failed", attachment.id, error);
      this.reportExternalCopyProblem(attachment, "copy-error");
    }
  }

  private reportExternalCopyProblem(attachment: Zotero.Item, message: string) {
    if (
      this.disposed ||
      this.reportedCopyProblems.get(attachment.id) === message
    ) {
      return;
    }
    this.reportedCopyProblems.set(attachment.id, message);
    showMoveMessage(
      getString(message, {
        args: { title: attachment.getDisplayTitle() },
      }),
    );
  }

  private init() {
    for (const name in addon.data.icons) {
      ztoolkit.ProgressWindow.setIconURI(name, addon.data.icons[name]);
    }
  }

  /** Menu IDs and shortcuts stay the same; only the label follows the mode. */
  public refreshItemMenu() {
    // MenuManager elements may not exist yet; rebuild the menu data instead.
    if (usesOfficialContextMenus() && this.itemMenu && this.buildItemMenu) {
      this.itemMenu.update(this.buildItemMenu());
      return;
    }
    const labels = getModeMenuLabels();
    for (const win of Zotero.getMainWindows()) {
      const setLabel = (
        id: string,
        stringKey: string,
        shortcutPref?: string,
      ) => {
        win.document
          .getElementById(id)
          ?.setAttribute(
            "label",
            getString(stringKey) +
              (shortcutPref ? getShortcutHint(shortcutPref) : ""),
          );
      };
      setLabel(
        ATTACH_NEW_FILE_MENU_ID,
        "attach-new-file",
        "attachNewFile.shortcut",
      );
      setLabel(
        MATCH_ATTACHMENT_MENU_ID,
        "match-attachment",
        "matchAttachment.shortcut",
      );
      setLabel(
        RENAME_MENU_ID,
        "rename-attachment",
        "renameAttachment.shortcut",
      );
      setLabel(
        RENAME_MOVE_MENU_ID,
        labels.renameMove,
        "renameMoveAttachment.shortcut",
      );
      setLabel(MOVE_MENU_ID, labels.move, "moveAttachment.shortcut");
      setLabel(UNDO_MOVE_MENU_ID, labels.undo);
    }
  }

  private register() {
    const attachNewFileCallback = async () => {
      // 与菜单项的 getVisibility 条件保持一致，快捷键触发时同样需要校验
      const item = ZoteroPane.getSelectedItems()[0];
      if (!item || !item.isTopLevelItem() || !item.isRegularItem()) {
        ztoolkit.log(
          "attachNewFile skipped: no top-level regular item selected",
        );
        return;
      }
      await attachNewFile({
        libraryID: item.libraryID,
        parentItemID: item.id,
        collections: undefined,
      });
    };

    const renameMoveAttachmentCallback = () =>
      withSelectedCollection(async () => {
        const attachmentItems = getAttachmentItems(false);
        if (!attachmentItems.length) {
          showMoveMessage("No attachment selected.");
          return;
        }
        const mode = getWorkMode();
        for (const item of attachmentItems) {
          try {
            if (mode === "linked") {
              const movedItem = await moveFile(item);
              if (!movedItem) {
                showMoveMessage(
                  `Move skipped or failed: ${item.getDisplayTitle()}`,
                );
                continue;
              }
              const renamedItem = await renameFile(movedItem);
              showAttachmentItem(renamedItem || movedItem);
              continue;
            }
            const renamedItem = (await renameFile(item)) || item;
            if (mode === "copy") {
              await mirrorAttachmentWithFeedback(renamedItem);
            }
            showAttachmentItem(renamedItem);
          } catch (e) {
            ztoolkit.log(e);
            showMoveMessage(`Move error: ${(e as Error).message || e}`);
          }
        }
      });

    const renameAttachmentCallback = async () => {
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
    };

    const moveAttachmentCallback = () =>
      withSelectedCollection(async () => {
        const mode = getWorkMode();
        if (mode === "stored") {
          showMoveMessage(getString("mode-stored-message"));
          return;
        }
        for (const item of getAttachmentItems(false)) {
          try {
            if (mode === "copy") {
              await mirrorAttachmentWithFeedback(item);
              continue;
            }
            const attItem = await moveFile(item);
            attItem && showAttachmentItem(attItem);
          } catch (e) {
            ztoolkit.log(e);
          }
        }
      });

    // Zotero 11+ registers via Zotero.MenuManager; Zotero 10 keeps ztoolkit.
    this.buildItemMenu = () => ({
      tag: "menu",
      id: ATTANGER_MENU_ID,
      label: "Attanger",
      icon: addon.data.icons.favicon,
      children: [
        // 附加新文件
        {
          tag: "menuitem",
          id: ATTACH_NEW_FILE_MENU_ID,
          label:
            getString("attach-new-file") +
            getShortcutHint("attachNewFile.shortcut"),
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
          label:
            getString(getModeMenuLabels().renameMove) +
            getShortcutHint("renameMoveAttachment.shortcut"),
          icon: addon.data.icons.renameMoveAttachment,
          commandListener: async (_ev) => {
            await renameMoveAttachmentCallback();
          },
        },
        { tag: "menuseparator" },
        // 匹配附件
        {
          tag: "menuitem",
          id: MATCH_ATTACHMENT_MENU_ID,
          label:
            getString("match-attachment") +
            getShortcutHint("matchAttachment.shortcut"),
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
          id: RENAME_MENU_ID,
          label:
            getString("rename-attachment") +
            getShortcutHint("renameAttachment.shortcut"),
          icon: addon.data.icons.renameAttachment,
          commandListener: async (_ev) => {
            await renameAttachmentCallback();
          },
        },
        {
          tag: "menuitem",
          id: MOVE_MENU_ID,
          label:
            getString(getModeMenuLabels().move) +
            getShortcutHint("moveAttachment.shortcut"),
          icon: addon.data.icons.moveFile,
          isHidden: () => getWorkMode() === "stored",
          commandListener: async (_ev) => {
            await moveAttachmentCallback();
          },
        },
        {
          tag: "menuitem",
          id: UNDO_MOVE_MENU_ID,
          label: getString(getModeMenuLabels().undo),
          icon: addon.data.icons.undoMoveFile,
          commandListener: async () => {
            await convertLinkedFilesToStoredFiles();
          },
        },
      ],
    });
    this.itemMenu = registerContextMenu("item", this.buildItemMenu());
    this.contextMenus.push(this.itemMenu);
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
    // 重命名附件
    registerShortcut("renameAttachment.shortcut", async () => {
      await renameAttachmentCallback();
    });
    // 重命名并移动/复制附件
    registerShortcut("renameMoveAttachment.shortcut", async () => {
      await renameMoveAttachmentCallback();
    });
    // 移动/复制附件
    registerShortcut("moveAttachment.shortcut", async () => {
      await moveAttachmentCallback();
    });
    // 分类
    const collectionMenu = registerContextMenu("collection", {
      tag: "menuitem",
      id: `${config.addonRef}-collection-attach-new-file`,
      label: getString("attach-new-file"),
      icon: addon.data.icons.attachNewFile,
      getVisibility: () => {
        return ZoteroPane.getCollectionTreeRow()?.isCollection();
      },
      commandListener: async (_ev) => {
        const collection = getSelectedCollectionCompat();
        if (!collection) return;
        await attachNewFile({
          libraryID: collection.libraryID,
          parentItemID: undefined,
          collections: [collection.id],
        });
      },
    });
    this.contextMenus.push(collectionMenu);
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
    const openUsingMenu = registerContextMenu("item", {
      tag: "menu",
      id: `${config.addonRef}-open-using`,
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
        ...fileHandlerArr.map((fileHandler: string) => {
          return {
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
          };
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
    this.contextMenus.push(openUsingMenu);
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
  const items = ZoteroPane.getSelectedItems().filter(
    (i) =>
      !i.deleted &&
      i.isTopLevelItem() &&
      i.isRegularItem() &&
      canEditAttachment(i),
  );
  if (!items.length) return;
  ztoolkit.log(
    "item titles: ",
    items.map((i) => i.getDisplayTitle()),
  );
  const sourceDirs = await getSourceDirs();
  if (!sourceDirs.length) return;
  const files = new Map<string, OS.File.Entry>();
  /* TODO: migrate to IOUtils */
  for (const sourceDir of sourceDirs) {
    await Zotero.File.iterateDirectory(
      sourceDir,
      async function (child: OS.File.Entry) {
        if (!child.isDir && /\.(caj|pdf)$/i.test(child.name)) {
          files.set(normalizeAttachmentPath(child.path), child);
        }
      },
    );
  }
  ztoolkit.log(
    "found pdf files:",
    [...files.values()].map((f) => f.path),
  );
  const readPDFTitle = String(
    getPref("readPDFtitle") || "nonCJK",
  ).toLowerCase();
  ztoolkit.log("read PDF title: ", readPDFTitle);
  const fingerprintCache = createAttachmentFingerprintCache();
  const identityCache = createPDFIdentityCache(
    getPDFData,
    getPDFFulltext,
    getPDFVisualIdentity,
  );
  type CandidateGroup = {
    files: OS.File.Entry[];
    fingerprint?: FileFingerprint;
    titles: string[];
    dois: string[];
    role: ReturnType<typeof getPDFDocumentRole>;
  };
  const groups = new Map<string, CandidateGroup>();
  const fileFingerprints = new Map<string, FileFingerprint>();
  for (const file of files.values()) {
    const pdf = /\.pdf$/i.test(file.name);
    const fingerprint = pdf
      ? await fingerprintForMatching(file.path, fingerprintCache)
      : undefined;
    if (pdf && !fingerprint) continue;
    if (fingerprint) {
      fileFingerprints.set(normalizeAttachmentPath(file.path), fingerprint);
    }
    const key = fingerprint
      ? `${fingerprint.size}:${fingerprint.hash}`
      : normalizeAttachmentPath(file.path);
    const group = groups.get(key);
    if (group) group.files.push(file);
    else {
      groups.set(key, {
        files: [file],
        fingerprint,
        titles: [],
        dois: [],
        role: "unknown",
      });
    }
  }

  let added = 0;
  let duplicates = 0;
  const duplicateOwners = new Set<Zotero.Item>();
  const remaining = new Set(items);
  const readPDFForItem = (item: Zotero.Item) =>
    canReadPDFForItem(item, readPDFTitle);
  for (const [key, group] of groups) {
    if (!group.fingerprint) continue;
    for (const item of items) {
      if (
        await findDuplicatePDFAttachment(
          item,
          group.files[0].path,
          fingerprintCache,
          readPDFForItem(item) ? identityCache : undefined,
        )
      ) {
        // Never recycle a duplicate download onto another selected paper.
        duplicates += group.files.length;
        duplicateOwners.add(item);
        groups.delete(key);
        break;
      }
    }
    if (groups.has(key) && items.some(readPDFForItem)) {
      try {
        const data = await getPDFData(group.files[0].path);
        group.titles = getPDFTitleCandidates(data);
        group.dois = getPDFPrimaryDOIs(data);
        group.role = getPDFDocumentRole(data);
        ztoolkit.log("PDF identity evidence", group.files[0].path, {
          titles: group.titles,
          dois: group.dois,
          role: group.role,
        });
      } catch (error) {
        // Failures are cached with the group for the rest of this command.
        ztoolkit.log("PDF title extraction failed; using filenames", error);
      }
    }
  }

  // Downloads can be re-encoded without changing their article content. Only
  // merge equal article identities after full-document verification, not DOI alone.
  const groupEntries = [...groups.entries()];
  for (let i = 0; i < groupEntries.length; i++) {
    const [key, group] = groupEntries[i];
    if (!groups.has(key) || group.dois.length !== 1) continue;
    for (let j = i + 1; j < groupEntries.length; j++) {
      const [otherKey, other] = groupEntries[j];
      if (
        !groups.has(otherKey) ||
        other.dois.length !== 1 ||
        other.dois[0] !== group.dois[0] ||
        other.role !== group.role
      ) {
        continue;
      }
      if (
        await samePDFContent(
          group.files[0].path,
          other.files[0].path,
          fingerprintCache,
          identityCache,
        )
      ) {
        group.files.push(...other.files);
        group.titles = [...new Set([...group.titles, ...other.titles])];
        groups.delete(otherKey);
      }
    }
  }

  const candidates = [...remaining].flatMap((item) =>
    [...groups.values()].map((group) => {
      const titles = readPDFForItem(item) ? group.titles : [];
      const dois = readPDFForItem(item) ? group.dois : [];
      const itemDOI = normalizeDOI(item.getField("DOI"));
      const itemRole = getPDFDocumentRole({
        metadata: { Title: getPlainTitle(item) },
      });
      const doiMatch = dois.length === 1 && dois[0] === itemDOI;
      const doiConflict =
        dois.length > 1 || Boolean(itemDOI && dois.length && !doiMatch);
      const rankedFiles = group.files
        .map((file) => {
          const filenameRole = getPDFDocumentRole(undefined, file.name);
          const role =
            readPDFForItem(item) && group.role !== "unknown"
              ? group.role
              : filenameRole;
          const roleConflict = role !== "unknown" && role !== itemRole;
          return {
            file,
            fingerprint: fileFingerprints.get(
              normalizeAttachmentPath(file.path),
            ),
            // A supplement can share its parent article DOI. Document-role
            // conflicts therefore veto even an otherwise exact DOI match.
            score:
              doiConflict || roleConflict
                ? 0
                : doiMatch && role === "unknown" && itemRole === "unknown"
                  ? 2
                  : scoreAttachmentMatch(
                      getPlainTitle(item),
                      file.name,
                      titles,
                    ),
          };
        })
        .sort((a, b) => b.score - a.score);
      return { item, group, doiMatch, ...rankedFiles[0] };
    }),
  );

  const availableGroups = new Set(groups.values());
  while (remaining.size && availableGroups.size) {
    const ranked = candidates
      .filter(
        (candidate) =>
          remaining.has(candidate.item) &&
          availableGroups.has(candidate.group) &&
          candidate.score >= MIN_ATTACHMENT_MATCH_SCORE,
      )
      .sort((a, b) => b.score - a.score);
    // Only choose a pair that is clearly better in both directions. This
    // prevents a short title stealing another paper's exact PDF match.
    const best = ranked.find((candidate) =>
      ranked.every(
        (other) =>
          other === candidate ||
          (other.item !== candidate.item && other.group !== candidate.group) ||
          candidate.score - other.score >= ATTACHMENT_MATCH_AMBIGUITY_MARGIN,
      ),
    );
    if (!best) break;
    remaining.delete(best.item);
    availableGroups.delete(best.group);
    ztoolkit.log("Confident attachment match", {
      title: getPlainTitle(best.item),
      file: best.file.path,
      score: best.score,
      evidence: best.doiMatch ? "article DOI" : "title",
    });
    try {
      const result = await runAttachmentOperation(async () => {
        if (best.item.deleted || !canEditAttachment(best.item)) return;
        if (best.fingerprint) {
          const current = await fingerprintForMatching(
            best.file.path,
            fingerprintCache,
          );
          if (!current || !matchingFileContent(current, best.fingerprint)) {
            return;
          }
          const duplicate = await findDuplicatePDFAttachment(
            best.item,
            best.file.path,
            fingerprintCache,
            readPDFForItem(best.item) ? identityCache : undefined,
          );
          if (duplicate) return { duplicate };
          const verified = await fingerprintForMatching(
            best.file.path,
            fingerprintCache,
          );
          if (!verified || !matchingFileContent(verified, best.fingerprint)) {
            return;
          }
        }
        const attachment = await Zotero.Attachments.importFromFile({
          file: best.file.path,
          libraryID: best.item.libraryID,
          parentItemID: best.item.id,
        });
        // Skipped duplicates never reach source cleanup.
        await removeSourceFile(best.file.path, best.fingerprint);
        return { attachment };
      });
      if (result?.duplicate) {
        duplicates += best.group.files.length;
        duplicateOwners.add(best.item);
      } else if (result?.attachment) {
        added++;
        duplicates += best.group.files.length - 1;
        showAttachmentItem(result.attachment);
      } else {
        remaining.add(best.item);
      }
    } catch (error) {
      remaining.add(best.item);
      ztoolkit.log("Cannot import matched attachment", best.file.path, error);
    }
  }
  for (const item of remaining) {
    ztoolkit.log("Attachment matching skipped", {
      title: getPlainTitle(item),
      doi: normalizeDOI(item.getField("DOI")),
      candidates: candidates
        .filter((candidate) => candidate.item === item)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((candidate) => ({
          file: candidate.file.path,
          score: candidate.score,
          dois: candidate.group.dois,
        })),
    });
  }
  showAttachmentMatchMessage("attachment-match-summary", {
    added,
    duplicates,
    unmatched: [...remaining].filter((item) => !duplicateOwners.has(item))
      .length,
  });
}

/**
 * Use the collection selected for a manual command only during that command,
 * so later add-time processing does not inherit a stale collection.
 */
async function withSelectedCollection<T>(task: () => Promise<T>) {
  selectedCollection = getSelectedCollectionCompat();
  try {
    return await task();
  } finally {
    selectedCollection = undefined;
  }
}

/** Run Zotero's linked-to-stored conversion without add-time reprocessing. */
async function convertLinkedFilesToStoredFiles() {
  nativeStoredConversionsInFlight++;
  try {
    await ZoteroPane.convertLinkedFilesToStoredFiles();
  } finally {
    nativeStoredConversionsInFlight--;
  }
}

async function matchAttangerAttachment() {
  const sourceDirs = await getSourceDirs();
  if (!sourceDirs.length) {
    ztoolkit.log("source dir is empty, exit");
    return;
  }
  const fileTypes = getPref("fileTypes") as string;
  const fileTypeList = (fileTypes || "")
    .split(",")
    .map((type) => type.trim().replace(/^\./, ""))
    .filter(Boolean);
  // ztoolkit.log('match attanger attachments for these file types: ', fileTypeList);

  const items = ZoteroPane.getSelectedItems()
    .filter(
      (i) =>
        !i.deleted &&
        i.isTopLevelItem() &&
        i.isRegularItem() &&
        canEditAttachment(i),
    )
    .sort((a, b) => getPlainTitle(a).length - getPlainTitle(b).length);
  const fingerprintCache = createAttachmentFingerprintCache();
  const identityCache = createPDFIdentityCache(
    getPDFData,
    getPDFFulltext,
    getPDFVisualIdentity,
  );

  for (const item of items) {
    // 使用 getCollectionPathsOfItem 获取条目所在的分类路径
    // let collectionPath = getCollectionPathsOfItem(item);
    // if (collectionPath === undefined) collectionPath = ''

    const existAttachments = item
      .getAttachments()
      .map((id) => Zotero.Items.get(id))
      .filter((item) => item.isAttachment())
      .map((item) => item.getField("title"));

    const subfolder = getSubfolderPath(item);

    // 拼接出实际文件目录路径；多个下载文件夹按设置顺序查找
    const realRoots = sourceDirs.map((sourceDir) =>
      PathUtils.joinRelative(sourceDir, subfolder),
    );
    const attachmentBaseName = Zotero.Attachments.getFileBaseNameFromItem(item);

    ztoolkit.log("item: ", item.getDisplayTitle());
    ztoolkit.log("|  realRoots:", realRoots);
    ztoolkit.log("|  exist attachments:", existAttachments);

    for (const ext of fileTypeList) {
      const file = realRoots
        .map((realRoot) =>
          Zotero.File.pathToFile(
            PathUtils.joinRelative(realRoot, `${attachmentBaseName}.${ext}`),
          ),
        )
        .find((candidate) => candidate.exists());
      if (!file) continue;
      const fullpath = file.path;
      const basename = file.leafName;
      const pdf = /\.pdf$/i.test(fullpath);
      if (pdf || !existAttachments.includes(basename)) {
        try {
          const attachOptions = {
            file: fullpath,
            libraryID: item.libraryID,
            parentItemID: item.id,
          };
          // Existing Attanger libraries are linked files, as in earlier
          // versions. Only the copy mode imports them so the attachment is
          // stored in Zotero and the external file becomes its copy source.
          const attItem = await runAttachmentOperation(async () => {
            if (item.deleted || !canEditAttachment(item)) return;
            if (pdf) {
              const expected = await fingerprintForMatching(
                fullpath,
                fingerprintCache,
              );
              if (!expected) {
                showAttachmentMatchMessage("attachment-file-unverified", {
                  title: basename,
                });
                return;
              }
              if (
                await findDuplicatePDFAttachment(
                  item,
                  fullpath,
                  fingerprintCache,
                  canReadPDFForItem(item) ? identityCache : undefined,
                )
              ) {
                showAttachmentMatchMessage("attachment-duplicate-skipped", {
                  title: basename,
                });
                return;
              }
              const verified = await fingerprintForMatching(
                fullpath,
                fingerprintCache,
              );
              if (!verified || !matchingFileContent(verified, expected)) {
                return;
              }
            }
            return getWorkMode() === "copy"
              ? Zotero.Attachments.importFromFile(attachOptions)
              : Zotero.Attachments.linkFromFile(attachOptions);
          });

          if (attItem) {
            showAttachmentItem(attItem);
            ztoolkit.log("|  Imported attachment:", attItem.getDisplayTitle());
          }
        } catch (error) {
          ztoolkit.log("|  Error importing attachment:", error);
        }
      } else {
        ztoolkit.log("|  skip exists:", basename);
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
function getLastFileInFolder(paths: string | string[]) {
  let lastmod: { lastModifiedTime: number; path?: string } = {
    lastModifiedTime: 0,
  };
  for (const path of typeof paths === "string" ? [paths] : paths) {
    const dir = Zotero.File.pathToFile(path);
    const files = dir.directoryEntries;
    while (files.hasMoreElements()) {
      // get next file
      const file = files
        .getNext()
        .QueryInterface(Components.interfaces.nsIFile);
      // skip if directory, hidden file or certain file types
      if (file.isDirectory() || file.isHidden()) {
        continue;
      }
      // check modification time
      if (file.isFile() && file.lastModifiedTime > lastmod.lastModifiedTime) {
        lastmod = file;
      }
    }
  }
  return lastmod.path;
}

function getRuleList(prefName: string) {
  return ((getPref(prefName) as string) || "").split(/,\s*/).filter(Boolean);
}

export function isFilenameMatched(
  prefName: string,
  filenameNoExt: string | null,
) {
  if (!filenameNoExt) return false;
  const rules = getRuleList(prefName);
  if (rules.length === 0) return false;
  return rules.some((rule: string) => {
    try {
      return new RegExp(rule).test(filenameNoExt);
    } catch (e) {
      ztoolkit.log("Invalid filename matching rule", prefName, rule, e);
      return false;
    }
  });
}

async function getAttachmentFilenameNoExt(attItem: Zotero.Item) {
  const file = (await attItem.getFilePathAsync()) as string;
  if (!file) return null;
  const origFilename = PathUtils.split(file).pop() as string;
  return origFilename.replace(filenameExtRE, "");
}

function getNonNegativeIntegerPref(key: string, fallback: number) {
  const value = getPref(key);
  const parsed =
    typeof value === "number" ? value : Number.parseInt(`${value ?? ""}`, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function isAutoRenameLinkedAttachmentCandidate(attItem: Zotero.Item) {
  return (
    !attItem.deleted &&
    !attItem.parentItem?.deleted &&
    attItem.isAttachment() &&
    attItem.isLinkedFileAttachment() &&
    checkFileType(attItem)
  );
}

async function canAutoRenameLinkedAttachment(attItem: Zotero.Item) {
  if (
    !isAutoRenameLinkedAttachmentCandidate(attItem) ||
    !canEditAttachment(attItem)
  ) {
    return false;
  }
  try {
    return await attItem.fileExists();
  } catch (e) {
    ztoolkit.log("Failed to inspect linked attachment", attItem.id, e);
    return false;
  }
}

function showLinkedAttachmentRenameError(attItem: Zotero.Item) {
  new ztoolkit.ProgressWindow("Attanger", {
    closeTime: 5000,
    closeOtherProgressWindows: true,
  })
    .createLine({
      text: getString("rename-linked-attachment-error", {
        args: { title: attItem.getField("title") as string },
      }),
      icon: addon.data.icons.renameAttachment,
    })
    .show();
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
  return runAttachmentOperation(() =>
    renameFileWithMutationLock(attItem, retry),
  );
}

async function renameFileWithMutationLock(attItem: Zotero.Item, retry = 0) {
  if (
    attItem.deleted ||
    attItem.parentItem?.deleted ||
    !canEditAttachment(attItem)
  ) {
    return attItem;
  }
  const ownsMutationLock = !attachmentMutationInFlight.has(attItem.id);
  if (ownsMutationLock) {
    attachmentMutationInFlight.add(attItem.id);
  }
  try {
    return await renameFileInternal(attItem, retry);
  } finally {
    if (ownsMutationLock) {
      attachmentMutationInFlight.delete(attItem.id);
    }
  }
}

async function renameFileInternal(attItem: Zotero.Item, retry = 0) {
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
    return attItem;
  }
  const parentItem = await Zotero.Items.getAsync(parentItemID);
  // getFileBaseNameFromItem
  let newName = Zotero.Attachments.getFileBaseNameFromItem(parentItem, {
    attachmentTitle: attItem.getField("title") as string,
  } as any);

  const ext = origFilename.match(filenameExtRE);
  // fix https://github.com/MuiseDestiny/zotero-attanger/issues/263
  const origFilenameNoExt = origFilename.replace(filenameExtRE, "");
  if (isFilenameMatched("filenameSkipRenameRules", origFilenameNoExt)) {
    return attItem;
  }
  if (isFilenameMatched("filenameAsPrefixRules", origFilenameNoExt)) {
    newName = origFilenameNoExt + "_" + newName;
  }
  newName = removeFilenameDiacritics(newName);
  if (ext) {
    newName += ext[0];
  }
  const origTitle = attItem.getField("title") as string;
  const shouldUpdateTitle =
    getPref("syncAttachmentTitle") === true ||
    shouldSyncAttachmentTitle(
      attItem,
      origTitle,
      origFilename,
      origFilenameNoExt,
    );
  if (newName === origFilename) {
    if (shouldUpdateTitle && origTitle !== origFilename) {
      attItem.setField("title", origFilename);
      await attItem.saveTx();
    }
    return attItem;
  }
  ztoolkit.log({ newName });
  const sharedLinkedFile =
    attItem.isLinkedFileAttachment() &&
    (await hasAttachmentFileReferences(file, attItem, {
      ignoreItemID: attItem.id,
    }));
  let renamed: unknown;
  if (sharedLinkedFile) {
    const copied = await copyAttachmentFile(
      file,
      PathUtils.joinRelative(PathUtils.parent(file) as string, newName),
      {
        shouldCancel: () =>
          attItem.deleted || Boolean(attItem.parentItem?.deleted),
      },
    );
    renamed = await attItem.relinkAttachmentFile(copied.path);
  } else {
    renamed = await renameAttachmentFile(attItem, newName);
  }
  if (renamed !== true) {
    ztoolkit.log("renamed = " + renamed, "newName", newName);
    await Zotero.Promise.delay(3e3);
    if (retry < 5) {
      return await renameFileInternal(attItem, retry + 1);
    }
    return;
  }
  const renamedFile = (await attItem.getFilePathAsync()) as string;
  const actualFilename = renamedFile
    ? (PathUtils.split(renamedFile).pop() as string)
    : newName;
  if (shouldUpdateTitle) {
    ztoolkit.log("renameFile sync attachment title", {
      origTitle,
      actualFilename,
    });
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

function isPDFAttachment(attItem: Zotero.Item) {
  return (
    attItem.attachmentContentType === "application/pdf" ||
    attItem.attachmentFilename?.toLowerCase().endsWith(".pdf")
  );
}

export function removeFilenameDiacritics(filename: string) {
  if (!getPref("removeDiacritics")) return filename;
  const utilities = Zotero.Utilities as {
    removeDiacritics?: (value: string) => string;
  };
  if (typeof utilities.removeDiacritics !== "function") {
    return filename;
  }
  return utilities.removeDiacritics(filename.normalize("NFC"));
}

/**
 * 得到附件的中间路径(对于subfolderFormat进行格式化)
 * @param item Item
 */
export function getSubfolderPath(
  item: Zotero.Item,
  getCollectionPath: (item: Zotero.Item) => string = getCollectionPathsOfItem,
) {
  let subfolder = "";
  const subfolderFormat = getPref("subfolderFormat") as string;
  if (subfolderFormat?.length > 0) {
    // Zotero.Attachments.getFileBaseNameFromItem 补充不支持的变量
    // 3. 得到最终路径
    // @ts-ignore 未添加属性
    const _getValidFileName = Zotero.File.getValidFileName;
    // @ts-ignore 未添加属性
    Zotero.File.getValidFileName = (fileName) =>
      fileName.replace(/[?*:|"<>]/g, "");

    try {
      subfolder = subfolderFormat
        .split(/(?<=\}\})\/(?=\{\{)/)
        .map((formatString: string) => {
          if (formatString == "{{collection}}") {
            return getCollectionPath(item);
          }
          return getValidFolderName(
            Zotero.Attachments.getFileBaseNameFromItem(item, {
              formatString,
            } as any),
          );
        })
        .join(addon.data.folderSep);
      if (Zotero.isWin) {
        subfolder = subfolder.replace(/[/]/g, "\\");
      } else {
        subfolder = subfolder.replace(/[\\]/g, "/");
      }
    } finally {
      // @ts-ignore Restore Zotero's global filename helper even on bad templates.
      Zotero.File.getValidFileName = _getValidFileName;
    }
  }
  return subfolder;
}

/**
 * 移动文件
 * @param item Attachment Item
 */
type MoveFileOptions = {
  silent?: boolean;
  shouldCancel?: () => boolean;
};

/**
 * Linked mode: move an attachment file into the destination directory.
 * Stored attachments become linked attachments; linked attachments are
 * relinked in place, so their item key, annotations and notes stay intact.
 * Other modes leave the attachment untouched, as earlier versions did when the
 * attach type was not "linking".
 */
export async function moveFile(
  attItem: Zotero.Item,
  { silent = false, shouldCancel = () => false }: MoveFileOptions = {},
) {
  const isCancelled = () =>
    attItem.deleted || Boolean(attItem.parentItem?.deleted) || shouldCancel();
  if (isCancelled() || getWorkMode() !== "linked") return;
  const sourcePath = (await attItem.getFilePathAsync()) as string;
  if (!sourcePath || isCancelled()) return;
  const pathKey = normalizeAttachmentPath(sourcePath);
  if (movingPaths.has(pathKey)) {
    ztoolkit.log("moveFile skipped: concurrent call for same path", sourcePath);
    return;
  }
  movingPaths.add(pathKey);
  try {
    return await runAttachmentOperation(async () => {
      if (isCancelled() || getWorkMode() !== "linked") return;
      const currentPath = (await attItem.getFilePathAsync()) as string;
      if (
        !currentPath ||
        !checkFileType(attItem, PathUtils.filename(currentPath))
      ) {
        return;
      }
      if (!canUseLinkedAttachment(attItem)) {
        ztoolkit.log(
          "Linked attachments require an editable personal library",
          attItem.id,
        );
        if (!silent) showMoveMessage(getString("linked-library-unavailable"));
        return;
      }
      const targetPath = await getAttachmentTargetPath(
        attItem,
        currentPath,
        silent,
      );
      if (!targetPath || isCancelled()) return;
      if (isZoteroStoragePath(targetPath)) {
        if (!silent) showMoveMessage(getString("target-inside-storage"));
        return;
      }
      return moveLinkedAttachment(
        attItem,
        currentPath,
        targetPath,
        isCancelled,
      );
    });
  } catch (error) {
    if (!(error instanceof AttachmentOperationCancelled)) {
      ztoolkit.log("Attachment move failed", attItem.id, error);
      showMoveMessage(
        getString("move-error", {
          args: { title: attItem.getDisplayTitle() },
        }),
      );
    }
    return;
  } finally {
    movingPaths.delete(pathKey);
  }
}

type MirrorOptions = MoveFileOptions & { fastCheck?: boolean };

/**
 * External copy mode: keep the stored attachment and mirror its file to the
 * destination path computed from the current folder and filename rules.
 */
export async function mirrorAttachment(
  attItem: Zotero.Item,
  { silent = false, shouldCancel = () => false, fastCheck }: MirrorOptions = {},
) {
  const isCancelled = () =>
    attItem.deleted || Boolean(attItem.parentItem?.deleted) || shouldCancel();
  return runAttachmentOperation(async () => {
    if (isCancelled() || getWorkMode() !== "copy") return;
    if (!attItem.isImportedAttachment()) {
      return { status: "skipped-linked" as const };
    }
    const sourcePath = (await attItem.getFilePathAsync()) as string;
    if (
      !sourcePath ||
      !checkFileType(attItem, PathUtils.filename(sourcePath))
    ) {
      return;
    }
    const targetPath = await getAttachmentTargetPath(
      attItem,
      sourcePath,
      silent,
    );
    if (!targetPath || isCancelled()) return;
    if (isZoteroStoragePath(targetPath)) {
      if (!silent) showMoveMessage(getString("target-inside-storage"));
      return;
    }
    const result = await syncExternalCopy(attItem, targetPath, {
      shouldCancel: isCancelled,
      fastCheck,
    });
    if (result.removedPath) {
      await removeEmptyFolder(PathUtils.parent(result.removedPath) as string);
    }
    return result;
  });
}

async function mirrorAttachmentWithFeedback(attItem: Zotero.Item) {
  try {
    const result = await mirrorAttachment(attItem);
    if (!result) return;
    if (result.status === "skipped-linked") {
      showMoveMessage(
        getString("copy-linked-skipped", {
          args: { title: attItem.getDisplayTitle() },
        }),
      );
    } else if (result.status === "conflict") {
      showMoveMessage(
        getString("copy-conflict", {
          args: { title: attItem.getDisplayTitle() },
        }),
      );
    } else if (result.status !== "cancelled") {
      showAttachmentItem(attItem);
    }
  } catch (error) {
    ztoolkit.log("External copy failed", attItem.id, error);
    showMoveMessage(
      getString("copy-error", {
        args: { title: attItem.getDisplayTitle() },
      }),
    );
  }
}

function getModeMenuLabels() {
  const mode = getWorkMode();
  if (mode === "copy") {
    return {
      move: "sync-copy-attachment",
      renameMove: "rename-sync-copy-attachment",
      undo: "undo-move-attachment",
    };
  }
  if (mode === "stored") {
    return {
      move: "move-attachment",
      renameMove: "rename-attachment",
      undo: "undo-move-attachment",
    };
  }
  const keepOriginal = getPref("moveWithoutDeleting") === true;
  return {
    move: keepOriginal ? "copy-attachment" : "move-attachment",
    renameMove: keepOriginal
      ? "rename-copy-attachment"
      : "rename-move-attachment",
    undo: keepOriginal ? "undo-copy-attachment" : "undo-move-attachment",
  };
}

async function getAttachmentTargetPath(
  attItem: Zotero.Item,
  sourcePath: string,
  silent: boolean,
) {
  const destDir = await checkDir("destDir", "destination directory", silent);
  if (!destDir) return;
  const parent = attItem.topLevelItem || attItem.parentItem || attItem;
  const subfolder = getSubfolderPath(parent);
  return PathUtils.joinRelative(
    subfolder ? PathUtils.joinRelative(destDir, subfolder) : destDir,
    PathUtils.filename(sourcePath),
  );
}

function canEditAttachment(attItem: Zotero.Item) {
  const library = Zotero.Libraries.get(attItem.libraryID);
  return Boolean(
    library &&
      library.editable &&
      library.filesEditable &&
      attItem.isEditable(),
  );
}

function canUseLinkedAttachment(attItem: Zotero.Item) {
  return (
    attItem.libraryID === Zotero.Libraries.userLibraryID &&
    canEditAttachment(attItem)
  );
}

function markCreatedAttachment(attItem: Zotero.Item) {
  automaticallyCreatedLinkedAttachmentIDs.add(attItem.id);
  attachmentMutationInFlight.add(attItem.id);
  window.setTimeout(
    () => automaticallyCreatedLinkedAttachmentIDs.delete(attItem.id),
    AUTOMATIC_LINKED_ATTACHMENT_IGNORE_MS,
  );
}

async function moveLinkedAttachment(
  attItem: Zotero.Item,
  sourcePath: string,
  targetPath: string,
  shouldCancel: () => boolean,
) {
  if (await sameFiles(sourcePath, targetPath)) return attItem;
  // Copy and verify first; the source is only removed after Zotero points at
  // the verified destination.
  const copied = await copyAttachmentFile(sourcePath, targetPath, {
    shouldCancel,
  });
  let created: Zotero.Item | undefined;
  attachmentMutationInFlight.add(attItem.id);
  try {
    if (attItem.isLinkedFileAttachment()) {
      const relinked = await attItem.relinkAttachmentFile(copied.path);
      if (
        !relinked ||
        !(await sameFiles(
          (await attItem.getFilePathAsync()) as string,
          copied.path,
        ))
      ) {
        await removeVerifiedAttachmentFile(copied.path, copied.fingerprint);
        throw new Error("Linked attachment did not accept the destination");
      }
      if (
        getPref("moveWithoutDeleting") !== true &&
        (await removeMovedSource(sourcePath, copied.sourceFingerprint, attItem))
      ) {
        await removeEmptyFolder(PathUtils.parent(sourcePath) as string);
      }
      return attItem;
    }
    try {
      // Zotero erases the stored file together with the old stored item.
      return await convertStoredAttachmentToLinked(attItem, copied.path, {
        shouldCancel,
        onCreated: (item) => {
          created = item;
          markCreatedAttachment(item);
        },
      });
    } catch (error) {
      await removeVerifiedAttachmentFile(copied.path, copied.fingerprint);
      throw error;
    }
  } finally {
    attachmentMutationInFlight.delete(attItem.id);
    if (created) attachmentMutationInFlight.delete(created.id);
  }
}

/** Keep the old file if it changed during the move or another item uses it. */
async function removeMovedSource(
  sourcePath: string,
  fingerprint: Parameters<typeof fingerprintMatches>[1],
  attItem: Zotero.Item,
) {
  try {
    if (
      isZoteroStoragePath(sourcePath) ||
      (await hasAttachmentFileReferences(sourcePath, attItem))
    ) {
      return false;
    }
    return await removeVerifiedAttachmentFile(sourcePath, fingerprint);
  } catch (error) {
    ztoolkit.log("Moved source was kept", sourcePath, error);
    return false;
  }
}

async function attachNewFile(options: {
  libraryID: number;
  parentItemID: number | undefined;
  collections: number[] | undefined;
}) {
  const sourceDirs = await getSourceDirs();
  if (!sourceDirs.length) return;
  const path = getLastFileInFolder(sourceDirs);
  if (!path) {
    new ztoolkit.ProgressWindow(config.addonName)
      .createLine({ text: "No File Found", type: "default" })
      .show();
  } else {
    const attItem = await runAttachmentOperation(async () => {
      let fingerprint: FileFingerprint | undefined;
      if (/\.pdf$/i.test(path) && options.parentItemID) {
        const parent = await Zotero.Items.getAsync(options.parentItemID);
        if (!parent || parent.deleted || !canEditAttachment(parent)) return;
        const cache = createAttachmentFingerprintCache();
        fingerprint = await fingerprintForMatching(path, cache);
        if (!fingerprint) {
          showAttachmentMatchMessage("attachment-file-unverified", {
            title: PathUtils.filename(path),
          });
          return;
        }
        if (
          await findDuplicatePDFAttachment(
            parent,
            path,
            cache,
            canReadPDFForItem(parent)
              ? createPDFIdentityCache(
                  getPDFData,
                  getPDFFulltext,
                  getPDFVisualIdentity,
                )
              : undefined,
          )
        ) {
          showAttachmentMatchMessage("attachment-duplicate-skipped", {
            title: PathUtils.filename(path),
          });
          return;
        }
        const verified = await fingerprintForMatching(path, cache);
        if (!verified || !matchingFileContent(verified, fingerprint)) return;
      }
      const attachment = await Zotero.Attachments.importFromFile({
        file: path,
        ...options,
      });
      await removeSourceFile(path, fingerprint);
      return attachment;
    });
    if (!attItem) return;
    showAttachmentItem(attItem);
    if (!attItem.parentItemID) {
      Zotero.RecognizeDocument.recognizeItems([attItem]);
    }
  }
}

function showAttachmentMatchMessage(
  key: string,
  args: Record<string, unknown>,
) {
  new ztoolkit.ProgressWindow(config.addonName, {
    closeTime: 6000,
    closeOtherProgressWindows: true,
  })
    .createLine({ text: getString(key, { args }), type: "default" })
    .show();
}

/**
 * Source-folder inputs are deleted after a successful import, as in earlier
 * versions, so "Attach New File" does not keep picking the same newest file.
 */
async function removeSourceFile(path: string, expected?: FileFingerprint) {
  if (!getPref("deleteSourceAfterImport")) return;
  if (ZoteroPane.getSelectedLibraryID() != Zotero.Libraries.userLibraryID) {
    return;
  }
  try {
    if (expected) {
      await removeVerifiedAttachmentFile(path, expected);
      return;
    }
    const file = Zotero.File.pathToFile(path);
    if (file.exists() && file.isFile()) file.remove(false);
  } catch (error) {
    ztoolkit.log("Cannot remove imported source file", path, error);
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
    return (
      getCollectionPath(collection.parentID) +
      addon.data.folderSep +
      collection.name
    );
  };
  const itemCollections = item.getCollections().map(getCollectionPath);
  if (selectedCollection) {
    const preferredCollection = [selectedCollection.id].map(
      getCollectionPath,
    )[0] as string;
    ztoolkit.log({ preferredCollection, itemCollections });
    const isExist = itemCollections.find((i) => i == preferredCollection);
    if (isExist) {
      return preferredCollection;
    }
    return itemCollections[0] || "";
  } else {
    ztoolkit.log({ itemCollections });
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
  if (!attItem) return false;
  const fileTypes = getPref("fileTypes") as string;
  if (!fileTypes) return true;
  const attachmentFilename = filename || attItem.attachmentFilename || "";
  const pos = attachmentFilename.lastIndexOf(".");
  const fileType =
    pos === -1 ? "" : attachmentFilename.slice(pos + 1).toLowerCase();
  return fileTypes
    .toLowerCase()
    .split(",")
    .map((type) => type.trim().replace(/^\./, ""))
    .includes(fileType);
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
  ztoolkit.log("showAttachmentItem", attItem);
  if (!attItem) {
    return;
  }
  const popupWin = new ztoolkit.ProgressWindow("Attanger", {
    closeTime: -1,
    closeOtherProgressWindows: true,
  });
  // 显示父行
  if (attItem && attItem.isTopLevelItem()) {
    popupWin
      .createLine({
        text: getSelectedCollectionCompat()?.name || "My Library",
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
  if (!getPref("autoRemoveEmptyFolder")) return;
  // Earlier versions cleaned below both plugin roots; the roots themselves
  // are never removed.
  const roots = [getPref("destDir"), ...getConfiguredSourceDirs()]
    .filter((root): root is string => typeof root === "string" && !!root)
    .map((root) => normalizeAttachmentPath(root).replace(/[\\/]+$/, ""))
    .filter(Boolean);
  if (!roots.length) return;
  const separator = Zotero.isWin ? "\\" : "/";
  let current = typeof path === "string" ? path : path.path;
  while (current) {
    const normalized = normalizeAttachmentPath(current);
    if (!roots.some((root) => normalized.startsWith(root + separator))) return;
    const directory = Zotero.File.pathToFile(current);
    if (!directory.isDirectory()) return;
    // Finder/Explorer metadata files do not keep a folder alive.
    const entries = directory.directoryEntries;
    const junk: nsIFile[] = [];
    while (entries.hasMoreElements()) {
      const entry = entries
        .getNext()
        .QueryInterface(Components.interfaces.nsIFile);
      if (entry.leafName !== ".DS_Store" && entry.leafName !== "Thumbs.db") {
        return;
      }
      junk.push(entry);
    }
    try {
      for (const entry of junk) entry.remove(false);
      directory.remove(false);
    } catch (error) {
      ztoolkit.log("Cannot remove empty folder", current, error);
      return;
    }
    const parent = PathUtils.parent(current) as string;
    if (parent === current) return;
    current = parent;
  }
}

/**
 * Existing download folders in their configured order. When none exists,
 * fall back to the old picker prompt for the primary folder.
 */
async function getSourceDirs() {
  const dirs: string[] = [];
  for (const dir of getConfiguredSourceDirs()) {
    if (await pathExists(dir, "directory")) dirs.push(dir);
  }
  if (dirs.length) return dirs;
  const dir = await checkDir("sourceDir", "source path");
  return typeof dir === "string" ? [dir] : [];
}

async function checkDir(prefName: string, prefDisplay: string, silent = false) {
  let dir = getPref(prefName);
  if (typeof dir !== "string" || !(await pathExists(dir, "directory"))) {
    if (silent) {
      new ztoolkit.ProgressWindow(config.addonName, { closeTime: 4000 })
        .createLine({
          text: getString(`dir-not-set-${prefName}`),
          type: "default",
        })
        .show();
      return false;
    }
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

function getNsIFileKind(file: any, kind: PathKind) {
  try {
    return kind === "directory" ? file.isDirectory() : file.isFile();
  } catch {
    return false;
  }
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

function canReadPDFForItem(
  item: Zotero.Item,
  setting = String(getPref("readPDFtitle") || "nonCJK").toLowerCase(),
) {
  return (
    setting !== "never" &&
    (setting === "always" || !CJK_RE.test(getPlainTitle(item)))
  );
}

function getPDFWorkerAction(
  actionName: "getRecognizerData" | "getFulltext" | "renderAnnotations",
  nativeMethod: unknown,
): string {
  if (typeof nativeMethod === "function") {
    // Follow the installed implementation, including beta/backported changes.
    // Probing an unknown action would leave the shared worker waiting forever.
    const source = Function.prototype.toString.call(nativeMethod);
    const action = source.match(
      new RegExp(
        `\\b_query\\s*\\(\\s*(["'])(pdf\\.${actionName}|${actionName})\\1`,
      ),
    );
    if (action) return action[2];
  }
  return parseInt(Zotero.version, 10) >= 11 ? `pdf.${actionName}` : actionName;
}

/** Read recognizer data from a path without creating a Zotero attachment. */
export async function getPDFData(path: string) {
  return queryPDFFile(
    path,
    getPDFWorkerAction("getRecognizerData", Zotero.PDFWorker.getRecognizerData),
    "recognizer",
  );
}

/** Full text is used only to verify re-encoded copies of the same article. */
export async function getPDFFulltext(path: string) {
  return queryPDFFile(
    path,
    getPDFWorkerAction("getFulltext", Zotero.PDFWorker.getFullText),
    "fulltext",
  );
}

/** Confirm every page, including figures, before treating re-encoded PDFs as copies. */
export async function getPDFVisualIdentity(path: string, totalPages: number) {
  const crypto = ztoolkit.getGlobal("crypto") as Crypto | undefined;
  if (
    !Number.isInteger(totalPages) ||
    totalPages < 1 ||
    totalPages > MAX_PDF_VISUAL_PAGES ||
    !crypto?.subtle ||
    getPDFWorkerAction(
      "renderAnnotations",
      (Zotero.PDFWorker as any).renderAttachmentAnnotations,
    ) !== "pdf.renderAnnotations"
  ) {
    // The old unnamespaced protocol has no confirmed full-page render action.
    return;
  }
  return withPDFWorkerDeadline(
    path,
    "visual verification",
    async (ensureActive) => {
      const bytes = await IOUtils.read(path);
      ensureActive();
      const pageHashes: string[] = [];
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        ensureActive();
        const buf = new Uint8Array(bytes).buffer;
        const result = await Zotero.PDFWorker._query(
          "pdf.renderArea",
          {
            buf,
            pageIndex,
            // The worker clips this rectangle to the actual (possibly negative) crop box.
            rect: [
              -Number.MAX_VALUE,
              -Number.MAX_VALUE,
              Number.MAX_VALUE,
              Number.MAX_VALUE,
            ],
            scale: 2,
          },
          [buf],
        );
        ensureActive();
        const image = result?.buf;
        if (
          Object.prototype.toString.call(image) !== "[object ArrayBuffer]" ||
          image.byteLength < 33 ||
          image.byteLength > 80 * 1024 * 1024
        ) {
          return;
        }
        const png = new Uint8Array(image);
        const header = new DataView(image);
        const width = header.getUint32(16);
        const height = header.getUint32(20);
        if (
          ![137, 80, 78, 71, 13, 10, 26, 10].every(
            (byte, i) => png[i] === byte,
          ) ||
          header.getUint32(8) !== 13 ||
          header.getUint32(12) !== 0x49484452 ||
          !width ||
          !height ||
          width * height > 16_777_216
        ) {
          return;
        }
        const hash = new Uint8Array(
          await crypto.subtle.digest("SHA-256", image),
        );
        ensureActive();
        pageHashes.push(
          Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(
            "",
          ),
        );
      }
      return { totalPages, pageHashes };
    },
  );
}

async function queryPDFFile(path: string, action: string, label: string) {
  return withPDFWorkerDeadline(path, label, async (ensureActive) => {
    const bytes = await IOUtils.read(path);
    ensureActive();
    const buf = new Uint8Array(bytes).buffer;
    let result;
    try {
      result = await Zotero.PDFWorker._query(action, { buf }, [buf]);
    } catch (e: any) {
      const error = new Error(`Worker '${action}' failed: ${e?.message || e}`);
      try {
        const details = JSON.parse(e.message);
        if (details.name) error.name = details.name;
      } catch {
        // Older workers also return plain-text errors.
      }
      ztoolkit.log(error);
      throw error;
    }
    ensureActive();
    ztoolkit.log(`Extracted PDF ${label} data for path ${path}`);
    return result;
  });
}

async function withPDFWorkerDeadline<T>(
  path: string,
  label: string,
  readAndQuery: (ensureActive: () => void) => Promise<T>,
) {
  let timeoutID: number | undefined;
  let expired = false;
  const timeoutError = new Error(
    `PDF ${label} timed out after ${PDF_RECOGNIZER_TIMEOUT_MS} ms`,
  );
  const ensureActive = () => {
    if (expired) throw timeoutError;
  };
  const timeoutTask = new Promise<never>((_, reject) => {
    timeoutID = window.setTimeout(() => {
      expired = true;
      ztoolkit.log(timeoutError, path);
      reject(timeoutError);
    }, PDF_RECOGNIZER_TIMEOUT_MS);
  });
  try {
    const workerTask = Zotero.PDFWorker._enqueue(async () => {
      ensureActive();
      // The deadline must reject inside the callback as well as outside the
      // queue, so a hung read/query cannot block unrelated Zotero PDF tasks.
      return Promise.race([readAndQuery(ensureActive), timeoutTask]);
    }, false);
    return await Promise.race([workerTask, timeoutTask]);
  } finally {
    if (timeoutID !== undefined) {
      window.clearTimeout(timeoutID);
    }
  }
}

function unregisterNotify(notifyID: string) {
  Zotero.Notifier.unregisterObserver(notifyID);
}

export function registerNotify(
  types: _ZoteroTypes.Notifier.Type[],
  onNotify: _ZoteroTypes.Notifier.Notify,
) {
  const callback = {
    notify: async (...data: Parameters<_ZoteroTypes.Notifier.Notify>) => {
      if (!addon?.data.alive) {
        unregisterNotify(notifyID);
        return;
      }
      await onNotify(...data);
    },
  };

  const notifyID = Zotero.Notifier.registerObserver(callback, types);
  return notifyID;
}
