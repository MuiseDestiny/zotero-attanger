directory = Stammverzeichnis:
choose-dir =
    .label = Auswählen...
setting = Einstellungen
read-pdf-title = Titel aus PDF lesen
readPDFtitle-never =
    .label = Nie
readPDFtitle-nonCJK =
    .label = Außer für CJK
readPDFtitle-always =
    .label = Immer
subfolder = Unterordner
slash-as-subfolder-delimiter =
    .label = Schrägstriche (/) in Variablen als Unterverzeichnis-Trennzeichen interpretieren
auto-rename =
    .label = Hinzugefügte Anhänge automatisch umbenennen
auto-recognize-imported-pdf =
    .label = Eigenständig importierte PDFs erkennen
auto-rename-on-modify =
    .label = Verknüpfte Anhänge bei Änderungen am Eintrag automatisch umbenennen
auto-rename-on-modify-help =
    .tooltiptext = Warum aktivieren: Zotero benennt Anhänge normalerweise beim Hinzufügen um; vorhandene verknüpfte Dateien können nach Änderungen an Titel, Autor, Jahr oder Better-BibTeX-Zitierschlüssel den alten Namen behalten. Aktivieren, um Dateinamen automatisch zu synchronisieren; für manuelles Umbenennen deaktiviert lassen.
    .aria-label = Erklärung zur automatischen Umbenennung verknüpfter Anhänge
auto-rename-on-modify-debounce =
    .label = Entprellzeit für Umbenennung nach Bearbeitung (ms)
auto-rename-on-modify-debounce-help =
    .tooltiptext = Warum nötig: Eine Bearbeitung kann mehrere Änderungsereignisse und wiederholte Umbenennungen auslösen. Der Wert ist die Ruhezeit nach der letzten Änderung. Normalerweise 1000 ms, bei Wiederholungen 1500–3000 ms, für schnellere Reaktion 300–500 ms verwenden.
    .aria-label = Erklärung zur Entprellzeit der Umbenennung
auto-rename-on-modify-delay =
    .label = Verzögerung für Umbenennung nach Bearbeitung (ms)
auto-rename-on-modify-delay-help =
    .tooltiptext = Warum nötig: Zotero oder Better BibTeX können Titel, Autor, Jahr oder Zitierschlüssel asynchron aktualisieren; zu frühes Umbenennen verwendet alte Werte. Dies ist zusätzliche Wartezeit nach der Entprellung. Mit 300–1000 ms beginnen, bei alten Werten 1500–3000 ms verwenden oder sonst deaktivieren.
    .aria-label = Erklärung zur Verzögerung der Umbenennung
auto-move =
    .label = Neue Anhänge automatisch in das Speicherverzeichnis verschieben
auto-remove-empty-folder =
    .label = Leere Ordner nach dem Verschieben automatisch löschen
move-without-deleting =
    .label = Originaldateien behalten (Verschieben wird zu Kopieren)
delete-source-after-import =
    .label = Datei nach dem Anhängen oder Zuordnen aus dem Download-Ordner löschen
file-types = Anhangtypen zum Umbenennen/Verschieben
filename-as-prefix-rules = Bei Einhaltung der folgenden Namensregeln bleibt der ursprüngliche Dateiname beim Umbenennen als Präfix erhalten.
filename-rules-instructions = Bitte verwenden Sie reguläre Ausdrücke und trennen Sie mehrere Ausdrücke mit ','.
filename-skip-rename-rules = Bei Einhaltung der folgenden Namensregeln werden Anhänge nicht umbenannt.
filename-skip-auto-move-rename-rules = Bei Einhaltung der folgenden Namensregeln werden Anhänge nicht automatisch verschoben, kopiert oder umbenannt.
about-title = Über Attanger
about-intro = Attanger ist eine Abkürzung für Attachment Manager; dieses Projekt orientiert sich stark am ZotFile-Plugin für Zotero 6.
about-pro-plugins = Weitere Plugins
preferences-file-renaming-customize-button =
    .label = Dateinamenformat anpassen...
attach-new-file-shortcut =
    .label = Neue Datei anhängen
match-attachment-shortcut =
    .label = Anhang zuordnen
rename-attachment-shortcut =
    .label = Anhang umbenennen
rename-move-attachment-shortcut =
    .label = Anhang umbenennen und verschieben/synchronisieren
move-attachment-shortcut =
    .label = Anhang verschieben/synchronisieren
sync-attachment-title =
    .label = Anhangtitel nach Umbenennung synchronisieren
remove-diacritics =
    .label = Diakritische Zeichen aus Dateinamen entfernen
settings-required = Erforderlich
work-mode-title = Arbeitsmodus
work-mode-stored-label =
    .label = Nur Zotero-Speicher
work-mode-linked-label =
    .label = Externe Links
work-mode-copy-label =
    .label = Zotero-Speicher + externe Kopie
work-mode-stored-description = Anhänge bleiben in Zotero und nutzen die Zotero-Dateisynchronisierung. Umbenennungsregeln gelten weiterhin.
work-mode-linked-description = Anhänge werden in ein externes Verzeichnis verschoben und über Links geöffnet. Entspricht dem früheren Anhangtyp „Link“.
work-mode-stored-footnote = Kein externes Verzeichnis nötig
work-mode-linked-footnote = Cloud-Synchronisierung · Nur eigene Bibliothek
work-mode-copy-description = Anhänge bleiben in Zotero, zusätzlich wird eine geordnete Kopie in einem externen Verzeichnis gepflegt.
work-mode-copy-footnote = Zotero-Sync plus externer Zugriff
work-mode-linked-directory = Speicherverzeichnis
work-mode-copy-directory = Kopienverzeichnis
work-mode-directory-placeholder =
    .placeholder = Externes Verzeichnis auswählen
work-mode-status-checking = Verzeichnis wird geprüft…
work-mode-status-stored = Sofort einsatzbereit, kein externes Verzeichnis nötig
work-mode-status-ready = Einrichtung abgeschlossen
work-mode-status-missing = Externes Verzeichnis auswählen, um die Einrichtung abzuschließen
work-mode-status-invalid = Verzeichnis nicht verfügbar; bitte erneut auswählen
work-mode-status-unsafe = Verzeichnis außerhalb des Zotero-Speichers wählen
work-mode-status-readonly = Verzeichnis ist schreibgeschützt; bitte ein anderes wählen
work-mode-stored-renaming = Neue Anhänge werden in Zotero gespeichert und nach den aktuellen Regeln umbenannt.
work-mode-stored-original-name = Neue Anhänge werden mit ihrem ursprünglichen Dateinamen in Zotero gespeichert.
work-mode-linked-ready-note = „Anhang verschieben“ legt Dateien in diesem Verzeichnis ab. Aktivieren Sie unten das automatische Verschieben, damit auch neue Anhänge verschoben werden.
work-mode-copy-ready-note = Zotero öffnet seine gespeicherten Dateien; Kopien werden einseitig aus Zotero aktualisiert.
work-mode-missing-note = Wählen Sie ein Verzeichnis. Ohne Verzeichnis werden Anhänge weder verschoben noch kopiert.
work-mode-invalid-note = Das Verzeichnis wurde möglicherweise gelöscht, verschoben oder ist nicht eingebunden. Wählen Sie ein verfügbares Verzeichnis.
work-mode-unsafe-note = Das Zotero-Speicherverzeichnis oder ein Pfad, der (auch über einen symbolischen Link) hineinführt, kann nicht verwendet werden.
work-mode-readonly-note = Attanger benötigt Schreibzugriff. Prüfen Sie die Berechtigungen oder den Zustand des Sync-Laufwerks.
work-mode-summary-stored = Nur Zotero-Speicher · Bereit
work-mode-summary-linked = Externe Links · { $state ->
    [ready] Bereit
    [checking] Wird geprüft
    [missing] Verzeichnis wählen
   *[other] Verzeichnis prüfen
    }
work-mode-summary-copy = Zotero-Speicher + externe Kopie · { $state ->
    [ready] Bereit
    [checking] Wird geprüft
    [missing] Verzeichnis wählen
   *[other] Verzeichnis prüfen
    }
linked-options-title = Link-Optionen
work-mode-linked-sync-note = Verknüpfte Anhänge nutzen keine Zotero-Dateisynchronisierung; synchronisieren Sie das Verzeichnis mit einem Cloud-Laufwerk. Anhänge in Gruppenbibliotheken werden nicht umgewandelt.
work-mode-copy-sync-title = Über Kopien
work-mode-copy-update = Kopien folgen den Unterordner- und Dateinamensregeln. Nach dem Umbenennen eines Anhangs oder dem Ändern seiner Sammlungen wird die Kopie verschoben und die alte entfernt. Kopien werden nur aus Zotero aktualisiert: Außerhalb bearbeitete Kopien werden nie überschrieben, und beim Löschen des Zotero-Anhangs bleibt die Kopie erhalten. PDF-Kopien enthalten keine in der Zotero-Datenbank gespeicherten Anmerkungen.
work-mode-official-sync-note = Die Zotero-Dateisynchronisierung (Zotero Storage oder WebDAV) wird wie gewohnt in den Sync-Einstellungen von Zotero konfiguriert.
work-mode-existing = Ein Moduswechsel ändert vorhandene Anhänge nicht. Zum Ordnen klicken Sie mit der rechten Maustaste auf einen Eintrag und wählen „Anhang verschieben“ oder „Externe Kopie synchronisieren“.
work-mode-scope = Neue Anhänge (Attanger, Drag-and-drop und Connector) werden nach dem aktuellen Modus verarbeitet; direkt hinzugefügte verknüpfte Dateien werden nicht umgewandelt. Eigenständige PDFs werden erst verarbeitet, nachdem die automatische Erkennung einen übergeordneten Eintrag erstellt hat.
directory-naming-title = Anhangnamen und Ordner
organizing-rules-summary = { $mode ->
    [stored] Dateiname: { $rename ->
        [enabled] Aktuelle Zotero-Regeln
       *[disabled] Keine automatische Umbenennung
        }
   *[external] Unterordner: { $layout ->
        [collection] Nach Sammlung
        [year] Nach Jahr
        [flat] Keine
       *[custom] { $template }
        } · Dateiname: { $rename ->
        [enabled] Aktuelle Zotero-Regeln
       *[disabled] Keine automatische Umbenennung
        }
    }
filename-rule-title = Dateinamensregeln
filename-zotero-rule-note = Verwendet die Umbenennungseinstellungen von Zotero. Bearbeiten Sie sie im nativen Zotero-Editor.
subfolder-layout-collection =
    .label = Nach Zotero-Sammlung
subfolder-layout-year =
    .label = Nach Jahr
subfolder-layout-flat =
    .label = Keine Unterordner
subfolder-layout-custom =
    .label = Eigene Vorlage…
subfolder-template-title = Unterordner-Vorlage
rules-preview-filename = Beispiel-Dateiname
rules-preview-path = Beispiel-Ausgabepfad
rules-preview-unconfigured = Ausgewähltes Verzeichnis/{ $path }
rules-preview-unavailable = Vorschau nicht möglich; prüfen Sie die Vorlage im Zotero-Umbenennungseditor.
rules-preview-note = Beispiel: Wang, 2026, Learning representations, Sammlung Machine Learning. Echte Anhänge werden nicht verändert.
rules-preview-skipped = Die Beispieldatei paper-2026.pdf ist durch die aktuellen Dateitypen oder Ausnahmen ausgeschlossen; die automatische Verarbeitung behält Ort und Dateinamen bei.
source-import-title = Download-Ordner
source-import-optional-note = Wird von „Neue Datei anhängen“ und „Anhang zuordnen“ verwendet
source-directory-title = Pfade der Download-Ordner
source-directory-placeholder =
    .placeholder = Nicht festgelegt; normale Importe funktionieren weiterhin
add-source-dir =
    .label = Ordner hinzufügen…
remove-source-dir =
    .label = Entfernen
source-directory-note = „Neue Datei anhängen“ nimmt die neueste Datei aus allen Ordnern; „Anhang zuordnen“ durchsucht sie der Reihe nach.
automatic-processing-title = Automatische Verarbeitung
more-settings-summary = PDF-Erkennung, Umbenennen nach Bearbeitung, Namensausnahmen
auto-recognize-imported-pdf-note = Die Verarbeitung beginnt, nachdem die Erkennung einen übergeordneten Eintrag erstellt hat. Ist sie deaktiviert oder erfolglos, bleibt das PDF unverändert.
rename-timing-title = Wartezeit nach der Bearbeitung anpassen
automatic-processing-scope-title = Welche Importe werden automatisch verarbeitet?
filename-exceptions-title = Dateitypen und Namensausnahmen
shortcuts-title = Tastenkürzel
shortcuts-summary = Zum Aktivieren anhaken, dann ins Feld klicken und Tastenkombination drücken
