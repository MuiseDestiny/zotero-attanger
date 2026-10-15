# Zotero Attanger

<p>
  <img src="../addon/chrome/content/icons/favicon.png" width="48" height="48" alt="Attanger-Symbol">
</p>

Attanger (Attachment Manager) organisiert Zotero-Anhänge: neue Downloads
anhängen, Dateien Einträgen zuordnen, sie mit Zoteros nativen Vorlagen
umbenennen und in eine nachvollziehbare Ordnerstruktur verschieben oder
kopieren.

[English](../README.md) | [简体中文](README-zhCN.md) | Deutsch | [Italiano](README-itIT.md)

[![Neueste Version](https://img.shields.io/github/v/release/MuiseDestiny/zotero-attanger)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Veröffentlichungsdatum](https://img.shields.io/github/release-date/MuiseDestiny/zotero-attanger)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Downloads](https://img.shields.io/github/downloads/MuiseDestiny/zotero-attanger/latest/total)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Lizenz: AGPL-3.0-or-later](https://img.shields.io/github/license/MuiseDestiny/zotero-attanger)](../LICENSE)
[![Zotero 7-10](https://img.shields.io/badge/Zotero-7--10-CC2936?logo=zotero&logoColor=white)](https://www.zotero.org/)

## Funktionen

- **Drei Arbeitsmodi**: Anhänge im Zotero-Speicher behalten, als verknüpfte
  Dateien in einen eigenen Ordner verschieben oder in Zotero behalten und
  zusätzlich eine geordnete Kopie in einem externen Ordner pflegen.
- **Native Umbenennung**: Anhänge mit Zoteros Dateinamenformat umbenennen,
  optional mit Titelsynchronisierung, Entfernen diakritischer Zeichen und
  Ausnahmen per regulärem Ausdruck.
- **Ordnerstruktur**: Unterordner aus Sammlungen, Jahren oder beliebigen
  Zotero-Vorlagenvariablen bilden; ein `/` in einem Wert kann verschachtelte
  Ordner erzeugen.
- **Download-Ordner**: den neuesten Download an einen Eintrag oder eine
  Sammlung anhängen oder mehrere PDFs per Titel den ausgewählten Einträgen
  zuordnen.
- **Automatische Verarbeitung**: Anhänge aus Attanger, per Drag-and-drop oder
  über den Zotero Connector werden passend zum aktuellen Modus umbenannt und
  einsortiert.
- **Umbenennen nach Bearbeitung**: Namen verknüpfter Dateien bleiben aktuell,
  wenn sich Titel, Autoren, Jahr oder Better-BibTeX-Zitierschlüssel ändern.
- **Sichere Dateibehandlung**: Beim Verschieben eines gespeicherten Anhangs
  bleiben Anmerkungen, Notizen, Tags, Beziehungen und Volltextindex erhalten;
  vorhandene Dateien werden nie überschrieben.
- **Extras**: Anhänge mit einer anderen Anwendung öffnen und die wichtigsten
  Befehle über einstellbare Tastenkürzel ausführen.

## Installation

1. Die aktuelle `.xpi` von der
   [Releases-Seite](https://github.com/MuiseDestiny/zotero-attanger/releases)
   herunterladen.
2. In Zotero **Werkzeuge > Plugins** öffnen (in älteren Versionen
   **Werkzeuge > Add-ons**).
3. Auf das Zahnrad klicken, **Plugin aus Datei installieren...** wählen und
   die heruntergeladene `.xpi` auswählen.
4. Zotero neu starten, falls dazu aufgefordert wird.

Attanger unterstützt Zotero 7 bis 10.

## Schnellstart

### Arbeitsmodus wählen

|                       | Nur Zotero-Speicher     | Externe Links                        | Zotero-Speicher + externe Kopie  |
| --------------------- | ----------------------- | ------------------------------------ | -------------------------------- |
| Zotero öffnet         | die gespeicherte Datei  | die verknüpfte Datei                 | die gespeicherte Datei           |
| Dateisynchronisierung | Zotero Storage / WebDAV | Cloud-Laufwerk oder anderes Werkzeug | Zotero Storage / WebDAV          |
| Externes Verzeichnis  | nicht nötig             | erforderlich; Dateien liegen dort    | erforderlich; enthält die Kopien |
| Bibliotheken          | alle                    | nur bearbeitbare eigene Bibliothek   | alle                             |

- **Nur Zotero-Speicher**: Sie synchronisieren Dateien mit Zotero Storage oder
  WebDAV und möchten nur einheitliche Dateinamen.
- **Externe Links**: Die Dateien sollen in Ihrem eigenen Ordner liegen und von
  OneDrive, Dropbox, Nutstore oder einem ähnlichen Dienst synchronisiert
  werden.
- **Zotero-Speicher + externe Kopie**: Sie möchten die Zotero-Dateisynchronisierung
  behalten und zusätzlich einen geordneten Ordner außerhalb von Zotero nutzen.

### Erste Schritte

1. Die Zotero-**Einstellungen** öffnen (**Bearbeiten > Einstellungen** unter
   Windows und Linux, **Zotero > Einstellungen** unter macOS) und
   **Attanger** wählen.
2. Unter **Arbeitsmodus** einen Modus wählen. Für die externen Modi auf
   **Auswählen...** klicken, einen Ordner wählen und auf **Einrichtung
   abgeschlossen** warten.
3. Unter **Anhangnamen und Ordner** Dateinamensregeln, Unterordner und die
   Pfadvorschau prüfen.
4. Für **Neue Datei anhängen** oder **Anhang zuordnen** den Download-Ordner
   unter **Download-Ordner** eintragen.
5. Zuerst einige Einträge ausprobieren, bevor Sie eine große Auswahl
   verarbeiten.
6. Ein Moduswechsel ändert vorhandene Anhänge nicht. Zum Ordnen Einträge
   auswählen, rechts klicken und **Attanger > Anhang verschieben** oder
   **Attanger > Externe Kopie synchronisieren** wählen.

## Einstellungen

Die Einstellungen sind in aufklappbare Abschnitte gegliedert; jede Kopfzeile
zeigt eine kurze Zusammenfassung. Anfangs ist nur **Arbeitsmodus** geöffnet;
eine Suche in den Zotero-Einstellungen öffnet vorübergehend alle Abschnitte.

Die Screenshots zeigen die chinesische Oberfläche mit Beispieleinstellungen;
die Standardwerte stehen in der [Einstellungsreferenz](#einstellungsreferenz).

### Arbeitsmodus

<p>
  <img src="images/settings-work-mode.png" width="560" alt="Arbeitsmodus mit Nur Zotero-Speicher">
</p>

| Modus                               | Verhalten                                                                                                          | Verzeichnis             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| **Nur Zotero-Speicher**             | Anhänge bleiben in Zotero und nutzen die Zotero-Dateisynchronisierung. Umbenennungsregeln gelten weiterhin.        | keins                   |
| **Externe Links**                   | Anhänge werden in ein externes Verzeichnis verschoben und über Links geöffnet. Entspricht dem früheren Typ „Link“. | **Speicherverzeichnis** |
| **Zotero-Speicher + externe Kopie** | Anhänge bleiben in Zotero, zusätzlich wird eine geordnete Kopie in einem externen Verzeichnis gepflegt.            | **Kopienverzeichnis**   |

Das Verzeichnis muss existieren, beschreibbar sein und außerhalb des
Zotero-Speichers liegen, auch wenn es über einen symbolischen Link erreicht
wird. Ist alles bereit, zeigt der Status unter dem Feld **Einrichtung
abgeschlossen**. Andernfalls nennt er das Problem: **Externes Verzeichnis
auswählen, um die Einrichtung abzuschließen** (bis dahin wird nichts
verschoben oder kopiert), **Verzeichnis nicht verfügbar; bitte erneut
auswählen**, **Verzeichnis außerhalb des Zotero-Speichers wählen** oder
**Verzeichnis ist schreibgeschützt; bitte ein anderes wählen**.

<p>
  <img src="images/settings-external-links.png" width="380" alt="Einstellungen für Externe Links">
  <img src="images/settings-external-copy.png" width="380" alt="Einstellungen für Zotero-Speicher + externe Kopie">
</p>

**Link-Optionen** (nur Externe Links):

- **Neue Anhänge automatisch in das Speicherverzeichnis verschieben**
  (standardmäßig an): Neue gespeicherte Anhänge werden umbenannt (wenn die
  automatische Umbenennung aktiv ist), in das Verzeichnis verschoben und in
  verknüpfte Anhänge umgewandelt.
- **Originaldateien verknüpfter Anhänge behalten (Verschieben wird zu
  Kopieren)** (standardmäßig aus): Beim Verschieben eines verknüpften Anhangs
  bleibt die alte Datei liegen, und die Menübefehle heißen **Kopieren** statt
  **Verschieben**. Für gespeicherte Anhänge gilt die Option nicht: Sie werden
  immer umgewandelt, und ihre gespeicherte Datei wird mit dem alten Eintrag
  entfernt.
- Zotero synchronisiert verknüpfte Dateien nicht. Synchronisieren Sie das
  Verzeichnis mit einem Cloud-Laufwerk oder einem anderen Werkzeug. Anhänge in
  Gruppenbibliotheken werden nie umgewandelt.

**Über Kopien** (nur externe Kopie):

- Kopien folgen den Unterordner- und Dateinamensregeln. Nach dem Umbenennen
  eines Anhangs oder dem Ändern seiner Sammlungen wird die Kopie verschoben
  und die alte entfernt.
- Kopien werden nur von Zotero aus aktualisiert. Eine außerhalb bearbeitete
  Kopie wird nie überschrieben, und beim Löschen des Anhangs in Zotero bleibt
  die Kopie erhalten.
- PDF-Kopien enthalten keine in Zotero erstellten Anmerkungen, da Zotero sie
  in seiner Datenbank speichert.
- Die Zotero-Dateisynchronisierung (Zotero Storage oder WebDAV) wird wie
  gewohnt in den Sync-Einstellungen von Zotero konfiguriert.

**Leere Ordner nach dem Verschieben automatisch löschen** (externe Modi,
standardmäßig aus): Nachdem eine Datei wegbewegt wurde, werden leer
gewordene Ordner entfernt; `.DS_Store` und `Thumbs.db` werden dabei
ignoriert. Das geschieht nur unterhalb des externen Verzeichnisses oder eines
Download-Ordners; diese Ordner selbst und der Zotero-Speicher werden nie
entfernt.

### Anhangnamen und Ordner

<p>
  <img src="images/settings-names-folders.png" width="560" alt="Anhangnamen und Ordner mit eigener Unterordner-Vorlage">
</p>

- **Hinzugefügte Anhänge automatisch umbenennen**: derselbe Schalter wie
  Zoteros eigene automatische Umbenennung (`extensions.zotero.autoRenameFiles`),
  wirkt also auch auf Zotero.
- **Dateinamensregeln > Dateinamenformat anpassen...**: öffnet Zoteros
  nativen Editor. Attanger verwendet dieses Format für jede Umbenennung; siehe
  [Zoteros Anleitung zur Dateiumbenennung](https://www.zotero.org/support/file_renaming).
- **Anhangtitel nach Umbenennung synchronisieren** (standardmäßig aus): setzt
  den Anhangstitel auf den neuen Dateinamen einschließlich Endung. Auch wenn
  die Option aus ist, wird ein Titel aktualisiert, der dem alten Dateinamen
  oder dem allgemeinen Titel „PDF“ entspricht.
- **Unterordner** (externe Modi): **Nach Zotero-Sammlung** (`{{collection}}`,
  Standard), **Nach Jahr** (`{{year}}`), **Keine Unterordner** oder **Eigene
  Vorlage...**; letztere zeigt **Unterordner-Vorlage** und **Schrägstriche (/)
  in Variablen als Unterverzeichnis-Trennzeichen interpretieren**
  (standardmäßig an).
- **Beispiel-Ausgabepfad** (**Beispiel-Dateiname** bei Nur Zotero-Speicher):
  eine Live-Vorschau für einen Beispieleintrag von Wang, 2026, „Learning
  representations“, in der Sammlung „Machine Learning“. Echte Anhänge werden
  nie verändert; die Vorschau meldet auch, wenn die Beispieldatei
  `paper-2026.pdf` durch Ihre Dateitypen oder Namensausnahmen ausgeschlossen
  wäre.

So werden Unterordner-Vorlagen ausgewertet:

- Ordnerebenen werden durch ein `/` zwischen `}}` und `{{` getrennt, zum
  Beispiel `{{collection}}/{{year}}`.
- `{{collection}}` muss eine eigene Ebene sein. Es wird zum Sammlungspfad,
  etwa `Machine Learning/Transformers`. Manuelle Befehle bevorzugen die links
  ausgewählte Sammlung, wenn der Eintrag zu ihr gehört; sonst wird die erste
  Sammlung des Eintrags verwendet. Einträge ohne Sammlung erhalten keinen
  Sammlungsordner.
- Jede andere Ebene nutzt Zoteros Vorlagensyntax für Dateinamen mit dem
  übergeordneten Eintrag, zum Beispiel `{{ year }}` oder
  `{{ creators max="1" }}`. In Ordnernamen unzulässige Zeichen werden
  entfernt. Ein `/` in einem Wert erzeugt einen verschachtelten Ordner, wenn
  die Schrägstrich-Option aktiv ist, und wird sonst entfernt.

### Download-Ordner

<p>
  <img src="images/settings-download-folder.png" width="560" alt="Abschnitt Download-Ordner">
</p>

Die Download-Ordner werden von **Neue Datei anhängen**, **Anhang zuordnen**
und **Attanger-Anhang zuordnen** verwendet. Normale Importe funktionieren
auch ohne sie.

- **Pfade der Download-Ordner**: **Auswählen...** legt den Hauptordner fest,
  **Ordner hinzufügen...** ergänzt weitere, **Entfernen** nimmt einen
  zusätzlichen Ordner aus der Liste. Neue Datei anhängen nimmt die neueste
  Datei aus allen Ordnern; die Zuordnungsbefehle durchsuchen sie der Reihe
  nach.
- **Titel aus PDF lesen**: **Nie**, **Außer für CJK** (Standard) oder
  **Immer**. Legt fest, ob Anhang zuordnen die Eintragstitel mit dem aus dem
  PDF gelesenen Titel oder mit dem Dateinamen vergleicht.
- **Datei nach dem Anhängen oder Zuordnen aus dem Download-Ordner löschen**
  (standardmäßig an): entfernt die Quelldatei nach Neue Datei anhängen oder
  Anhang zuordnen. Dateien werden nur gelöscht, solange **Meine Bibliothek**
  oder eine ihrer Sammlungen ausgewählt ist. Attanger-Anhang zuordnen löscht
  nie Dateien.

### Automatische Verarbeitung

<p>
  <img src="images/settings-automatic-processing.png" width="560" alt="Abschnitt Automatische Verarbeitung">
</p>

- **Eigenständig importierte PDFs erkennen** (standardmäßig an): Ein ohne
  übergeordneten Eintrag importiertes PDF durchläuft Zoteros
  Metadatenerkennung und wird verarbeitet, sobald ein übergeordneter Eintrag
  existiert. Ist die Option aus oder schlägt die Erkennung fehl, bleibt das
  PDF unverändert. Das ist unabhängig von Zoteros eigener Einstellung zum
  automatischen Abrufen von Metadaten für PDFs.
- **Verknüpfte Anhänge bei Änderungen am Eintrag automatisch umbenennen**
  (standardmäßig aus): Zotero benennt Dateien beim Hinzufügen um, daher können
  vorhandene verknüpfte Dateien nach Änderungen an Titel, Autoren, Jahr oder
  Better-BibTeX-Zitierschlüssel alte Namen behalten. Diese Option benennt sie
  erneut um. Sie betrifft vorhandene, bearbeitbare verknüpfte Dateien der
  eingestellten Typen und beachtet die Regel „nicht automatisch verschoben,
  kopiert oder umbenannt“.
- **Wartezeit nach der Bearbeitung anpassen** (sichtbar, solange die obige
  Option aktiv ist):
  - **Entprellzeit für Umbenennung nach Bearbeitung (ms)** (an, 1000): Eine
    Bearbeitung kann mehrere Benachrichtigungen auslösen, daher wartet
    Attanger, bis keine Änderungen mehr kommen. Normalerweise 1000 ms, bei
    wiederholten Umbenennungen 1500-3000 ms, für schnellere Reaktion
    300-500 ms.
  - **Verzögerung für Umbenennung nach Bearbeitung (ms)** (aus, 0):
    zusätzliche Wartezeit nach der Entprellung für Werte, die asynchron
    aktualisiert werden, etwa Better-BibTeX-Schlüssel. Mit 300-1000 ms
    beginnen, bei weiterhin alten Werten 1500-3000 ms verwenden.
- **Welche Importe werden automatisch verarbeitet?** Neue Anhänge aus
  Attanger, per Drag-and-drop oder über den Zotero Connector folgen dem
  aktuellen Modus. Direkt hinzugefügte verknüpfte Dateien werden nicht
  umgewandelt. Eigenständige PDFs werden erst verarbeitet, nachdem die
  Erkennung einen übergeordneten Eintrag erstellt hat.

**Dateitypen und Namensausnahmen**:

- **Anhangtypen zum Umbenennen/Verschieben** (Standard
  `pdf,doc,docx,txt,rtf,djvu,epub`): durch Kommas getrennte Endungen, ohne
  Beachtung der Groß-/Kleinschreibung, mit oder ohne führenden Punkt;
  Leerzeichen nach Kommas werden ignoriert. Leer lassen, um alle Typen
  einzuschließen. Andere Dateien werden nicht umbenannt, verschoben oder
  kopiert.
- **Diakritische Zeichen aus Dateinamen entfernen** (standardmäßig aus):
  wandelt Buchstaben mit Akzenten und Ligaturen im endgültigen Dateinamen in
  einfache Buchstaben um, zum Beispiel `Müller` in `Muller`. Die Endung bleibt
  erhalten.
- Drei Listen regulärer Ausdrücke, durch Kommas getrennt, zum Beispiel
  `SI\d+, .+_si`. Sie werden gegen den aktuellen Dateinamen ohne Endung
  geprüft und sind nicht verankert, daher passt `SI\d+` auch auf `CASI2`.

| Wenn der Dateiname passt...                                 | Ergebnis                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| „...bleibt der ursprüngliche Dateiname als Präfix erhalten“ | Der alte Name bleibt vorn: aus `SI1.pdf` wird `SI1_Wang - 2026 - Learning representations.pdf`.              |
| „...werden Anhänge nicht umbenannt“                         | Keine Umbenennung, weder manuell noch automatisch.                                                           |
| „...nicht automatisch verschoben, kopiert oder umbenannt“   | Von automatischer Verarbeitung und Umbenennen nach Bearbeitung übersprungen; manuelle Befehle funktionieren. |

Da Kommas die Regeln trennen, kann eine Regel kein Komma enthalten; ein
Quantor wie `{2,3}` ist also nicht möglich. Ungültige Ausdrücke werden
ignoriert und ins Debug-Protokoll geschrieben.

### Tastenkürzel

| Befehl                                            | Standard           | Standardmäßig aktiv |
| ------------------------------------------------- | ------------------ | ------------------- |
| Neue Datei anhängen                               | `Ctrl + I`         | ja                  |
| Anhang zuordnen                                   | `Ctrl + M`         | ja                  |
| Anhang umbenennen                                 | `Ctrl + R`         | nein                |
| Anhang umbenennen und verschieben/synchronisieren | `Ctrl + Shift + R` | nein                |
| Anhang verschieben/synchronisieren                | `Ctrl + Shift + M` | nein                |

Einen Befehl anhaken, um sein Kürzel zu aktivieren, in das Feld klicken und
die Tastenkombination drücken. Änderungen gelten sofort, und aktive Kürzel
werden neben den Menübefehlen angezeigt. `Ctrl` bedeutet auf allen Systemen,
auch unter macOS, die Control-Taste; eine mit Cmd aufgenommene Kombination
wird als `Meta` gespeichert. Die Kürzel für Verschieben/Synchronisieren
folgen dem Arbeitsmodus; bei Nur Zotero-Speicher zeigt **Anhang
verschieben/synchronisieren** nur einen Hinweis.

Der Abschnitt **Über Attanger** verlinkt das Projekt auf GitHub, den
Bilibili-Kanal des Autors und weitere Plugins.

### Einstellungsreferenz

Die Einstellungen liegen unter `extensions.zotero.zoteroattanger.` und lassen
sich auch unter **Einstellungen > Erweitert > Konfigurationseditor**
einsehen.

| Einstellung                                  | Präferenz                                                                             | Standard                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Arbeitsmodus                                 | `workMode`                                                                            | `stored` bei Neuinstallation (`stored`, `linked` oder `copy`) |
| Speicher- / Kopienverzeichnis                | `destDir`                                                                             | leer                                                          |
| Neue Anhänge automatisch verschieben         | `autoMove`                                                                            | `true`                                                        |
| Originaldateien behalten                     | `moveWithoutDeleting`                                                                 | `false`                                                       |
| Leere Ordner automatisch löschen             | `autoRemoveEmptyFolder`                                                               | `false`                                                       |
| Hinzugefügte Anhänge automatisch umbenennen  | `extensions.zotero.autoRenameFiles` (Zotero)                                          | `true`                                                        |
| Anhangtitel nach Umbenennung synchronisieren | `syncAttachmentTitle`                                                                 | `false`                                                       |
| Unterordner-Vorlage                          | `subfolderFormat`                                                                     | `{{collection}}`                                              |
| Schrägstriche als Trennzeichen               | `slashAsSubfolderDelimiter`                                                           | `true`                                                        |
| Download-Ordner                              | `sourceDir`                                                                           | leer                                                          |
| Weitere Download-Ordner                      | `extraSourceDirs`                                                                     | `[]` (JSON-Array)                                             |
| Titel aus PDF lesen                          | `readPDFtitle`                                                                        | `nonCJK` (`never`, `nonCJK` oder `always`)                    |
| Datei aus dem Download-Ordner löschen        | `deleteSourceAfterImport`                                                             | `true`                                                        |
| Eigenständig importierte PDFs erkennen       | `autoRecognizeImportedPDF`                                                            | `true`                                                        |
| Verknüpfte Anhänge bei Änderungen umbenennen | `autoRenameOnModify`                                                                  | `false`                                                       |
| Entprellzeit                                 | `autoRenameOnModifyDebounceEnabled`, `autoRenameOnModifyDebounceMs`                   | `true`, `1000`                                                |
| Verzögerung                                  | `autoRenameOnModifyDelayEnabled`, `autoRenameOnModifyDelayMs`                         | `false`, `0`                                                  |
| Anhangtypen                                  | `fileTypes`                                                                           | `pdf,doc,docx,txt,rtf,djvu,epub`                              |
| Diakritische Zeichen entfernen               | `removeDiacritics`                                                                    | `false`                                                       |
| Namensausnahmen                              | `filenameAsPrefixRules`, `filenameSkipRenameRules`, `filenameSkipAutoMoveRenameRules` | leer                                                          |
| Tastenkürzel                                 | `<command>.shortcut`, `<command>.shortcut.enable`                                     | siehe [Tastenkürzel](#tastenkürzel)                           |
| Öffnen-mit-Anwendungen                       | `openUsing`                                                                           | leere Liste                                                   |

`<command>` ist `attachNewFile`, `matchAttachment`, `renameAttachment`,
`renameMoveAttachment` oder `moveAttachment`. Die alte Präferenz `attachType`
folgt dem Arbeitsmodus (`linking` für Externe Links, sonst `importing`), damit
ältere Attanger-Versionen nach einem Downgrade weiter funktionieren.

## Menübefehle

Ausgewählte Einträge rechts anklicken und **Attanger** öffnen. Drei Einträge
hängen vom Arbeitsmodus ab:

| Eintrag                              | Nur Zotero-Speicher                           | Externe Links                                 | Zotero-Speicher + externe Kopie                  |
| ------------------------------------ | --------------------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| Umbenennen und verschieben/synchron. | **Anhang umbenennen**                         | **Anhang umbenennen und verschieben**         | **Umbenennen und externe Kopie synchronisieren** |
| Verschieben/synchronisieren          | ausgeblendet                                  | **Anhang verschieben**                        | **Externe Kopie synchronisieren**                |
| Rückgängig                           | **Verschieben des Anhangs rückgängig machen** | **Verschieben des Anhangs rückgängig machen** | **Verschieben des Anhangs rückgängig machen**    |

Ist **Originaldateien verknüpfter Anhänge behalten** aktiv, zeigt Externe
Links stattdessen **Anhang umbenennen und kopieren**, **Anhang kopieren** und
**Kopieren des Anhangs rückgängig machen**.

- **Neue Datei anhängen** (genau ein regulärer Eintrag ausgewählt): hängt die
  neueste Datei aus den Download-Ordnern an. Jeder Dateityp wird akzeptiert;
  versteckte Dateien und Unterordner werden ignoriert. Existiert kein
  Download-Ordner, fragt Attanger nach einem.
- **Anhang umbenennen und verschieben**: verschiebt jeden Anhang und benennt
  ihn danach um; wird das Verschieben übersprungen, wird auch nicht
  umbenannt. **Umbenennen und externe Kopie synchronisieren** benennt um und
  synchronisiert dann die Kopie.
- **Anhang zuordnen**: ordnet PDF- und CAJ-Dateien aus den Download-Ordnern
  den ausgewählten Einträgen nach Titelähnlichkeit zu. Siehe
  [Heruntergeladene Dateien zuordnen](#heruntergeladene-dateien-zuordnen).
- **Attanger-Anhang zuordnen**: findet Dateien, die bereits den erwarteten
  Attanger-Pfad und -Namen haben. Siehe
  [Eine bestehende Bibliothek wieder verbinden](#eine-bestehende-bibliothek-wieder-verbinden).
- **Anhang umbenennen**: benennt die untergeordneten Anhänge der Auswahl mit
  Zoteros Dateinamenformat um. Eigenständige Anhänge werden übersprungen.
- **Anhang verschieben** / **Externe Kopie synchronisieren**: verschiebt
  Dateien in das Speicherverzeichnis bzw. erstellt und aktualisiert ihre
  externen Kopien. Eigenständige Anhänge sind eingeschlossen.
- **Verschieben des Anhangs rückgängig machen**: führt Zoteros **In
  gespeicherte Dateien umwandeln** für die ausgewählten verknüpften Anhänge
  und die verknüpften Anhänge ausgewählter Einträge aus. Zotero fragt, ob die
  Originaldateien nach dem Speichern gelöscht werden sollen. Die
  wiederhergestellten Anhänge bleiben im Zotero-Speicher, auch wenn das
  automatische Verschieben aktiv ist.

Zwei weitere Befehle liegen außerhalb des Attanger-Untermenüs:

- **Öffnen mit** (Eintragsmenü, wenn die Auswahl Anhänge enthält): öffnet die
  Datei mit **Zotero**, **System** (Standardanwendung), einer gespeicherten
  Anwendung oder **Andere App auswählen**. Eine gespeicherte Anwendung per
  Rechtsklick entfernen. Bei einem regulären Eintrag wird der beste Anhang
  geöffnet. Das funktioniert über Zoteros PDF-Handler und ist daher für PDFs
  gedacht.
- **Neue Datei anhängen** (Sammlungsmenü): fügt den neuesten Download als
  eigenständigen Anhang zur Sammlung hinzu und startet die
  Metadatenerkennung.

## Typische Arbeitsabläufe

### Letzten Download anhängen

1. Das PDF in einem Download-Ordner speichern.
2. Den Eintrag auswählen und `Ctrl + I` drücken (oder **Attanger > Neue
   Datei anhängen** wählen).
3. Die Datei wird angehängt und dann passend zum Modus umbenannt und
   verschoben oder kopiert. Der Download wird gelöscht, wenn die Option aktiv
   ist.

Um stattdessen aus dem PDF einen neuen Eintrag zu erzeugen, eine Sammlung
rechts anklicken und **Neue Datei anhängen** wählen.

### Heruntergeladene Dateien zuordnen

1. Die PDFs in einen Download-Ordner legen.
2. Nur die Einträge auswählen, deren Dateien dort liegen, und `Ctrl + M`
   drücken.
3. Jeder Eintrag erhält die verbleibende Datei mit dem ähnlichsten Titel;
   jede Datei wird einmal verwendet.

> **Achtung:** Es gibt keinen Ähnlichkeitsschwellenwert. Solange Dateien
> übrig sind, erhält jeder ausgewählte Eintrag die ähnlichste, auch wenn sie
> schlecht passt.

Berücksichtigt werden nur `.pdf`- und `.caj`-Dateien direkt in den
Download-Ordnern; Einträge mit kürzeren Titeln werden zuerst zugeordnet.
**Titel aus PDF lesen** bestimmt, was mit dem Eintragstitel verglichen wird:
der Dateiname (**Nie**), der PDF-Titel (**Immer**) oder der PDF-Titel außer
bei Einträgen, deren Titel chinesische, japanische oder koreanische Zeichen
enthalten (**Außer für CJK**). Der PDF-Titel stammt aus den Metadaten oder,
falls diese fehlen, aus dem größten Text; nach 30 Sekunden wird aufgegeben
und der Dateiname verwendet.

### Eine bestehende Bibliothek wieder verbinden

Nützlich, wenn Ihre Dateien bereits in Attangers Struktur liegen, etwa nach
einer Neuinstallation von Zotero oder auf einem neuen Computer.

1. Sicherstellen, dass Unterordner-Vorlage und Zoteros Dateinamenformat noch
   die vorhandenen Pfade erzeugen.
2. Den Stamm dieses Ordners als Download-Ordner hinzufügen.
3. Die Einträge auswählen und **Attanger > Attanger-Anhang zuordnen** wählen.

Für jede Endung in **Anhangtypen zum Umbenennen/Verschieben** sucht Attanger
nach `<Download-Ordner>/<Unterordner>/<Dateiname>.<Endung>` und probiert die
Ordner der Reihe nach. Eine Datei wird übersprungen, wenn der Eintrag bereits
einen Anhang mit diesem Dateinamen als Titel hat. Quelldateien werden nie
gelöscht.

- Bei **Nur Zotero-Speicher** und **Externe Links** werden Dateien an Ort und
  Stelle als verknüpfte Anhänge hinzugefügt. Das funktioniert nur in Meine
  Bibliothek.
- Bei **Zotero-Speicher + externe Kopie** werden Dateien in den
  Zotero-Speicher importiert. Ist der Download-Ordner das Kopienverzeichnis
  selbst, wird die Originaldatei als externe Kopie übernommen; es entsteht
  kein Duplikat `name_1.ext`.

### Vorhandene Anhänge nach einem Moduswechsel ordnen

- **Zu Externe Links**: Einträge auswählen und **Anhang verschieben**
  ausführen. Gespeicherte Anhänge werden zu verknüpften Dateien im
  Speicherverzeichnis und behalten Anmerkungen, Notizen, Tags, Beziehungen und
  Volltextindex.
- **Zu externer Kopie**: Einträge auswählen und einmal **Externe Kopie
  synchronisieren** ausführen. Danach werden ihre Kopien automatisch
  aktualisiert.
- **Zurück in den Zotero-Speicher**: Einträge auswählen und **Verschieben des
  Anhangs rückgängig machen** ausführen. Die Anhänge werden zu gespeicherten
  Dateien und vom automatischen Verschieben nicht erneut ausgelagert.
  Wechseln Sie zusätzlich zu **Nur Zotero-Speicher**, wenn auch neue Anhänge
  in Zotero bleiben sollen.

### Nach Better-BibTeX-Aktualisierungen umbenennen

Verwendet Ihr Dateinamenformat den Better-BibTeX-Zitierschlüssel, ist der
Schlüssel beim Hinzufügen einer Datei möglicherweise noch nicht fertig.

1. **Verknüpfte Anhänge bei Änderungen am Eintrag automatisch umbenennen**
   aktivieren.
2. Die Entprellzeit bei 1000 ms lassen. Erhalten Dateien noch den alten
   Schlüssel, die Verzögerung aktivieren und mit 300-1000 ms beginnen.

Dies benennt nur verknüpfte Dateien um. Für gespeicherte Anhänge nach der
Schlüsseländerung **Anhang umbenennen** ausführen.

## So funktioniert die automatische Verarbeitung

Neue Anhänge werden etwa eine Sekunde lang gesammelt und dann nacheinander
verarbeitet:

1. Verknüpfte Anhänge, die Attanger gerade selbst erstellt hat, und von
   **Verschieben des Anhangs rückgängig machen** wiederhergestellte Anhänge
   werden übersprungen.
2. Ein eigenständig importiertes PDF wird zuerst erkannt, wenn
   **Eigenständig importierte PDFs erkennen** aktiv ist. Ohne übergeordneten
   Eintrag endet die Verarbeitung.
3. Nicht unterstützte Dateitypen und Dateien, die auf die Regel „nicht
   automatisch verschoben, kopiert oder umbenannt“ passen, bleiben
   unverändert.
4. Ist **Hinzugefügte Anhänge automatisch umbenennen** aktiv, wird die Datei
   umbenannt. Das betrifft auch direkt hinzugefügte verknüpfte Dateien, die an
   Ort und Stelle umbenannt werden.
5. Bei **Externe Links** mit automatischem Verschieben werden gespeicherte
   Anhänge zuerst umbenannt, dann verschoben und in verknüpfte Anhänge
   umgewandelt.
6. Bei **Zotero-Speicher + externe Kopie** werden gespeicherte Anhänge
   umbenannt und dann in das Kopienverzeichnis kopiert.

Das Verschieben eines Eintrags in den Papierkorb oder sein Löschen bricht
die ausstehende Verarbeitung ab. Alle Dateioperationen laufen über eine
einzige Warteschlange.

**Verschieben (Externe Links)**

- Erfordert eine bearbeitbare eigene Bibliothek; sonst meldet Attanger
  „Externe Links funktionieren nur in einer bearbeitbaren eigenen
  Bibliothek.“
- Das Ziel ist `<Speicherverzeichnis>/<Unterordner>/<Dateiname>`. Die Datei
  wird in eine temporäre Datei kopiert, per MD5 geprüft und ohne
  Überschreiben veröffentlicht: Belegte Namen erhalten `_1`, `_2` usw. Eine
  Datei, die schon an ihrem Ziel liegt, bleibt dort.
- Ein verknüpfter Anhang wird neu verknüpft. Seine alte Datei wird gelöscht,
  außer **Originaldateien verknüpfter Anhänge behalten** ist aktiv, ein
  anderer Anhang nutzt sie, sie wurde während des Verschiebens geändert oder
  sie liegt im Zotero-Speicher.
- Ein gespeicherter Anhang wird durch einen neuen verknüpften Anhang ersetzt.
  Anmerkungen (auch im Papierkorb), untergeordnete Notizen, Tags,
  Beziehungen, die Anhangsnotiz und der Volltextindex werden übertragen;
  danach werden der gespeicherte Eintrag und seine Datei gelöscht.

**Umbenennen**

- Erfordert einen übergeordneten Eintrag. Der neue Name ist Zoteros
  Dateinamenformat plus die ursprüngliche Endung.
- Die Regeln gelten in dieser Reihenfolge: Überspring-Regel, Präfix-Regel,
  Entfernen diakritischer Zeichen.
- Ist der Name belegt, wird Zoteros Nummerierung verwendet (`name 2.pdf`).
- Eine von mehreren Anhängen genutzte verknüpfte Datei wird unter dem neuen
  Namen kopiert und neu verknüpft, sodass die anderen Anhänge ihre Datei
  behalten.
- Fehlgeschlagene Umbenennungen, etwa bei gesperrten Dateien, werden bis zu
  fünfmal im Abstand von drei Sekunden wiederholt.

**Externe Kopien**

- Nur gespeicherte Anhänge erhalten Kopien; verknüpfte Anhänge werden mit
  einem Hinweis übersprungen.
- Eine Kopie wird etwa eine Sekunde nach einer Änderung an Anhang, Datei
  oder Sammlungen aktualisiert. Das gilt nur für Anhänge, die bereits eine
  Kopie haben; für vorhandene Anhänge daher einmal **Externe Kopie
  synchronisieren** ausführen.
- Eine fehlende Kopie wird neu erstellt. Eine außerhalb von Zotero bearbeitete
  oder von einem anderen Anhang verknüpfte Kopie wird als Konflikt gemeldet
  und nicht angetastet. Sonst wird die Kopie atomar ersetzt, mit Sicherung
  und Rücksetzung.
- Ändert sich der Zielpfad, wird eine neue Kopie geschrieben und die alte nur
  entfernt, wenn sie unverändert und unbenutzt ist. Liegt am Ziel bereits
  eine inhaltsgleiche Datei, die kein Anhang nutzt, wird sie als Kopie
  übernommen; eine abweichende Datei bleibt erhalten, und die Kopie erhält
  `name_1.ext`.
- Die Kopie-Datensätze liegen in `attanger-external-copies.json` im
  Zotero-Datenverzeichnis.

## Aktualisierung von älteren Versionen

Beim ersten Start übernimmt Attanger die alten Einstellungen einmalig:

- Der alte **Anhangstyp: Link** mit Zielpfad wird zu **Externe Links**; alles
  andere wird zu **Nur Zotero-Speicher**. **Zotero-Speicher + externe Kopie**
  ist neu und muss bei Bedarf selbst gewählt werden.
- **Datei nach dem Anhängen oder Zuordnen aus dem Download-Ordner löschen**
  wird auf das Gegenteil der alten Option **Originaldateien behalten**
  gesetzt, sodass sich Download-Ordner wie bisher verhalten.
- Bei Externe Links behalten automatisches Verschieben und
  **Originaldateien behalten** ihre bisherige Bedeutung.
- Tastenkürzel und vorhandene Anhänge werden nicht geändert.

## Hinweise und Einschränkungen

- Zotero synchronisiert verknüpfte Dateien nicht. Synchronisieren Sie das
  Speicherverzeichnis selbst und setzen Sie es eventuell unter
  **Einstellungen > Erweitert > Dateien und Ordner** als Basisverzeichnis für
  verknüpfte Anhänge, damit Links auch auf anderen Computern funktionieren.
- Externe Links funktionieren nur in Ihrer bearbeitbaren eigenen Bibliothek;
  Anhänge in Gruppenbibliotheken werden nie verschoben. Außerhalb des Modus
  externe Kopie erstellt **Attanger-Anhang zuordnen** verknüpfte Anhänge und
  benötigt daher ebenfalls Meine Bibliothek.
- Vorhandene Dateien werden nie überschrieben: Verschieben und Kopieren
  hängen `_1`, `_2` usw. an, Umbenennungen nutzen Zoteros Nummerierung
  (`name 2.pdf`). Externe Kopie übernimmt eine Datei am Ziel nur bei
  identischem Inhalt.
- Dateien in Download-Ordnern werden nur gelöscht, solange **Meine
  Bibliothek** oder eine ihrer Sammlungen ausgewählt ist.
- Externe PDF-Kopien enthalten keine Zotero-Anmerkungen; nutzen Sie Zoteros
  PDF-Export, wenn Sie sie in der Datei brauchen.
- Eine Namensausnahme-Regel kann kein Komma enthalten.
- `Ctrl` in Tastenkürzeln bedeutet auch unter macOS die Control-Taste.
- **Anhang zuordnen** weist jedem ausgewählten Eintrag eine Datei zu, solange
  Dateien übrig sind; wählen Sie daher nur Einträge aus, deren Dateien
  vorhanden sind.
- Direkt hinzugefügte verknüpfte Dateien können an Ort und Stelle umbenannt,
  aber nie verschoben werden.
- Neuere Zotero-Versionen können Dateien bei Metadatenänderungen selbst
  umbenennen, auch verknüpfte Dateien, wenn dies in Zoteros
  Umbenennungseinstellungen aktiviert ist. Verwenden Sie entweder das oder
  Attangers **Verknüpfte Anhänge bei Änderungen am Eintrag automatisch
  umbenennen**, nicht beides.

## Screenshots und Anleitungen

<p>
  <img src="https://github.com/user-attachments/assets/3125e608-7891-4afa-91f5-be8120a98988" width="300" alt="Attanger-Eintragsmenü">
</p>

Das Eintragsmenü im Modus Externe Links (chinesische Oberfläche).

- [Videodemonstration (Chinesisch)](https://www.bilibili.com/video/BV1x64y1J7Rv)
- [Community-Anleitung (Französisch)](https://docs.zotero-fr.org/kbfr/kbfr_attanger_zotmoov/)

## Mitwirken

Fehlerberichte, Korrekturen, Funktionen, Tests, Dokumentation und
Übersetzungen sind willkommen. Kleine, klar abgegrenzte Pull Requests lassen
sich besser prüfen und sicherer veröffentlichen.

Fehlerberichte sollten Zotero- und Attanger-Version, Betriebssystem,
Arbeitsmodus, relevante Einstellungen, genaue Schritte und Debug-Ausgaben
(**Hilfe > Debug-Ausgabe protokollieren**) enthalten. Private Literaturdaten
und lokale Pfade vorher entfernen.

Lokale Entwicklung:

```bash
git clone https://github.com/MuiseDestiny/zotero-attanger.git
cd zotero-attanger
npm install
cp scripts/zotero-cmd-template.json scripts/zotero-cmd.json
# zoteroBinPath und profilePath setzen; ein separates Zotero-Testprofil verwenden
npm start
```

`npm start` startet Zotero mit dem Plugin und lädt es neu, wenn sich Dateien
unter `src/` oder `addon/` ändern.

Vor einem Pull Request:

```bash
npm run build                    # Typprüfung, dann build/zotero-attanger.xpi
npm test
npx eslint src/modules/menu.ts   # die geänderten Dateien prüfen
```

`npm run lint` formatiert und korrigiert das gesamte Repository; führen Sie
ESLint daher besser nur für die geänderten Dateien aus, damit der Diff
fokussiert bleibt.

### KI-unterstützte Beiträge sind willkommen

KI-Werkzeuge dürfen für Implementierung, Fehlersuche, Tests, Dokumentation und
Übersetzungen eingesetzt werden. KI-Nutzung ist kein Ablehnungsgrund. Die
Verantwortung für das Ergebnis bleibt bei der einreichenden Person:

- Generierte Änderungen vor dem Einreichen prüfen und verstehen.
- Betroffene Abläufe tatsächlich testen und die Prüfung beschreiben.
- Änderungen fokussiert halten und keine unbeteiligten generierten
  Neuformatierungen aufnehmen.
- Keine privaten Bibliotheken, Protokolle, Zugangsdaten oder geschützten
  Dokumente ohne Erlaubnis an einen KI-Dienst senden.
- Lizenz- und Abhängigkeitsregeln auch für generierten Code und Inhalte prüfen.
- Wesentliche KI-Unterstützung im Pull Request kurz nennen, wenn dies die
  Entstehung oder Prüfung der Änderung verständlicher macht.

Oberflächenübersetzungen liegen in `addon/locale/`, Dokumentationen in `doc/`.
Schlüssel und Verhaltensbeschreibungen müssen sprachübergreifend übereinstimmen.

## Lizenz und Danksagung

Zotero Attanger steht unter [AGPL-3.0-or-later](../LICENSE). Der
Anhangs-Arbeitsablauf ist wesentlich von ZotFile inspiriert. Das Projekt nutzt
das [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)
und [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit).
