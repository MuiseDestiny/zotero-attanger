directory = Root Directory:
choose-dir =
    .label = Choose…
setting = Settings

read-pdf-title = Read title from PDF
readPDFtitle-never =
    .label = Never
readPDFtitle-nonCJK =
    .label = Except for CJK
readPDFtitle-always =
    .label = Always

subfolder = Subfolder
slash-as-subfolder-delimiter =
    .label = Parse forward slashes (/) in variables as subfolder delimiters

auto-rename =
    .label = Automatically rename added attachments
auto-recognize-imported-pdf =
    .label = Recognize standalone imported PDFs
auto-rename-on-modify =
    .label = Automatically rename linked attachments when items change
auto-rename-on-modify-help =
    .tooltiptext = Why enable this: Zotero normally renames attachments when they are added, but existing linked files may keep old names after title, author, year, or Better BibTeX citation key changes. Enable this to keep linked filenames synchronized; leave it off if you prefer manual renaming.
    .aria-label = Automatic linked attachment renaming explanation
auto-rename-on-modify-debounce =
    .label = Rename-after-edit debounce (ms)
auto-rename-on-modify-debounce-help =
    .tooltiptext = Why it helps: one edit can emit several modification events and cause repeated renames. This value is the quiet period after the last change. Use 1000 ms normally, 1500–3000 ms if repeats remain, or 300–500 ms for faster response.
    .aria-label = Rename debounce explanation
auto-rename-on-modify-delay =
    .label = Rename-after-edit delay (ms)
auto-rename-on-modify-delay-help =
    .tooltiptext = Why it helps: Zotero or Better BibTeX may update titles, authors, years, or citation keys asynchronously, so renaming too soon can use old values. This is extra time after debouncing. Start with 300–1000 ms; use 1500–3000 ms if stale values remain, or disable it when unnecessary.
    .aria-label = Rename delay explanation
auto-move =
    .label = Automatically move new attachments to the storage directory
auto-remove-empty-folder =
    .label = Automatically delete empty folders after moving
move-without-deleting =
    .label = Keep original files (move becomes copy)
delete-source-after-import =
    .label = Delete the file from the download folder after attaching or matching it
file-types = Types of Attachments for Renaming/Moving
filename-as-prefix-rules = When the following naming rules are followed, the original filename will be retained as a prefix during renaming.
filename-rules-instructions = Please use regular expressions, separating multiple expressions with ','.
filename-skip-rename-rules = When the following naming rules are followed, attachments will not be renamed.
filename-skip-auto-move-rename-rules = When the following naming rules are followed, attachments will not be automatically moved, copied, or renamed.
about-title = About
about-intro = Attanger is an abbreviation for Attachment Manager, and this project heavily references the ZotFile plugin of Zotero version 6.
about-pro-plugins = More Plugins

preferences-file-renaming-customize-button =
    .label = Customize Filename Format…

attach-new-file-shortcut =
    .label = Attach New File
match-attachment-shortcut =
    .label = Match Attachment
rename-attachment-shortcut =
    .label = Rename Attachment
rename-move-attachment-shortcut =
    .label = Rename and Move/Sync Attachment
move-attachment-shortcut =
    .label = Move/Sync Attachment
sync-attachment-title =
    .label = Sync attachment title after renaming
remove-diacritics =
    .label = Remove diacritics from filenames

settings-required = Required

work-mode-title = Work Mode
work-mode-stored-label =
    .label = Zotero Storage Only
work-mode-linked-label =
    .label = External Links
work-mode-copy-label =
    .label = Zotero Storage + External Copy
work-mode-stored-description = Attachments stay in Zotero and use Zotero file sync. Renaming rules still apply.
work-mode-linked-description = Attachments move to an external directory and open through links. This is the former "Link" attach type.
work-mode-stored-footnote = No external directory needed
work-mode-linked-footnote = Cloud-drive sync · Personal library only
work-mode-copy-description = Attachments stay in Zotero, and an organized copy is kept in an external directory.
work-mode-copy-footnote = Zotero sync plus external access
work-mode-linked-directory = File Storage Directory
work-mode-copy-directory = Copy Directory
work-mode-directory-placeholder =
    .placeholder = Choose an external directory

work-mode-status-checking = Checking the directory…
work-mode-status-stored = Ready to use, no external directory needed
work-mode-status-ready = Setup complete
work-mode-status-missing = Choose an external directory to finish setup
work-mode-status-invalid = Directory unavailable; choose it again
work-mode-status-unsafe = Choose a directory outside Zotero storage
work-mode-status-readonly = Directory is not writable; choose another
work-mode-stored-renaming = New attachments are stored in Zotero and use the current renaming settings.
work-mode-stored-original-name = New attachments are stored in Zotero with their original filenames.
work-mode-linked-ready-note = "Move Attachment" puts files in this directory. Enable automatic moving below to move new attachments too.
work-mode-copy-ready-note = Zotero opens its stored files; copies update one way from Zotero.
work-mode-missing-note = Choose a directory to get started. Without one, attachments are not moved or copied.
work-mode-invalid-note = The directory may have been removed, moved, or unmounted. Choose an available directory.
work-mode-unsafe-note = Zotero's storage directory, or a path that leads into it (including through a symbolic link), cannot be used.
work-mode-readonly-note = Attanger needs write access. Check directory permissions or the sync drive's availability.
work-mode-summary-stored = Zotero Storage Only · Ready
work-mode-summary-linked = External Links · { $state ->
    [ready] Ready
    [checking] Checking
    [missing] Choose a directory
   *[other] Check the directory
    }
work-mode-summary-copy = Zotero Storage + External Copy · { $state ->
    [ready] Ready
    [checking] Checking
    [missing] Choose a directory
   *[other] Check the directory
    }

linked-options-title = Link Options
work-mode-linked-sync-note = Linked attachments do not use Zotero file sync; sync the directory with a cloud drive or another tool. Group-library attachments are not converted.
work-mode-copy-sync-title = About Copies
work-mode-copy-update = Copies follow the subfolder and filename rules. After renaming an attachment or changing its collections, the copy moves and the old one is cleaned up. Copies update one way from Zotero: a copy edited outside Zotero is never overwritten, and deleting the Zotero attachment keeps its copy. PDF copies do not include annotations stored in Zotero's database.
work-mode-official-sync-note = Zotero file sync (Zotero Storage or WebDAV) is configured as usual in Zotero's Sync settings.
work-mode-existing = Switching modes does not change existing attachments. To organize them, right-click an item and use "Move Attachment" or "Sync External Copy".
work-mode-scope = New attachments (Attanger, drag-and-drop, and Connector imports) are processed by the current mode; directly added linked files are not converted. Standalone PDFs are processed only after automatic recognition creates a parent item.

directory-naming-title = Attachment Names and Folders
organizing-rules-summary = { $mode ->
    [stored] Filename: { $rename ->
        [enabled] Current Zotero rules
       *[disabled] No automatic renaming
        }
   *[external] Subfolder: { $layout ->
        [collection] By collection
        [year] By year
        [flat] None
       *[custom] { $template }
        } · Filename: { $rename ->
        [enabled] Current Zotero rules
       *[disabled] No automatic renaming
        }
    }
filename-rule-title = Filename Rules
filename-zotero-rule-note = Uses Zotero's renaming settings. Edit them in Zotero's native editor.
subfolder-layout-collection =
    .label = By Zotero collection
subfolder-layout-year =
    .label = By year
subfolder-layout-flat =
    .label = No subfolders
subfolder-layout-custom =
    .label = Custom template…
subfolder-template-title = Subfolder Template
rules-preview-filename = Filename example
rules-preview-path = Output path example
rules-preview-unconfigured = Selected directory/{ $path }
rules-preview-unavailable = Cannot preview the current rule; check the template in Zotero's renaming editor.
rules-preview-note = Example: Wang, 2026, Learning representations, in the Machine Learning collection. Real attachments are not modified.
rules-preview-skipped = The example paper-2026.pdf is excluded by the current file types or filename exceptions; automatic processing keeps its location and filename.

source-import-title = Download Folder
source-import-optional-note = Used by "Attach New File" and "Match Attachment"
source-directory-title = Download folder paths
source-directory-placeholder =
    .placeholder = Not configured; ordinary imports still work
add-source-dir =
    .label = Add Folder…
remove-source-dir =
    .label = Remove
source-directory-note = "Attach New File" takes the newest file across all folders; "Match Attachment" searches them in order.

automatic-processing-title = Automatic Processing
more-settings-summary = PDF recognition, rename after edits, naming exceptions
auto-recognize-imported-pdf-note = Processing runs after recognition creates a parent item. If disabled or unsuccessful, the PDF is left as is.
rename-timing-title = Adjust waiting time after edits
automatic-processing-scope-title = Which imports are processed automatically?
filename-exceptions-title = File Types and Naming Exceptions
shortcuts-title = Keyboard Shortcuts
shortcuts-summary = Check to enable, then click a field and press a key combination
