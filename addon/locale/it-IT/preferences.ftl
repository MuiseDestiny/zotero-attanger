directory = Cartella principale:
choose-dir =
    .label = Scegli…
setting = Impostazioni
read-pdf-title = Leggi il titolo dal PDF
readPDFtitle-never =
    .label = Mai
readPDFtitle-nonCJK =
    .label = Tranne per CJK
readPDFtitle-always =
    .label = Sempre
subfolder = Sottocartella
slash-as-subfolder-delimiter =
    .label = Interpretare le barre (/) nelle variabili come delimitatori di sottocartelle
auto-rename =
    .label = Rinomina automaticamente gli allegati aggiunti
auto-recognize-imported-pdf =
    .label = Riconosci i PDF importati autonomi
auto-rename-on-modify =
    .label = Rinomina automaticamente gli allegati collegati quando l'elemento cambia
auto-rename-on-modify-help =
    .tooltiptext = Perché attivare: Zotero normalmente rinomina gli allegati quando vengono aggiunti; i file collegati esistenti possono mantenere il vecchio nome dopo modifiche a titolo, autore, anno o citation key di Better BibTeX. Attiva per sincronizzare i nomi automaticamente; lascia disattivato se preferisci rinominare manualmente.
    .aria-label = Spiegazione della rinomina automatica degli allegati collegati
auto-rename-on-modify-debounce =
    .label = Debounce rinomina dopo modifica (ms)
auto-rename-on-modify-debounce-help =
    .tooltiptext = Perché serve: una modifica può generare più eventi e rinomine ripetute. Il valore è il periodo di quiete dopo l'ultima modifica. Usa normalmente 1000 ms, 1500–3000 ms se le ripetizioni continuano oppure 300–500 ms per una risposta più rapida.
    .aria-label = Spiegazione del debounce della rinomina
auto-rename-on-modify-delay =
    .label = Ritardo rinomina dopo modifica (ms)
auto-rename-on-modify-delay-help =
    .tooltiptext = Perché serve: Zotero o Better BibTeX possono aggiornare titolo, autore, anno o citation key in modo asincrono, quindi una rinomina anticipata può usare valori vecchi. È un'attesa aggiuntiva dopo il debounce. Inizia con 300–1000 ms, usa 1500–3000 ms se restano valori vecchi oppure disattiva se non serve.
    .aria-label = Spiegazione del ritardo della rinomina
auto-move =
    .label = Sposta automaticamente i nuovi allegati nella cartella di archiviazione
auto-remove-empty-folder =
    .label = Elimina automaticamente le cartelle vuote dopo lo spostamento
move-without-deleting =
    .label = Mantieni i file originali (lo spostamento diventa copia)
delete-source-after-import =
    .label = Elimina il file dalla cartella dei download dopo averlo allegato o abbinato
file-types = Tipi di allegati da rinominare/spostare
filename-as-prefix-rules = Se si seguono le seguenti regole di denominazione, il nome file originale verrà mantenuto come prefisso durante la rinomina.
filename-rules-instructions = Utilizzare espressioni regolari, separando più espressioni con ','.
filename-skip-rename-rules = Se si seguono le seguenti regole di denominazione, gli allegati non verranno rinominati.
filename-skip-auto-move-rename-rules = Se si seguono le seguenti regole di denominazione, gli allegati non verranno spostati, copiati o rinominati automaticamente.
about-title = Info
about-intro = Attanger è l'abbreviazione di Attachment Manager; questo progetto si ispira ampiamente al plugin ZotFile per Zotero 6.
about-pro-plugins = Altri plugin
preferences-file-renaming-customize-button =
    .label = Personalizza il formato del nome dei file…
attach-new-file-shortcut =
    .label = Allega nuovo file
match-attachment-shortcut =
    .label = Abbina allegato
rename-attachment-shortcut =
    .label = Rinomina allegato
rename-move-attachment-shortcut =
    .label = Rinomina e sposta/sincronizza allegato
move-attachment-shortcut =
    .label = Sposta/sincronizza allegato
sync-attachment-title =
    .label = Sincronizza il titolo dell'allegato dopo la rinominazione
remove-diacritics =
    .label = Rimuovi i segni diacritici dai nomi dei file
settings-required = Obbligatorio
work-mode-title = Modalità di lavoro
work-mode-stored-label =
    .label = Solo archivio Zotero
work-mode-linked-label =
    .label = Collegamenti esterni
work-mode-copy-label =
    .label = Archivio Zotero + copia esterna
work-mode-stored-description = Gli allegati restano in Zotero e usano la sincronizzazione file di Zotero. Le regole di rinomina restano attive.
work-mode-linked-description = Gli allegati vengono spostati in una cartella esterna e aperti tramite collegamento. Corrisponde al precedente tipo «Collegamento».
work-mode-stored-footnote = Nessuna cartella esterna necessaria
work-mode-linked-footnote = Sincronizzazione cloud · Solo libreria personale
work-mode-copy-description = Gli allegati restano in Zotero e una copia ordinata viene mantenuta in una cartella esterna.
work-mode-copy-footnote = Sincronizzazione Zotero più accesso esterno
work-mode-linked-directory = Cartella di archiviazione
work-mode-copy-directory = Cartella delle copie
work-mode-directory-placeholder =
    .placeholder = Scegli una cartella esterna
work-mode-status-checking = Verifica della cartella…
work-mode-status-stored = Pronto all'uso, nessuna cartella esterna necessaria
work-mode-status-ready = Configurazione completata
work-mode-status-missing = Scegli una cartella esterna per completare la configurazione
work-mode-status-invalid = Cartella non disponibile; sceglila di nuovo
work-mode-status-unsafe = Scegli una cartella esterna all'archivio di Zotero
work-mode-status-readonly = Cartella non scrivibile; scegline un'altra
work-mode-stored-renaming = I nuovi allegati sono archiviati in Zotero e usano le impostazioni di rinomina correnti.
work-mode-stored-original-name = I nuovi allegati sono archiviati in Zotero con il nome file originale.
work-mode-linked-ready-note = «Sposta allegato» mette i file in questa cartella. Attiva lo spostamento automatico qui sotto per spostare anche i nuovi allegati.
work-mode-copy-ready-note = Zotero apre i propri file archiviati; le copie si aggiornano in un solo verso da Zotero.
work-mode-missing-note = Scegli una cartella per iniziare. Senza cartella, gli allegati non vengono spostati né copiati.
work-mode-invalid-note = La cartella potrebbe essere stata rimossa, spostata o smontata. Scegli una cartella disponibile.
work-mode-unsafe-note = Non si può usare la cartella di archiviazione di Zotero né un percorso che vi conduce (anche tramite collegamento simbolico).
work-mode-readonly-note = Attanger necessita dei permessi di scrittura. Controlla i permessi o lo stato dell'unità sincronizzata.
work-mode-summary-stored = Solo archivio Zotero · Pronto
work-mode-summary-linked = Collegamenti esterni · { $state ->
    [ready] Pronto
    [checking] Verifica
    [missing] Scegli una cartella
   *[other] Controlla la cartella
    }
work-mode-summary-copy = Archivio Zotero + copia esterna · { $state ->
    [ready] Pronto
    [checking] Verifica
    [missing] Scegli una cartella
   *[other] Controlla la cartella
    }
linked-options-title = Opzioni collegamento
work-mode-linked-sync-note = Gli allegati collegati non usano la sincronizzazione file di Zotero; sincronizza la cartella con un servizio cloud. Gli allegati delle librerie di gruppo non vengono convertiti.
work-mode-copy-sync-title = Informazioni sulle copie
work-mode-copy-update = Le copie seguono le regole di sottocartella e nome file. Dopo aver rinominato un allegato o cambiato le sue collezioni, la copia viene spostata e quella vecchia rimossa. Le copie si aggiornano solo da Zotero: una copia modificata esternamente non viene mai sovrascritta ed eliminando l'allegato Zotero la copia resta. Le copie PDF non includono le annotazioni salvate nel database di Zotero.
work-mode-official-sync-note = La sincronizzazione file di Zotero (Zotero Storage o WebDAV) si configura come di consueto nelle impostazioni di sincronizzazione di Zotero.
work-mode-existing = Cambiare modalità non modifica gli allegati esistenti. Per organizzarli, fai clic destro su un elemento e usa «Sposta allegato» o «Sincronizza copia esterna».
work-mode-scope = I nuovi allegati (Attanger, trascinamento e Connector) vengono elaborati secondo la modalità corrente; i file collegati aggiunti direttamente non vengono convertiti. I PDF autonomi vengono elaborati solo dopo che il riconoscimento automatico crea un elemento padre.
directory-naming-title = Nomi allegati e cartelle
organizing-rules-summary = { $mode ->
    [stored] Nome file: { $rename ->
        [enabled] Regole Zotero correnti
       *[disabled] Nessuna rinomina automatica
        }
   *[external] Sottocartella: { $layout ->
        [collection] Per collezione
        [year] Per anno
        [flat] Nessuna
       *[custom] { $template }
        } · Nome file: { $rename ->
        [enabled] Regole Zotero correnti
       *[disabled] Nessuna rinomina automatica
        }
    }
filename-rule-title = Regole per i nomi dei file
filename-zotero-rule-note = Usa le impostazioni di rinomina di Zotero. Modificale nell'editor nativo di Zotero.
subfolder-layout-collection =
    .label = Per collezione Zotero
subfolder-layout-year =
    .label = Per anno
subfolder-layout-flat =
    .label = Nessuna sottocartella
subfolder-layout-custom =
    .label = Modello personalizzato…
subfolder-template-title = Modello di sottocartella
rules-preview-filename = Esempio di nome file
rules-preview-path = Esempio di percorso
rules-preview-unconfigured = Cartella selezionata/{ $path }
rules-preview-unavailable = Impossibile mostrare l'anteprima; controlla il modello nell'editor di rinomina di Zotero.
rules-preview-note = Esempio: Wang, 2026, Learning representations, nella collezione Machine Learning. Gli allegati reali non vengono modificati.
rules-preview-skipped = Il file di esempio paper-2026.pdf è escluso dai tipi di file o dalle eccezioni correnti; l'elaborazione automatica ne mantiene posizione e nome.
source-import-title = Cartella dei download
source-import-optional-note = Usata da «Allega nuovo file» e «Abbina allegato»
source-directory-title = Percorsi delle cartelle dei download
source-directory-placeholder =
    .placeholder = Non impostata; le importazioni normali funzionano comunque
add-source-dir =
    .label = Aggiungi cartella…
remove-source-dir =
    .label = Rimuovi
source-directory-note = «Allega nuovo file» usa il file più recente tra tutte le cartelle; «Abbina allegato» le cerca in ordine.
automatic-processing-title = Elaborazione automatica
more-settings-summary = Riconoscimento PDF, rinomina dopo le modifiche, eccezioni
auto-recognize-imported-pdf-note = L'elaborazione avviene dopo che il riconoscimento crea un elemento padre. Se disattivato o non riuscito, il PDF resta invariato.
rename-timing-title = Regola il tempo di attesa dopo le modifiche
automatic-processing-scope-title = Quali importazioni vengono elaborate automaticamente?
filename-exceptions-title = Tipi di file ed eccezioni di rinomina
shortcuts-title = Scorciatoie da tastiera
shortcuts-summary = Spunta per attivare, poi fai clic nel campo e premi la combinazione di tasti
