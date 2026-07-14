directory = Directory di base:
choose-dir = 
    .label = Scegli…
setting = Impostazioni

source-title = Percorso sorgente
source-intro = &lt;Allega nuovo file&gt; recupererà i nuovi file aggiunti alla directory selezionata e li allegherà all'elemento o alla collezione in Zotero.

read-pdf-title = leggi il titolo dal file PDF
readPDFtitle-never =
    .label = Mai
readPDFtitle-nonCJK =
    .label = Tranne per CJK
readPDFtitle-always =
    .label = Sempre

attach-title = Allega come
attach-intro = Se si usa il servizio di sincronizzazione di Zotero, o WebDAV scegliere &lt;Copia salvata&gt;; se si usa un servizio esterno tipo OneDrive, ecc., scegliere &lt;Link&gt; e configurare correttamente il &lt;Percorso di destinazione&gt;. I file saranno spostati nel percorso di destinazione e da lì importati in Zotero come allegati collegati.
attach-type-start = Allega file
attach-type-end = all'elemento/collezione Zotero
importing =
    .label = Copia salvata
linking =
    .label = Link

dest-title = Percorso di destinazione
dest-intro = &lt;Sposta allegato&gt; sposterà l'allegato in questo percorso e il percorso finale sarà &lt;Directory di base/Sottocartella/Nome file&gt;. Lasciare vuoto se non è richiesta alcuna &lt;Sottocartella&gt;.
subfolder = Sottocartella:

slash-as-subfolder-delimiter =
    .label = Interpretare le barre (/) nelle variabili come delimitatori di sottocartelle

filename = Filename:

other-title = Altre impostazioni
auto-rename = 
    .label = Rinomina automaticamente gli allegati aggiunti
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
    .label = Sposta automaticamente gli allegati aggiunti
auto-remove-empty-folder = 
    .label = Elimina automaticamente le cartelle vuote dopo lo spostamento
move-without-deleting = 
    .label = Mantieni i file originali (non eliminare mai i file di origine); lo spostamento diventa una copia
file-types = Tipi di allegati per la rinominazione/spostamento
filename-as-prefix-rules = Se si seguono le seguenti regole di denominazione, il nome file originale verrà mantenuto come prefisso durante la rinomina.
filename-rules-instructions = Utilizzare espressioni regolari, separando più espressioni con ','.
filename-skip-rename-rules = Se si seguono le seguenti regole di denominazione, gli allegati non verranno rinominati.
filename-skip-auto-move-rename-rules = Se si seguono le seguenti regole di denominazione, gli allegati non verranno spostati o rinominati automaticamente.
about-title = Info
about-intro = 🌠 Attanger è un'abbreviazione per Attachment Manager (gestore di allegati); questo progetto si basa grandemende sul plugin zotfile per Zotero 6.


preferences-file-renaming-customize-button =
    .label = Personalizza il formato del nome dei file…

preferences-file-renaming-format-instructions-more = Consulta la <label data-l10n-name="file-renaming-format-help-link">documentazione</label> per ulteriori informazioni (in inglese).

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
    .label = Sincronizza il titolo dell'allegato dopo la rinominazione
