# Zotero Attanger

<p>
  <img src="addon/chrome/content/icons/favicon.png" width="48" height="48" alt="Attanger icon">
</p>

Attanger (Attachment Manager) organizes Zotero attachments: attach recent
downloads, match files to items, rename them with Zotero's native templates,
and move or copy them into a predictable folder structure.

English | [简体中文](doc/README-zhCN.md) | [Deutsch](doc/README-de.md) | [Italiano](doc/README-itIT.md)

[![Latest release](https://img.shields.io/github/v/release/MuiseDestiny/zotero-attanger)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Release date](https://img.shields.io/github/release-date/MuiseDestiny/zotero-attanger)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Downloads](https://img.shields.io/github/downloads/MuiseDestiny/zotero-attanger/latest/total)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![License: AGPL-3.0-or-later](https://img.shields.io/github/license/MuiseDestiny/zotero-attanger)](LICENSE)
[![Zotero 7-10](https://img.shields.io/badge/Zotero-7--10-CC2936?logo=zotero&logoColor=white)](https://www.zotero.org/)

## Features

- Attach the most recently modified file from a configured source directory to
  one Zotero item or directly to a collection.
- Store attachments in Zotero or convert imported files to linked files in an
  external destination directory.
- Rename one or many attachments with Zotero's file-renaming template and,
  optionally, keep the attachment title in sync.
- Build destination subfolders from item metadata or `{{collection}}`, with
  optional `/`-delimited nested folders.
- Automatically rename and organize newly imported attachments.
- Optionally rename linked attachments after item metadata changes. Debounce
  and delay controls make this useful with Better BibTeX citation keys and
  other metadata that settles after import.
- Match PDF/CAJ files to selected items by title similarity, optionally using
  a title extracted from the PDF.
- Precisely reconnect files that already follow Attanger's expected folder and
  filename pattern.
- Move or copy existing attachments while preserving annotations, relations,
  full-text indexes, tags, and attachment notes during linked-file conversion.
- Open selected attachments with Zotero, the system default, or remembered
  custom applications.
- Customize shortcuts, supported extensions, cleanup behavior, and regular
  expression rules for rename/move exceptions.

## Install

1. Download the latest `.xpi` from the
   [Releases page](https://github.com/MuiseDestiny/zotero-attanger/releases).
2. In Zotero, open **Tools > Plugins** (or **Tools > Add-ons** on older
   versions).
3. Open the gear menu, choose **Install Plugin From File**, and select the
   downloaded `.xpi`.
4. Restart Zotero if prompted.

The current manifest supports Zotero 7 through Zotero 10.

## Initial Setup

Open **Zotero Settings > Attanger** and configure:

1. **Source path**: the folder where browsers, scanners, or other tools place
   newly downloaded files.
2. **Attach type**:
   - Choose **Stored Copy** when using Zotero Storage or WebDAV.
   - Choose **Link** when files are synchronized by another service such as
     OneDrive, Dropbox, or Nutstore.
3. When using **Link**, set a **Destination path** and keep **Automatically move
   added attachments** enabled if imported files should be converted
   automatically.
4. Set the optional **Subfolder** template. The default `{{collection}}` follows
   the selected item's collection hierarchy.
5. Use **Customize Filename Format** to edit Zotero's native file-renaming
   template. See the
   [Zotero file-renaming documentation](https://www.zotero.org/support/file_renaming).
6. Review the automation, file type, shortcut, and safety settings before a
   large batch operation.

Linked files are not uploaded by Zotero file sync. The destination directory
must be backed up or synchronized separately.

## Common Workflows

### Attach the Latest Download

1. Save or download a file into the configured source directory.
2. Select exactly one regular Zotero item.
3. Right-click and choose **Attanger > Attach New File**, or press `Ctrl + I`.

Attanger selects the most recently modified non-hidden file. You can also
right-click a collection and choose **Attach New File** to create a top-level
attachment in that collection. Unless **Keep original files** is enabled, the
source file is removed after a successful import.

### Match Files to Multiple Items

1. Put PDF or CAJ files directly in the source directory.
2. Select one or more regular Zotero items.
3. Choose **Attanger > Match Attachment**.

Each source file is used at most once. Matching compares item titles with file
names and can also inspect PDF metadata/text according to **Read title from PDF
file**. Matched files are imported and then follow the configured automatic
rename/move behavior.

### Reconnect an Existing Attanger Library

Use **Attanger > Match Attanger Attachment** when files already follow this
layout:

```text
Source path / rendered subfolder / Zotero-generated filename.extension
```

For each selected item, Attanger checks the configured extension list and adds
matching files as linked attachments without copying them.

### Rename, Move, or Copy Existing Attachments

Select regular items, child attachments, or top-level attachments, then use:

- **Rename Attachment** to apply Zotero's filename template.
- **Move Attachment** to place files under the destination path.
- **Rename and Move Attachment** to perform both operations.
- **Undo Move Attachment** to use Zotero's linked-file-to-stored-file
  conversion.

When **Keep original files** is enabled, menu labels change from Move to Copy
and source files are retained. Moving requires **Attach type: Link**. Different
files that target the same path receive a suffix; identical destination files
are not copied again.

### Rename After Better BibTeX Updates

When a filename template contains a Better BibTeX citation key or another
field that is populated after import:

1. Disable **Automatically rename added attachments** if add-time renaming runs
   too early.
2. Enable **Automatically rename linked attachments when items change**.
3. Keep the default debounce (`1000 ms`) or increase the optional delay if the
   metadata provider performs several updates.

This workflow only processes existing, supported linked files. Repeated item
events are deduplicated, and Attanger's own saves do not trigger a rename loop.

## Settings Reference

| Setting                                     | Behavior                                                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Source path                                 | Input directory for Attach New File and both matching commands.                                                                    |
| Attach type                                 | Stored Zotero copy, or linked file managed under the destination path.                                                             |
| Destination path                            | Root directory used by move/copy operations in Link mode.                                                                          |
| Subfolder                                   | Metadata template for directories; `{{collection}}` uses the collection path.                                                      |
| Parse `/` as subfolders                     | Preserves slash-separated levels generated by template variables.                                                                  |
| Automatically rename added attachments      | Uses Zotero's global add-time file-renaming preference.                                                                            |
| Rename linked attachments when items change | Opt-in post-edit rename flow, with debounce and delay in milliseconds.                                                             |
| Automatically move added attachments        | Converts newly imported attachments to linked files in Link mode. Existing linked attachments are never moved again automatically. |
| Automatically delete empty folders          | Removes empty directories only inside Zotero storage, the source root, or the destination root.                                    |
| Keep original files                         | Changes move operations to copy behavior and prevents source cleanup.                                                              |
| Sync attachment title                       | Updates the Zotero attachment title after a filename change.                                                                       |
| File types                                  | Comma-separated extensions, without leading dots. Default: `pdf,doc,docx,txt,rtf,djvu,epub`.                                       |
| Filename rules                              | Comma-separated regular expressions for prefix preservation, rename skipping, or automatic move/rename skipping.                   |

Invalid regular expressions are ignored and written to the debug log rather
than interrupting attachment processing.

## Shortcuts

Shortcuts are editable in Attanger settings and take effect immediately.

| Action               | Default            | Enabled by default |
| -------------------- | ------------------ | ------------------ |
| Attach New File      | `Ctrl + I`         | Yes                |
| Match Attachment     | `Ctrl + M`         | Yes                |
| Rename Attachment    | `Ctrl + R`         | No                 |
| Rename and Move/Copy | `Ctrl + Shift + R` | No                 |
| Move/Copy Attachment | `Ctrl + Shift + M` | No                 |

## Screenshots and Guides

<img width="300" alt="Attanger settings" src="https://github.com/user-attachments/assets/3125e608-7891-4afa-91f5-be8120a98988">
<img width="300" alt="Attanger item menu" src="https://github.com/user-attachments/assets/9414737c-5d3d-43f3-83be-cf39d8f9c2b7">
<img width="300" alt="Attanger workflow" src="https://github.com/user-attachments/assets/9c2ff395-66a1-4f1e-8e6a-7c90c3bc4121">

- [Video demonstration (Chinese)](https://www.bilibili.com/video/BV1x64y1J7Rv)
- [Community guide (French)](https://docs.zotero-fr.org/kbfr/kbfr_attanger_zotmoov/)

## Contributing

Issues, fixes, new features, tests, documentation, and translations are all
welcome. Small, focused pull requests are easier to review and safer to ship.

When reporting a bug, include the Zotero and Attanger versions, operating
system, attach type, relevant settings, exact reproduction steps, and debug
output. Remove private bibliographic data and local paths before posting logs.

To work on the plugin:

```bash
git clone https://github.com/MuiseDestiny/zotero-attanger.git
cd zotero-attanger
npm install
cp scripts/zotero-cmd-template.json scripts/zotero-cmd.json
# Edit scripts/zotero-cmd.json to use a dedicated Zotero test profile
npm start
```

Before opening a pull request:

```bash
npm run build
# Run ESLint on the TypeScript files you changed, for example:
npx eslint src/modules/menu.ts
```

The production XPI is written to `build/zotero-attanger.xpi`. Development uses
hot reload for changes under `src/` and `addon/`.

### AI-Assisted Contributions Are Welcome

You may use AI tools for implementation, debugging, tests, documentation, or
translation. AI use is not a reason to reject a contribution. The contributor
is still responsible for the submitted result:

- Review and understand generated changes before submitting them.
- Test the affected workflows and report what was actually verified.
- Keep changes scoped; do not include unrelated generated rewrites.
- Do not send private libraries, logs, credentials, or copyrighted documents
  to an AI service without permission.
- Confirm that generated code and assets are compatible with this project's
  license and dependency policies.
- Briefly disclose material AI assistance in the pull request when it helps
  reviewers understand how the change was produced or validated.

Translations live in `addon/locale/`; user documentation translations live in
`doc/`. Please keep keys and behavior descriptions aligned across languages.

## License and Credits

Zotero Attanger is licensed under
[AGPL-3.0-or-later](LICENSE). It draws significant inspiration from the ZotFile
attachment workflow and is built with the
[Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)
and [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit).
