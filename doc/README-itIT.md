# Zotero Attanger

<p>
  <img src="../addon/chrome/content/icons/favicon.png" width="48" height="48" alt="Icona di Attanger">
</p>

Attanger (Attachment Manager) organizza gli allegati di Zotero: allega i file
scaricati di recente, associa i file agli elementi, li rinomina con i modelli
nativi di Zotero e li sposta o copia in una struttura di cartelle prevedibile.

[English](../README.md) | [简体中文](README-zhCN.md) | [Deutsch](README-de.md) | Italiano

[![Ultima versione](https://img.shields.io/github/v/release/MuiseDestiny/zotero-attanger)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Data di rilascio](https://img.shields.io/github/release-date/MuiseDestiny/zotero-attanger)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Download](https://img.shields.io/github/downloads/MuiseDestiny/zotero-attanger/latest/total)](https://github.com/MuiseDestiny/zotero-attanger/releases)
[![Licenza: AGPL-3.0-or-later](https://img.shields.io/github/license/MuiseDestiny/zotero-attanger)](../LICENSE)
[![Zotero 7-10](https://img.shields.io/badge/Zotero-7--10-CC2936?logo=zotero&logoColor=white)](https://www.zotero.org/)

## Funzioni principali

- Allega il file modificato più di recente da una cartella sorgente a un
  elemento Zotero o direttamente a una collezione.
- Conserva gli allegati in Zotero oppure converte i file importati in file
  collegati dentro una cartella di destinazione esterna.
- Rinomina uno o più allegati con il modello nativo di Zotero e, se richiesto,
  sincronizza il titolo dell'allegato.
- Crea sottocartelle dai metadati o da `{{collection}}`; `/` può delimitare
  cartelle annidate.
- Rinomina e organizza automaticamente i nuovi allegati importati.
- Rinomina facoltativamente i file collegati dopo le modifiche ai metadati.
  Debounce e ritardo sono utili con le chiavi di citazione di Better BibTeX e
  altri campi completati dopo l'importazione.
- Associa PDF/CAJ agli elementi in base alla somiglianza del titolo, anche
  leggendo metadati o testo del PDF.
- Ricollega con precisione i file che rispettano già lo schema di cartelle e
  nomi previsto da Attanger.
- Sposta o copia allegati mantenendo annotazioni, relazioni, indice full-text,
  tag e note durante la conversione in file collegato.
- Apre gli allegati con Zotero, l'applicazione di sistema o applicazioni
  personalizzate memorizzate.
- Configura scorciatoie, estensioni supportate, pulizia e regole con espressioni
  regolari.

## Installazione

1. Scarica l'ultimo `.xpi` dalla
   [pagina Releases](https://github.com/MuiseDestiny/zotero-attanger/releases).
2. In Zotero apri **Strumenti > Plugin**. Nelle versioni meno recenti la voce
   può chiamarsi **Strumenti > Componenti aggiuntivi**.
3. Dal menu con l'ingranaggio scegli **Installa plugin da file** e seleziona lo
   `.xpi`.
4. Riavvia Zotero se richiesto.

Il manifest attuale supporta Zotero dalla versione 7 alla versione 10.

## Prima configurazione

Apri **Impostazioni di Zotero > Attanger**:

1. Imposta il **Percorso sorgente**, dove browser, scanner o altri strumenti
   salvano i nuovi file.
2. Scegli il **Tipo di allegato**:
   - **Copia archiviata** per Zotero Storage o WebDAV.
   - **Collegamento** per OneDrive, Dropbox, Nutstore o altri servizi esterni.
3. Con **Collegamento**, configura il **Percorso di destinazione**. Mantieni
   attivo **Sposta automaticamente gli allegati aggiunti** per convertire
   automaticamente i file importati.
4. Imposta, se necessario, il modello **Sottocartella**. Il valore predefinito
   `{{collection}}` segue la gerarchia delle collezioni dell'elemento.
5. Usa **Personalizza formato del nome file** per modificare il modello nativo
   di Zotero. Consulta la
   [documentazione di Zotero](https://www.zotero.org/support/file_renaming).
6. Prima di operazioni in blocco controlla automazioni, tipi di file,
   scorciatoie e conservazione dei file sorgente.

I file collegati non vengono caricati dalla sincronizzazione file di Zotero.
La cartella di destinazione deve essere sincronizzata o salvata separatamente.

## Flussi di lavoro comuni

### Allegare l'ultimo download

1. Salva un file nella cartella sorgente configurata.
2. Seleziona esattamente un elemento bibliografico in Zotero.
3. Scegli **Attanger > Allega nuovo file** oppure premi `Ctrl + I`.

Attanger usa il file non nascosto modificato più di recente. Lo stesso comando
nel menu di una collezione crea un allegato di primo livello. Se **Mantieni i
file originali** non è attivo, il file sorgente viene eliminato dopo
l'importazione riuscita.

### Associare file a più elementi

1. Inserisci PDF o CAJ direttamente nella cartella sorgente.
2. Seleziona uno o più elementi bibliografici.
3. Scegli **Attanger > Associa allegato**.

Ogni file sorgente viene usato al massimo una volta. Attanger confronta titoli
e nomi file e, secondo l'opzione **Leggi titolo dal file PDF**, può analizzare
metadati o testo del PDF. I file associati seguono poi le automazioni di rinomina
e spostamento configurate.

### Ricollegare una libreria Attanger esistente

**Attanger > Associa allegato Attanger** cerca la struttura:

```text
Percorso sorgente / sottocartella generata / nome generato da Zotero.estensione
```

Per ogni elemento selezionato, Attanger controlla le estensioni configurate e
aggiunge i file corrispondenti come collegamenti senza copiarli.

### Rinominare, spostare o copiare allegati esistenti

Seleziona elementi bibliografici, allegati figli o allegati di primo livello,
quindi usa:

- **Rinomina allegato** per applicare il modello di Zotero.
- **Sposta allegato** per collocare i file sotto la destinazione.
- **Rinomina e sposta allegato** per eseguire entrambe le operazioni.
- **Annulla spostamento allegato** per usare la conversione di Zotero da file
  collegato a file archiviato.

Con **Mantieni i file originali**, le voci Sposta diventano Copia e i file
sorgente restano al loro posto. Lo spostamento richiede **Tipo di allegato:
Collegamento**. In caso di nomi di destinazione uguali viene aggiunto un
suffisso; un file di destinazione identico non viene copiato di nuovo.

### Rinominare dopo gli aggiornamenti di Better BibTeX

Se il modello usa una chiave di citazione Better BibTeX o un campo valorizzato
dopo l'importazione:

1. Disattiva **Rinomina automaticamente gli allegati aggiunti** se agisce troppo
   presto.
2. Attiva **Rinomina automaticamente i file collegati quando cambia
   l'elemento**.
3. Mantieni il debounce predefinito di `1000 ms` o aumenta il ritardo se il
   provider aggiorna più volte i metadati.

Vengono elaborati solo file collegati esistenti e supportati. Gli eventi
ripetuti vengono deduplicati e i salvataggi di Attanger non creano cicli.

## Riferimento delle impostazioni

| Impostazione                          | Comportamento                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Percorso sorgente                     | Cartella usata da Allega nuovo file e dai due comandi di associazione.                                                   |
| Tipo di allegato                      | Copia archiviata in Zotero o file collegato gestito nella destinazione.                                                  |
| Destinazione                          | Cartella principale per spostamento/copia in modalità Collegamento.                                                      |
| Sottocartella                         | Modello basato sui metadati; `{{collection}}` usa il percorso della collezione.                                          |
| Interpreta `/` come sottocartella     | Mantiene i livelli prodotti dalle variabili del modello.                                                                 |
| Rinomina automaticamente all'aggiunta | Preferenza globale di Zotero per i nuovi allegati.                                                                       |
| Rinomina quando cambia l'elemento     | Flusso opzionale dopo la modifica, con tempi in millisecondi.                                                            |
| Sposta automaticamente                | Converte i nuovi file importati in collegamenti; i collegamenti esistenti non vengono spostati di nuovo automaticamente. |
| Elimina cartelle vuote                | Pulisce solo dentro l'archivio Zotero, la sorgente o la destinazione.                                                    |
| Mantieni file originali               | Trasforma lo spostamento in copia e impedisce la pulizia della sorgente.                                                 |
| Sincronizza titolo                    | Aggiorna il titolo Zotero dopo una rinomina del file.                                                                    |
| Tipi di file                          | Estensioni separate da virgole, senza punto. Predefinito: `pdf,doc,docx,txt,rtf,djvu,epub`.                              |
| Regole nomi file                      | Espressioni regolari separate da virgole per prefissi ed eccezioni.                                                      |

Le espressioni regolari non valide vengono ignorate e registrate nel log senza
interrompere l'elaborazione.

## Scorciatoie

Le scorciatoie sono modificabili nelle impostazioni di Attanger e diventano
attive immediatamente.

| Azione                  | Predefinita        | Attiva inizialmente |
| ----------------------- | ------------------ | ------------------- |
| Allega nuovo file       | `Ctrl + I`         | Sì                  |
| Associa allegato        | `Ctrl + M`         | Sì                  |
| Rinomina allegato       | `Ctrl + R`         | No                  |
| Rinomina e sposta/copia | `Ctrl + Shift + R` | No                  |
| Sposta/copia allegato   | `Ctrl + Shift + M` | No                  |

## Schermate e guide

<img width="300" alt="Impostazioni di Attanger" src="https://github.com/user-attachments/assets/3125e608-7891-4afa-91f5-be8120a98988">
<img width="300" alt="Menu di Attanger" src="https://github.com/user-attachments/assets/9414737c-5d3d-43f3-83be-cf39d8f9c2b7">
<img width="300" alt="Flusso di Attanger" src="https://github.com/user-attachments/assets/9c2ff395-66a1-4f1e-8e6a-7c90c3bc4121">

- [Dimostrazione video (cinese)](https://www.bilibili.com/video/BV1x64y1J7Rv)
- [Guida della comunità (francese)](https://docs.zotero-fr.org/kbfr/kbfr_attanger_zotmoov/)

## Contribuire

Segnalazioni, correzioni, nuove funzioni, test, documentazione e traduzioni sono
benvenuti. Pull request piccole e mirate sono più semplici da verificare e
pubblicare in sicurezza.

Una segnalazione dovrebbe includere versioni di Zotero e Attanger, sistema
operativo, tipo di allegato, impostazioni rilevanti, passaggi esatti e output di
debug. Rimuovi dati bibliografici privati e percorsi locali dai log.

Sviluppo locale:

```bash
git clone https://github.com/MuiseDestiny/zotero-attanger.git
cd zotero-attanger
npm install
cp scripts/zotero-cmd-template.json scripts/zotero-cmd.json
# Configura scripts/zotero-cmd.json con un profilo Zotero di test separato
npm start
```

Prima di aprire una pull request:

```bash
npm run build
# Esegui ESLint sui file TypeScript modificati, per esempio:
npx eslint src/modules/menu.ts
```

Lo XPI di produzione si trova in `build/zotero-attanger.xpi`. Durante lo
sviluppo, le modifiche in `src/` e `addon/` vengono ricaricate automaticamente.

### I contributi assistiti dall'IA sono benvenuti

È possibile usare strumenti di IA per implementazione, debug, test,
documentazione o traduzione. L'uso dell'IA non è un motivo di rifiuto, ma chi
invia il contributo resta responsabile del risultato:

- Rivedere e comprendere le modifiche generate prima dell'invio.
- Provare realmente i flussi interessati e indicare cosa è stato verificato.
- Mantenere la modifica mirata, senza riscritture generate non pertinenti.
- Non inviare a servizi IA librerie private, log, credenziali o documenti
  protetti senza autorizzazione.
- Verificare licenze e regole sulle dipendenze anche per codice e risorse
  generati.
- Dichiarare brevemente l'assistenza IA rilevante nella pull request quando
  aiuta i revisori a capire produzione o verifica della modifica.

Le traduzioni dell'interfaccia sono in `addon/locale/`, quelle della
documentazione in `doc/`. Chiavi e descrizioni devono restare allineate.

## Licenza e crediti

Zotero Attanger è distribuito con licenza
[AGPL-3.0-or-later](../LICENSE). Il flusso di gestione degli allegati è
fortemente ispirato a ZotFile. Il progetto usa
[Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template)
e [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit).
