import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
  trashUnusedPDFs,
  type UnusedPDF,
  type UnusedPDFScan,
} from "./unusedPDFs";

type PreviewWindow = Window & {
  document: Document & { createXULElement: (name: string) => Element };
};

/** Native chrome document, as in Zotero's renameFilesPreview independent window. */
export async function previewUnusedPDFs(
  scan: UnusedPDFScan,
  isActive: () => boolean,
  onOpen: (close: () => void) => void = () => undefined,
) {
  const text = (key: string, args?: Record<string, unknown>) =>
    getString(key, { args });
  await new Promise<void>((resolve, reject) => {
    const args: {
      wrappedJSObject?: unknown;
      init: (win: PreviewWindow) => void;
    } = {
      init: (win) => {
        try {
          if (win.closed) return;
          initializePreview(win, scan, isActive, text);
        } catch (error) {
          reject(error);
          win.close();
        }
      },
    };
    args.wrappedJSObject = args;
    const win = Services.ww.openWindow(
      null,
      `chrome://${config.addonRef}/content/unusedPDFPreview.xhtml`,
      "_blank",
      "chrome,dialog=no,centerscreen,resizable,width=860,height=640",
      args,
    ) as unknown as PreviewWindow;
    win.addEventListener("unload", () => resolve(), { once: true });
    onOpen(() => {
      if (!win.closed) win.close();
    });
  });
}

function initializePreview(
  win: PreviewWindow,
  scan: UnusedPDFScan,
  isActive: () => boolean,
  text: (key: string, args?: Record<string, unknown>) => string,
) {
  if (!isActive()) {
    win.close();
    return;
  }
  const doc = win.document;
  const node = <T extends Element = HTMLElement>(id: string) =>
    doc.getElementById(id) as unknown as T;
  const selected = new Set<UnusedPDF>();
  const checkboxes: HTMLInputElement[] = [];
  const accept = node<HTMLButtonElement>("unused-pdf-trash");
  const selectAll = node<HTMLInputElement>("unused-pdf-select-all");
  let busy = false;
  win.document.title = text("unused-pdf-title");
  node("unused-pdf-summary").textContent = text("unused-pdf-preview", {
    count: scan.files.length,
    size: (
      scan.files.reduce((sum, file) => sum + file.fingerprint.size, 0) / 1048576
    ).toFixed(1),
    skipped: scan.skipped,
  });
  node("unused-pdf-warning").textContent = text("unused-pdf-warning");
  const foreign = node<HTMLElement>("unused-pdf-foreign");
  foreign.hidden = !scan.foreignReferences;
  if (scan.foreignReferences)
    foreign.textContent = text("unused-pdf-foreign-note", {
      count: scan.foreignReferences,
    });
  node("unused-pdf-root").textContent = scan.root;
  node("unused-pdf-root").setAttribute("title", scan.root);
  node("unused-pdf-list").setAttribute("aria-label", text("unused-pdf-title"));
  node("unused-pdf-select-all-text").textContent = text(
    "unused-pdf-select-all",
  );
  node("unused-pdf-cancel").setAttribute("label", text("unused-pdf-cancel"));
  accept.setAttribute("label", text("unused-pdf-trash"));
  const updateSelection = () => {
    accept.disabled = busy || !selected.size;
    selectAll.checked =
      selected.size === scan.files.length && selected.size > 0;
    selectAll.indeterminate =
      selected.size > 0 && selected.size < scan.files.length;
    node("unused-pdf-selected").textContent = text("unused-pdf-selected", {
      count: selected.size,
      size: (
        [...selected].reduce((sum, file) => sum + file.fingerprint.size, 0) /
        1048576
      ).toFixed(1),
    });
  };
  const html = (name: string) =>
    doc.createElementNS("http://www.w3.org/1999/xhtml", name) as HTMLElement;
  const list = node("unused-pdf-list");
  const fragment = doc.createDocumentFragment();
  scan.files.forEach((file, index) => {
    const row = html("div");
    row.className = "unused-pdf-row";
    const checkbox = html("input") as HTMLInputElement;
    checkbox.type = "checkbox";
    checkbox.id = `unused-pdf-file-${index}`;
    checkbox.setAttribute("aria-label", file.relativePath);
    checkbox.addEventListener("change", () => {
      if (busy) return;
      if (checkbox.checked) selected.add(file);
      else selected.delete(file);
      updateSelection();
    });
    checkboxes.push(checkbox);
    const label = html("label");
    label.className = "unused-pdf-name";
    label.setAttribute("for", checkbox.id);
    label.setAttribute("title", file.path);
    const parts = file.relativePath.split(/[\\/]/);
    const filename = html("span");
    filename.textContent = parts.pop() || file.relativePath;
    const directory = html("span");
    directory.className = "unused-pdf-note";
    directory.textContent = parts.join(Zotero.isWin ? "\\" : "/") || ".";
    label.append(filename, directory);
    const size = html("span");
    size.className = "unused-pdf-size";
    size.textContent = `${(file.fingerprint.size / 1048576).toFixed(2)} MB`;
    const reveal = doc.createXULElement("button");
    reveal.setAttribute("class", "unused-pdf-reveal");
    reveal.setAttribute("label", text("unused-pdf-reveal"));
    reveal.addEventListener("command", () => {
      void Zotero.File.reveal(file.path).catch((error) => ztoolkit.log(error));
    });
    row.append(checkbox, label, size, reveal);
    fragment.append(row);
  });
  list.append(fragment);
  selectAll.addEventListener("change", () => {
    if (busy) return;
    const checked = selectAll.checked;
    selected.clear();
    checkboxes.forEach((checkbox, index) => {
      checkbox.checked = checked;
      if (checked) selected.add(scan.files[index]);
    });
    updateSelection();
  });
  node("unused-pdf-cancel").addEventListener("command", () => win.close());
  accept.addEventListener("command", async () => {
    if (busy || !selected.size || !isActive()) return;
    if (
      !Services.prompt.confirm(
        win,
        text("unused-pdf-title"),
        text("unused-pdf-confirm", { count: selected.size }),
      )
    )
      return;
    busy = true;
    updateSelection();
    selectAll.disabled = true;
    checkboxes.forEach((checkbox) => {
      checkbox.disabled = true;
    });
    node("unused-pdf-progress").textContent = text("unused-pdf-recycling");
    try {
      const result = await trashUnusedPDFs(
        scan,
        [...selected],
        () => isActive() && !win.closed,
      );
      if (!win.closed)
        Services.prompt.alert(
          win,
          text("unused-pdf-title"),
          text("unused-pdf-result", result),
        );
    } catch (error) {
      ztoolkit.log("Unused PDF cleanup failed", error);
      if (!win.closed)
        Services.prompt.alert(
          win,
          text("unused-pdf-title"),
          text("unused-pdf-error"),
        );
    } finally {
      if (!win.closed) win.close();
    }
  });
  updateSelection();
}
