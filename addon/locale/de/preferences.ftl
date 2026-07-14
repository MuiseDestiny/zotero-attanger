directory = Stammverzeichnis:
choose-dir =
    .label = Auswählen...
setting = Einstellungen

source-title = Quellpfad
source-intro = &lt;Neue Datei anhängen&gt; ruft die zuletzt hinzugefügte Datei aus diesem Verzeichnis ab und hängt sie an das Zotero-Element/die Zotero-Sammlung an.

read-pdf-title = Titel aus PDF-Datei lesen:
readPDFtitle-never =
    .label = Nie
readPDFtitle-nonCJK =
    .label = Außer für CJK
readPDFtitle-always =
    .label = Immer

attach-title = Anhangtyp
attach-intro = Wenn Sie die offizielle Zotero- oder WebDAV-Synchronisierung verwenden, wählen Sie &lt;Gespeicherte Kopie&gt;. Wenn Sie eine Drittanbieter-Synchronisierung wie Nutstore, OneDrive usw. verwenden, wählen Sie &lt;Link&gt; und konfigurieren Sie den &lt;Zielpfad&gt; ordnungsgemäß. Dateien werden in den Zielpfad verschoben und dann als Link-Anhang in Zotero importiert.
attach-type-start = Datei anhängen
attach-type-end = an das Zotero-Element/die Zotero-Sammlung
importing =
    .label = Gespeicherte Kopie
linking =
    .label = Link

dest-title = Zielpfad
dest-intro = &lt;Anhang verschieben&gt; verschiebt den Anhang in diesen Pfad, und der endgültige Dateipfad lautet &lt;Stammverzeichnis/Unterverzeichnis/Dateiname&gt;. Lassen Sie dieses Feld leer, wenn kein &lt;Unterverzeichnis&gt; benötigt wird.
subfolder = Unterverzeichnis:

slash-as-subfolder-delimiter =
    .label = Schrägstriche (/) in Variablen als Unterverzeichnis-Trennzeichen interpretieren

filename = Dateiname:

other-title = Andere Einstellungen
auto-rename =
    .label = Hinzugefügte Anhänge automatisch umbenennen
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
    .label = Hinzugefügte Anhänge automatisch verschieben
auto-remove-empty-folder =
    .label = Leere Ordner nach dem Verschieben automatisch löschen
move-without-deleting = 
    .label = Originaldateien behalten (Quelldateien nie löschen); Verschieben wird zu Kopieren
file-types = Arten von Anhängen zur Umbenennung/Verschiebung
filename-as-prefix-rules = Bei Einhaltung der folgenden Namensregeln bleibt der ursprüngliche Dateiname beim Umbenennen als Präfix erhalten.
filename-rules-instructions = Bitte verwenden Sie reguläre Ausdrücke und trennen Sie mehrere Ausdrücke mit ','.
filename-skip-rename-rules = Bei Einhaltung der folgenden Namensregeln werden Anhänge nicht umbenannt.
filename-skip-auto-move-rename-rules = Bei Einhaltung der folgenden Namensregeln werden Anhänge nicht automatisch verschoben oder umbenannt.
about-title = Über Attanger
about-intro = 🌠 Frohes Neues Jahr! Attanger ist eine Abkürzung für Attachment Manager, und dieses Projekt bezieht sich stark auf das ZotFile-Plugin der Zotero-Version 6.


preferences-file-renaming-customize-button =
    .label = Dateinamenformat anpassen...

preferences-file-renaming-format-instructions-more = Weitere Informationen finden Sie in der <label data-l10n-name="file-renaming-format-help-link">Dokumentation</label>.

attach-new-file-shortcut = 
    .label = Shortcut for Attach New File
match-attachment-shortcut = 
    .label = Shortcut for Match Attachment
rename-attachment-shortcut =
    .label = Shortcut for Rename Attachment
rename-move-attachment-shortcut =
    .label = Shortcut for Rename and Move/Copy Attachment
move-attachment-shortcut =
    .label = Shortcut for Move/Copy Attachment
sync-attachment-title = 
    .label = Anhangtitel nach Umbenennung synchronisieren
