# Zotero Attanger

<p>
  <img src="../addon/chrome/content/icons/favicon.png" width="48" height="48" alt="Attanger-Symbol">
</p>

Attanger (Attachment Manager) organisiert Zotero-Anhänge: neue Downloads
anhängen, Dateien Einträgen zuordnen, sie mit Zotero-Vorlagen umbenennen und
in eine nachvollziehbare Ordnerstruktur verschieben oder kopieren.

[English](../README.md) | [简体中文](README-zhCN.md) | Deutsch | [Italiano](README-itIT.md)

[![Neueste Version](https://img.shields.io/github/v/release/MuiseDestiny/zotero-attanger)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Veröffentlichungsdatum](https://img.shields.io/github/release-date/MuiseDestiny/zotero-attanger)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Downloads](https://img.shields.io/github/downloads/MuiseDestiny/zotero-attanger/latest/total)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Lizenz: AGPL-3.0-or-later](https://img.shields.io/github/license/MuiseDestiny/zotero-attanger)](../LICENSE)
[![Zotero 7-10](https://img.shields.io/badge/Zotero-7--10-CC2936?logo=zotero&logoColor=white)](https://www.zotero.org/)

## Funktionen

- Die zuletzt geänderte Datei aus einem konfigurierten Quellordner an einen
  Zotero-Eintrag oder direkt an eine Sammlung anhängen.
- Einen Arbeitsmodus wählen: nur Zotero-Speicher, externe Links oder
  Zotero-Speicher mit einer organisierten externen Kopie (Zotero-Dateisync
  bleibt erhalten).
- Einen oder mehrere Anhänge mit Zotero-Vorlagen umbenennen und optional den
  Anhangstitel synchronisieren.
- Diakritische Zeichen und Ligaturen in erzeugten Dateinamen optional in
  ASCII-Entsprechungen umwandeln, um die Kompatibilität zu verbessern.
- Unterordner aus Metadaten oder `{{collection}}` erzeugen; `/` kann als
  Trennzeichen für verschachtelte Ordner verwendet werden.
- Neu importierte Anhänge automatisch umbenennen und nach dem Arbeitsmodus verarbeiten.
- Verknüpfte Anhänge nach Metadatenänderungen umbenennen. Entprellzeit und
  Verzögerung unterstützen Better-BibTeX-Zitierschlüssel und andere Felder,
  die erst nach dem Import feststehen.
- PDF-/CAJ-Dateien anhand ähnlicher Titel zuordnen; bei PDF-Dateien können
  Metadaten oder Text zur Titelerkennung verwendet werden.
- Dateien, die bereits Attangers Ordner- und Dateinamenschema entsprechen,
  präzise wieder verknüpfen.
- Vorhandene Anhänge verschieben oder kopieren und beim Umwandeln in
  Verknüpfungen Anmerkungen, Beziehungen, Volltextindex, Tags und Notizen
  übertragen.
- Externe Kopien einseitig von Zotero aus aktualisieren; extern bearbeitete
  Kopien werden nie überschrieben.
- Anhänge mit Zotero, dem Systemstandard oder gespeicherten eigenen
  Anwendungen öffnen.
- Tastenkürzel, Dateitypen, Ordnerbereinigung und reguläre Ausdrücke für
  Ausnahmen konfigurieren.

## Installation

1. Die aktuelle `.xpi` von der
   [Releases-Seite](https://github.com/MuiseDestiny/zotero-attanger/releases)
   herunterladen.
2. In Zotero **Werkzeuge > Plugins** öffnen. In älteren Versionen heißt der
   Eintrag möglicherweise **Werkzeuge > Add-ons**.
3. Im Zahnradmenü **Plugin aus Datei installieren** wählen und die `.xpi`
   öffnen.
4. Zotero neu starten, falls dazu aufgefordert wird.

Das aktuelle Manifest unterstützt Zotero 7 bis Zotero 10.

## Ersteinrichtung

Unter **Zotero-Einstellungen > Attanger** einen **Arbeitsmodus** wählen:

| Modus                           | Zotero öffnet      | Dateisynchronisation    | Externes Verzeichnis              |
| ------------------------------- | ------------------ | ----------------------- | --------------------------------- |
| Nur Zotero-Speicher             | Gespeicherte Datei | Zotero Storage / WebDAV | Nicht erforderlich                |
| Externe Links                   | Verknüpfte Datei   | Cloud-Speicher o. Ä.    | Dateien werden dorthin verschoben |
| Zotero-Speicher + externe Kopie | Gespeicherte Datei | Zotero Storage / WebDAV | Organisierte, aktuelle Kopie      |

1. Für **Externe Links** oder **Zotero-Speicher + externe Kopie** das externe
   Verzeichnis wählen. Es muss außerhalb des Zotero-Speichers liegen, auch
   wenn es über einen symbolischen Link erreicht wird.
2. Optional **Anhangnamen und Ordner** anpassen. Standardmäßig folgt der
   Unterordner `{{collection}}` der Sammlungshierarchie; **Dateinamenformat
   anpassen** öffnet den nativen Zotero-Editor. Syntax und Variablen erklärt
   die [Zotero-Dokumentation](https://www.zotero.org/support/file_renaming).
3. Für **Neue Datei anhängen** oder die Zuordnung den **Download-Ordner**
   festlegen. Mit **Ordner hinzufügen** lassen sich weitere Ordner ergänzen:
   Neue Datei anhängen nimmt die neueste Datei aus allen Ordnern, die Zuordnung
   durchsucht sie der Reihe nach.
4. Vor größeren Stapeloperationen automatische Verarbeitung, Dateitypen und
   Tastenkürzel prüfen.

### Aktualisierung von älteren Versionen

Der Arbeitsmodus wird einmalig aus den bisherigen Einstellungen abgeleitet,
sodass sich nach dem Update nichts ändert:

- **Anhangstyp: Link** mit Zielpfad wird zu **Externe Links**. **Neue
  Anhänge automatisch verschieben** und **Originaldateien behalten** behalten
  in diesem Modus ihre Bedeutung.
- Alle anderen Konfigurationen werden zu **Nur Zotero-Speicher**.
- **Originaldateien behalten** wird zusätzlich (invertiert) zur neuen Option
  **Datei aus dem Download-Ordner löschen**, sodass Importe aus dem
  Quellordner wie bisher funktionieren.

Menüeinträge und Tastenkürzel behalten ihre IDs. Ein Moduswechsel wandelt
vorhandene Anhänge nie automatisch um.

Verknüpfte Dateien werden nicht über Zoteros Dateisynchronisation hochgeladen;
im Modus Externe Links muss das Verzeichnis separat synchronisiert oder
gesichert werden. Gruppenanhänge werden nie in Verknüpfungen umgewandelt.

## Typische Arbeitsabläufe

### Letzten Download anhängen

1. Eine Datei im konfigurierten Quellordner speichern.
2. Genau einen regulären Zotero-Eintrag auswählen.
3. **Attanger > Neue Datei anhängen** wählen oder `Ctrl + I` drücken.

Attanger verwendet die zuletzt geänderte, nicht versteckte Datei. Der Befehl
kann auch im Kontextmenü einer Sammlung verwendet werden; dort entsteht ein
übergeordneter Anhang. Nach erfolgreichem Import wird die Eingabedatei
gelöscht, sofern **Datei aus dem Download-Ordner löschen** aktiviert ist.

### Dateien mehreren Einträgen zuordnen

1. PDF- oder CAJ-Dateien direkt in den Quellordner legen.
2. Einen oder mehrere reguläre Zotero-Einträge auswählen.
3. **Attanger > Anhang zuordnen** wählen.

Jede Quelldatei wird höchstens einmal verwendet. Attanger vergleicht
Eintragstitel und Dateinamen und kann entsprechend **Titel aus PDF-Datei lesen**
auch PDF-Metadaten oder Text auswerten. Danach gelten die konfigurierten
Regeln zum Umbenennen und der Arbeitsmodus.

### Eine bestehende Attanger-Bibliothek wieder verknüpfen

**Attanger > Attanger-Anhang zuordnen** erwartet folgende Struktur:

```text
Quellpfad / erzeugter Unterordner / von Zotero erzeugter Dateiname.Endung
```

Für jeden ausgewählten Eintrag prüft Attanger die konfigurierten Endungen.
Im Modus Externe Links werden passende Dateien ohne Kopie verknüpft; in den
Speichermodi werden sie in Zotero importiert, damit die Dateisynchronisation
weiter funktioniert.

### Bestehende Anhänge umbenennen, verschieben oder synchronisieren

Reguläre Einträge, untergeordnete Anhänge oder übergeordnete Anhänge auswählen
und einen Befehl verwenden:

- **Anhang umbenennen** wendet die Zotero-Dateinamensvorlage an (alle Modi).
- **Anhang verschieben** (Externe Links) legt Dateien im externen Verzeichnis
  ab. Mit **Originaldateien behalten** heißen die Befehle „Kopieren“.
- **Externe Kopie synchronisieren** (Zotero-Speicher + externe Kopie) erstellt
  oder aktualisiert die Kopie, ohne den gespeicherten Anhang zu ändern.
- **Umbenennen und verschieben/synchronisieren** führt beides aus. Im Modus
  Nur Zotero-Speicher wird nur umbenannt, und der Verschieben-Befehl ist
  ausgeblendet.
- **Verschieben des Anhangs rückgängig machen** nutzt Zoteros Umwandlung von
  verknüpften in gespeicherte Dateien.

Unterschiedliche Dateien mit gleichem Ziel erhalten einen Suffix; identische
Zieldateien werden nicht erneut kopiert.

### Externe Kopien aktualisieren

Im Modus Zotero-Speicher + externe Kopie erhalten neue gespeicherte Anhänge
automatisch eine Kopie. Vorhandene Kopien folgen späteren Umbenennungen,
Sammlungsänderungen und Dateiänderungen einseitig, etwa eine Sekunde nach der
Änderung. Verknüpfte Anhänge erhalten keine Kopie.

- Eine außerhalb von Zotero bearbeitete Kopie bleibt erhalten und wird nie
  überschrieben; Attanger meldet einen Konflikt.
- Ändert sich der Zielpfad, wird die alte Kopie nur entfernt, wenn sie
  unverändert ist und von keinem anderen Anhang verwendet wird.
- Das Löschen eines Zotero-Anhangs löscht die externe Kopie nicht.
- PDF-Kopien enthalten nur die Dateibytes; Anmerkungen aus Zoteros Datenbank
  werden nicht eingebettet.

### Nach Better-BibTeX-Aktualisierungen umbenennen

Enthält die Dateinamensvorlage einen Better-BibTeX-Zitierschlüssel oder ein
anderes erst nach dem Import gesetztes Feld:

1. **Hinzugefügte Anhänge automatisch umbenennen** deaktivieren, falls dieser
   Schritt zu früh erfolgt.
2. **Verknüpfte Anhänge bei Änderungen am Eintrag automatisch umbenennen**
   aktivieren.
3. Die Entprellzeit von `1000 ms` beibehalten oder die Verzögerung erhöhen,
   wenn der Metadatenanbieter mehrere Aktualisierungen ausführt.

Nur vorhandene, unterstützte verknüpfte Dateien werden verarbeitet. Doppelte
Ereignisse werden zusammengefasst; Attangers eigene Speichervorgänge erzeugen
keine Umbenennungsschleife.

## Einstellungen

| Einstellung                            | Verhalten                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Download-Ordner                        | Eingabeordner für Neue Datei anhängen und beide Zuordnungsbefehle.                                                                    |
| Datei aus dem Download-Ordner löschen  | Entfernt die Eingabedatei nach erfolgreichem Anhängen oder Zuordnen (standardmäßig aktiv).                                            |
| Arbeitsmodus                           | Nur Zotero-Speicher, Externe Links oder Zotero-Speicher + externe Kopie; gilt für neue unterstützte Importe.                          |
| Externes Verzeichnis                   | Stammordner für Verknüpfungen oder externe Kopien; im Modus Nur Zotero-Speicher ausgeblendet.                                         |
| Unterordner                            | Metadatenvorlage; `{{collection}}` verwendet den Sammlungspfad.                                                                       |
| `/` als Unterordner                    | Behält durch Vorlagenvariablen erzeugte Ebenen bei.                                                                                   |
| Automatisch beim Hinzufügen umbenennen | Globale Zotero-Einstellung zur Umbenennung neuer Anhänge.                                                                             |
| Importierte PDF-Metadaten abrufen      | Erkennt eigenständige importierte PDFs automatisch; Umbenennen/Organisieren beginnt erst nach Erstellung des übergeordneten Eintrags. |
| Bei Eintragsänderung umbenennen        | Optionale nachträgliche Umbenennung mit Zeiten in Millisekunden.                                                                      |
| Neue Anhänge automatisch verschieben   | Nur Externe Links: wandelt neu importierte Anhänge in Verknüpfungen um; vorhandene Verknüpfungen werden nicht erneut verschoben.      |
| Originaldateien behalten               | Nur Externe Links: Verschieben wird zu Kopieren, der gespeicherte Anhang bleibt erhalten.                                             |
| Leere Ordner löschen                   | Entfernt leere Ordner im externen Verzeichnis, nachdem Dateien verschoben wurden.                                                     |
| Anhangstitel synchronisieren           | Aktualisiert nach dem Umbenennen den Titel in Zotero.                                                                                 |
| Diakritische Zeichen entfernen         | Wandelt Diakritika und Ligaturen im endgültigen Basisnamen einschließlich eines beibehaltenen Präfixes um; die Endung bleibt.         |
| Dateitypen                             | Kommagetrennte Endungen ohne Punkt. Standard: `pdf,doc,docx,txt,rtf,djvu,epub`.                                                       |
| Dateinamensregeln                      | Kommagetrennte reguläre Ausdrücke für Präfixe und Ausnahmen.                                                                          |

Ungültige reguläre Ausdrücke werden ignoriert und protokolliert, ohne die
Verarbeitung abzubrechen.

## Tastenkürzel

Tastenkürzel lassen sich in den Attanger-Einstellungen ändern und gelten
sofort.

| Aktion                          | Standard           | Standardmäßig aktiv |
| ------------------------------- | ------------------ | ------------------- |
| Neue Datei anhängen             | `Ctrl + I`         | Ja                  |
| Anhang zuordnen                 | `Ctrl + M`         | Ja                  |
| Anhang umbenennen               | `Ctrl + R`         | Nein                |
| Umbenennen und Verschieben/Sync | `Ctrl + Shift + R` | Nein                |
| Verschieben/Sync                | `Ctrl + Shift + M` | Nein                |

## Screenshots und Anleitungen

<img width="300" alt="Attanger-Einstellungen" src="https://github.com/user-attachments/assets/3125e608-7891-4afa-91f5-be8120a98988">
<img width="300" alt="Attanger-Kontextmenü" src="https://github.com/user-attachments/assets/9414737c-5d3d-43f3-83be-cf39d8f9c2b7">
<img width="300" alt="Attanger-Arbeitsablauf" src="https://github.com/user-attachments/assets/9c2ff395-66a1-4f1e-8e6a-7c90c3bc4121">

- [Videodemonstration (Chinesisch)](https://www.bilibili.com/video/BV1x64y1J7Rv)
- [Community-Anleitung (Französisch)](https://docs.zotero-fr.org/kbfr/kbfr_attanger_zotmoov/)

## Mitwirken

Fehlerberichte, Korrekturen, Funktionen, Tests, Dokumentation und Übersetzungen
sind willkommen. Kleine, klar abgegrenzte Pull Requests lassen sich besser
prüfen und sicherer veröffentlichen.

Fehlerberichte sollten Zotero- und Attanger-Version, Betriebssystem,
Arbeitsmodus, relevante Einstellungen, genaue Schritte und Debug-Ausgaben
enthalten. Private Literaturdaten und lokale Pfade vorher entfernen.

Lokale Entwicklung:

```bash
git clone https://github.com/MuiseDestiny/zotero-attanger.git
cd zotero-attanger
npm install
cp scripts/zotero-cmd-template.json scripts/zotero-cmd.json
# scripts/zotero-cmd.json auf ein separates Zotero-Testprofil einstellen
npm start
```

Vor einem Pull Request:

```bash
npm run build
# ESLint für die geänderten TypeScript-Dateien ausführen, zum Beispiel:
npx eslint src/modules/menu.ts
```

Die Produktions-XPI liegt unter `build/zotero-attanger.xpi`. Änderungen in
`src/` und `addon/` werden während der Entwicklung automatisch neu geladen.

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
