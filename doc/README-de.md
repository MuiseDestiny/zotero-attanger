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
- Anhänge als Zotero-Kopie speichern oder importierte Dateien in verknüpfte
  Dateien in einem externen Zielordner umwandeln.
- Einen oder mehrere Anhänge mit Zotero-Vorlagen umbenennen und optional den
  Anhangstitel synchronisieren.
- Unterordner aus Metadaten oder `{{collection}}` erzeugen; `/` kann als
  Trennzeichen für verschachtelte Ordner verwendet werden.
- Neu importierte Anhänge automatisch umbenennen und organisieren.
- Verknüpfte Anhänge nach Metadatenänderungen umbenennen. Entprellzeit und
  Verzögerung unterstützen Better-BibTeX-Zitierschlüssel und andere Felder,
  die erst nach dem Import feststehen.
- PDF-/CAJ-Dateien anhand ähnlicher Titel zuordnen; bei PDF-Dateien können
  Metadaten oder Text zur Titelerkennung verwendet werden.
- Dateien, die bereits Attangers Ordner- und Dateinamenschema entsprechen,
  präzise wieder verknüpfen.
- Anhänge verschieben oder kopieren und beim Umwandeln Anmerkungen,
  Beziehungen, Volltextindex, Tags und Notizen übertragen.
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

Unter **Zotero-Einstellungen > Attanger**:

1. **Quellpfad** festlegen: Hier legen Browser, Scanner oder andere Programme
   neue Dateien ab.
2. **Anhangstyp** wählen:
   - **Gespeicherte Kopie** für Zotero Storage oder WebDAV.
   - **Verknüpfung** für OneDrive, Dropbox, Nutstore oder andere externe
     Synchronisation.
3. Im Modus **Verknüpfung** einen **Zielpfad** festlegen. **Hinzugefügte
   Anhänge automatisch verschieben** muss aktiviert bleiben, wenn importierte
   Dateien automatisch umgewandelt werden sollen.
4. Optional eine **Unterordner**-Vorlage angeben. Standardmäßig folgt
   `{{collection}}` der Sammlungshierarchie des Eintrags.
5. Über **Dateinamensformat anpassen** die native Zotero-Vorlage bearbeiten.
   Syntax und Variablen erklärt die
   [Zotero-Dokumentation](https://www.zotero.org/support/file_renaming).
6. Vor größeren Stapeloperationen Automatik, Dateitypen, Tastenkürzel und die
   Option zum Beibehalten der Quelldateien prüfen.

Verknüpfte Dateien werden nicht über Zoteros Dateisynchronisation hochgeladen.
Der Zielordner muss separat synchronisiert oder gesichert werden.

## Typische Arbeitsabläufe

### Letzten Download anhängen

1. Eine Datei im konfigurierten Quellordner speichern.
2. Genau einen regulären Zotero-Eintrag auswählen.
3. **Attanger > Neue Datei anhängen** wählen oder `Ctrl + I` drücken.

Attanger verwendet die zuletzt geänderte, nicht versteckte Datei. Der Befehl
kann auch im Kontextmenü einer Sammlung verwendet werden; dort entsteht ein
übergeordneter Anhang. Ohne **Originaldateien behalten** wird die Quelldatei
nach erfolgreichem Import entfernt.

### Dateien mehreren Einträgen zuordnen

1. PDF- oder CAJ-Dateien direkt in den Quellordner legen.
2. Einen oder mehrere reguläre Zotero-Einträge auswählen.
3. **Attanger > Anhang zuordnen** wählen.

Jede Quelldatei wird höchstens einmal verwendet. Attanger vergleicht
Eintragstitel und Dateinamen und kann entsprechend **Titel aus PDF-Datei lesen**
auch PDF-Metadaten oder Text auswerten. Danach gelten die konfigurierten
Automatiken zum Umbenennen und Verschieben.

### Eine bestehende Attanger-Bibliothek wieder verknüpfen

**Attanger > Attanger-Anhang zuordnen** erwartet folgende Struktur:

```text
Quellpfad / erzeugter Unterordner / von Zotero erzeugter Dateiname.Endung
```

Für jeden ausgewählten Eintrag prüft Attanger die konfigurierten Endungen und
legt passende Dateien ohne Kopie als verknüpfte Anhänge an.

### Bestehende Anhänge umbenennen, verschieben oder kopieren

Reguläre Einträge, untergeordnete Anhänge oder übergeordnete Anhänge auswählen
und einen Befehl verwenden:

- **Anhang umbenennen** wendet die Zotero-Dateinamensvorlage an.
- **Anhang verschieben** legt Dateien unter dem Zielpfad ab.
- **Anhang umbenennen und verschieben** führt beides aus.
- **Verschieben rückgängig machen** verwendet Zoteros Umwandlung einer
  verknüpften Datei in eine gespeicherte Datei.

Mit **Originaldateien behalten** werden Verschieben-Befehle als Kopieren
angezeigt und Quelldateien bleiben erhalten. Verschieben ist nur mit
**Anhangstyp: Verknüpfung** aktiv. Bei unterschiedlichen Dateien mit gleichem
Zielnamen wird ein Suffix ergänzt; identische Zieldateien werden nicht erneut
kopiert.

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

| Einstellung                            | Verhalten                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Quellpfad                              | Eingabeordner für Neue Datei anhängen und beide Zuordnungsbefehle.                                                              |
| Anhangstyp                             | Gespeicherte Zotero-Kopie oder verknüpfte Datei unter dem Zielpfad.                                                             |
| Zielpfad                               | Stammordner für Verschieben/Kopieren im Verknüpfungsmodus.                                                                      |
| Unterordner                            | Metadatenvorlage; `{{collection}}` verwendet den Sammlungspfad.                                                                 |
| `/` als Unterordner                    | Behält durch Vorlagenvariablen erzeugte Ebenen bei.                                                                             |
| Automatisch beim Hinzufügen umbenennen | Globale Zotero-Einstellung zur Umbenennung neuer Anhänge.                                                                       |
| Bei Eintragsänderung umbenennen        | Optionale nachträgliche Umbenennung mit Zeiten in Millisekunden.                                                                |
| Automatisch verschieben                | Wandelt neue importierte Anhänge in verknüpfte Dateien um; bestehende Verknüpfungen werden nicht erneut automatisch verschoben. |
| Leere Ordner löschen                   | Bereinigt nur innerhalb des Zotero-Speichers, Quell- oder Zielpfads.                                                            |
| Originaldateien behalten               | Macht aus Verschieben ein Kopieren und verhindert Quellbereinigung.                                                             |
| Anhangstitel synchronisieren           | Aktualisiert nach dem Umbenennen den Titel in Zotero.                                                                           |
| Dateitypen                             | Kommagetrennte Endungen ohne Punkt. Standard: `pdf,doc,docx,txt,rtf,djvu,epub`.                                                 |
| Dateinamensregeln                      | Kommagetrennte reguläre Ausdrücke für Präfixe und Ausnahmen.                                                                    |

Ungültige reguläre Ausdrücke werden ignoriert und protokolliert, ohne die
Verarbeitung abzubrechen.

## Tastenkürzel

Tastenkürzel lassen sich in den Attanger-Einstellungen ändern und gelten
sofort.

| Aktion                              | Standard           | Standardmäßig aktiv |
| ----------------------------------- | ------------------ | ------------------- |
| Neue Datei anhängen                 | `Ctrl + I`         | Ja                  |
| Anhang zuordnen                     | `Ctrl + M`         | Ja                  |
| Anhang umbenennen                   | `Ctrl + R`         | Nein                |
| Umbenennen und Verschieben/Kopieren | `Ctrl + Shift + R` | Nein                |
| Anhang verschieben/kopieren         | `Ctrl + Shift + M` | Nein                |

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
Anhangstyp, relevante Einstellungen, genaue Schritte und Debug-Ausgaben
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
