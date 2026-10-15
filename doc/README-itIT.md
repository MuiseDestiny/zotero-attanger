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
- Sceglie una modalità di lavoro: solo archivio Zotero, collegamenti esterni
  oppure archivio Zotero con una copia esterna organizzata (la
  sincronizzazione file di Zotero continua a funzionare).
- Rinomina uno o più allegati con il modello nativo di Zotero e, se richiesto,
  sincronizza il titolo dell'allegato.
- Converte facoltativamente segni diacritici e legature nei nomi generati in
  equivalenti ASCII, migliorando la compatibilità con file system e strumenti.
- Crea sottocartelle dai metadati o da `{{collection}}`; `/` può delimitare
  cartelle annidate.
- Rinomina automaticamente i nuovi allegati importati e li elabora secondo la modalità.
- Rinomina facoltativamente i file collegati dopo le modifiche ai metadati.
  Debounce e ritardo sono utili con le chiavi di citazione di Better BibTeX e
  altri campi completati dopo l'importazione.
- Associa PDF/CAJ agli elementi in base alla somiglianza del titolo, anche
  leggendo metadati o testo del PDF.
- Ricollega con precisione i file che rispettano già lo schema di cartelle e
  nomi previsto da Attanger.
- Sposta o copia gli allegati esistenti, trasferendo annotazioni, relazioni,
  indice full-text, tag e note durante la conversione in file collegati.
- Aggiorna le copie esterne a senso unico da Zotero; una copia modificata
  esternamente non viene mai sovrascritta.
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

Apri **Impostazioni di Zotero > Attanger** e scegli una **Modalità di lavoro**:

| Modalità                        | Zotero apre     | Sincronizzazione file   | Cartella esterna               |
| ------------------------------- | --------------- | ----------------------- | ------------------------------ |
| Solo archivio Zotero            | File archiviato | Zotero Storage / WebDAV | Non necessaria                 |
| Collegamenti esterni            | File collegato  | Cloud o altro strumento | I file vengono spostati lì     |
| Archivio Zotero + copia esterna | File archiviato | Zotero Storage / WebDAV | Copia organizzata e aggiornata |

1. Per **Collegamenti esterni** o **Archivio Zotero + copia esterna**, scegli
   la cartella esterna. Deve trovarsi fuori dall'archivio Zotero, anche
   se raggiunta tramite un collegamento simbolico.
2. Se vuoi, regola **Nomi allegati e cartelle**. La sottocartella predefinita
   `{{collection}}` segue la gerarchia delle collezioni; **Personalizza il
   formato del nome dei file** apre l'editor nativo di Zotero. Consulta la
   [documentazione di Zotero](https://www.zotero.org/support/file_renaming).
3. Per **Allega nuovo file** o l'associazione, imposta la **Cartella dei
   download**. Con **Aggiungi cartella** puoi aggiungerne altre: Allega nuovo
   file usa il file più recente tra tutte, l'associazione le cerca in ordine.
4. Prima di operazioni in blocco controlla elaborazione automatica, tipi di
   file e scorciatoie.

### Aggiornamento da versioni precedenti

La modalità viene ricavata una sola volta dalle impostazioni esistenti, quindi
dopo l'aggiornamento non cambia nulla:

- **Tipo di allegato: Collegamento** con un percorso di destinazione diventa
  **Collegamenti esterni**. **Sposta automaticamente i nuovi allegati** e
  **Mantieni i file originali** conservano il loro significato in questa
  modalità.
- Ogni altra configurazione diventa **Solo archivio Zotero**.
- **Mantieni i file originali** diventa anche (invertita) la nuova opzione
  **Elimina il file dalla cartella dei download**, così le importazioni dalla
  cartella sorgente funzionano come prima.

Voci di menu e scorciatoie mantengono gli stessi ID. Cambiare modalità non
converte mai automaticamente gli allegati esistenti.

I file collegati non vengono caricati dalla sincronizzazione file di Zotero;
in modalità Collegamenti esterni la cartella va sincronizzata o salvata
separatamente. Gli allegati delle librerie di gruppo non vengono mai convertiti
in collegamenti.

## Flussi di lavoro comuni

### Allegare l'ultimo download

1. Salva un file nella cartella sorgente configurata.
2. Seleziona esattamente un elemento bibliografico in Zotero.
3. Scegli **Attanger > Allega nuovo file** oppure premi `Ctrl + I`.

Attanger usa il file non nascosto modificato più di recente. Lo stesso comando
nel menu di una collezione crea un allegato di primo livello. Dopo
un'importazione riuscita il file di input viene eliminato, a meno che **Elimina
il file dalla cartella dei download** sia disattivata.

### Associare file a più elementi

1. Inserisci PDF o CAJ direttamente nella cartella sorgente.
2. Seleziona uno o più elementi bibliografici.
3. Scegli **Attanger > Associa allegato**.

Ogni file sorgente viene usato al massimo una volta. Attanger confronta titoli
e nomi file e, secondo l'opzione **Leggi titolo dal file PDF**, può analizzare
metadati o testo del PDF. I file associati seguono poi le automazioni di rinomina
configurate e la modalità di lavoro.

### Ricollegare una libreria Attanger esistente

**Attanger > Associa allegato Attanger** cerca la struttura:

```text
Percorso sorgente / sottocartella generata / nome generato da Zotero.estensione
```

Per ogni elemento selezionato, Attanger controlla le estensioni configurate.
In modalità Collegamenti esterni i file corrispondenti vengono collegati senza
copiarli; nelle modalità di archivio vengono importati in Zotero, così la
sincronizzazione file continua a funzionare.

### Rinominare, spostare o sincronizzare allegati esistenti

Seleziona elementi bibliografici, allegati figli o allegati di primo livello,
quindi usa:

- **Rinomina allegato** per applicare il modello di Zotero (tutte le modalità).
- **Sposta allegato** (Collegamenti esterni) per inserire i file nella cartella
  esterna. Con **Mantieni i file originali** i comandi diventano «Copia».
- **Sincronizza copia esterna** (Archivio Zotero + copia esterna) per creare o
  aggiornare la copia senza modificare l'allegato archiviato.
- **Rinomina e sposta/sincronizza** per eseguire entrambe le operazioni. In
  Solo archivio Zotero rinomina soltanto e il comando Sposta è nascosto.
- **Annulla lo spostamento allegato** per usare la conversione di Zotero da
  file collegato a file archiviato.

File diversi con la stessa destinazione ricevono un suffisso; i file di
destinazione identici non vengono copiati di nuovo.

### Aggiornare le copie esterne

In modalità Archivio Zotero + copia esterna i nuovi allegati archiviati
ricevono automaticamente una copia. Le copie esistenti seguono a senso unico
rinomine, cambi di collezione e modifiche del file, circa un secondo dopo la
modifica. Gli allegati collegati non ricevono copie.

- Una copia modificata fuori da Zotero viene conservata e mai sovrascritta;
  Attanger segnala un conflitto.
- Se il percorso di destinazione cambia, la vecchia copia viene rimossa solo se
  è invariata e non è usata da altri allegati.
- Eliminare un allegato Zotero non elimina la sua copia esterna.
- Le copie PDF contengono solo i byte del file; le annotazioni del database di
  Zotero non vengono incorporate.

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

| Impostazione                            | Comportamento                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Cartella dei download                   | Cartella usata da Allega nuovo file e dai due comandi di associazione.                                                                |
| Elimina il file dai download            | Rimuove il file di input dopo un'aggiunta o associazione riuscita (attiva per impostazione predefinita).                              |
| Modalità di lavoro                      | Solo archivio Zotero, Collegamenti esterni o Archivio Zotero + copia esterna; applicata ai nuovi importati supportati.                |
| Cartella esterna                        | Radice per collegamenti o copie esterne; nascosta in Solo archivio Zotero.                                                            |
| Sottocartella                           | Modello basato sui metadati; `{{collection}}` usa il percorso della collezione.                                                       |
| Interpreta `/` come sottocartella       | Mantiene i livelli prodotti dalle variabili del modello.                                                                              |
| Rinomina automaticamente all'aggiunta   | Preferenza globale di Zotero per i nuovi allegati.                                                                                    |
| Recupera metadati dei PDF importati     | Riconosce automaticamente i PDF importati autonomi; rinomina/organizzazione inizia dopo la creazione dell'elemento padre.             |
| Rinomina quando cambia l'elemento       | Flusso opzionale dopo la modifica, con tempi in millisecondi.                                                                         |
| Sposta automaticamente i nuovi allegati | Solo Collegamenti esterni: converte i nuovi allegati importati in file collegati; quelli già collegati non vengono spostati di nuovo. |
| Mantieni i file originali               | Solo Collegamenti esterni: lo spostamento diventa copia e l'allegato archiviato resta.                                                |
| Elimina cartelle vuote                  | Rimuove le cartelle vuote nella cartella esterna dopo lo spostamento dei file.                                                        |
| Sincronizza titolo                      | Aggiorna il titolo Zotero dopo una rinomina del file.                                                                                 |
| Rimuovi segni diacritici                | Converte segni diacritici e legature nel nome base finale, incluso un prefisso originale mantenuto; conserva l'estensione.            |
| Tipi di file                            | Estensioni separate da virgole, senza punto. Predefinito: `pdf,doc,docx,txt,rtf,djvu,epub`.                                           |
| Regole nomi file                        | Espressioni regolari separate da virgole per prefissi ed eccezioni.                                                                   |

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
| Rinomina e sposta/sinc. | `Ctrl + Shift + R` | No                  |
| Sposta/sincronizza      | `Ctrl + Shift + M` | No                  |

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
operativo, modalità di lavoro, impostazioni rilevanti, passaggi esatti e output di
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
