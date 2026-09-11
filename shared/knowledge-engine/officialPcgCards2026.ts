/**
 * Knowledge Base ufficiale PCG 2026 – contenuti operativi per Virtual Marco.
 * Non duplicare TAN/durate/importi delle tabelle o regole del policy-engine.
 */

export type KnowledgeCardSeedCategory =
  | "documents"
  | "liquidation"
  | "invoicing"
  | "guarantor"
  | "income"
  | "invalidity_pension"
  | "employment"
  | "residence_permit"
  | "payment_methods"
  | "installment_date"
  | "extensions"
  | "rejected_practices"
  | "operational_alert"
  | "faq"
  | "other";

export type OfficialKnowledgeCardSeed = {
  seedKey: string;
  title: string;
  /** Titoli di versioni precedenti create da seed generici. */
  legacyTitles?: string[];
  content: string;
  category: KnowledgeCardSeedCategory;
  network: "PCG" | "DES" | "BOTH";
  companyShortName?: "Agos" | "Compass" | "Deutsche Bank";
  productName?: string;
  keywords: string[];
  priority: number;
  alwaysInclude?: boolean;
  isAlert?: boolean;
  alertLabel?: string;
  visibility: "patient_safe" | "internal_only";
  sourceReference: string;
  showInFaq?: boolean;
  faqQuestion?: string;
  faqCategory?: string;
  faqOrder?: number;
};

export const PCG_KB_SOURCE_REFERENCE = "PCG KB ufficiale 2026";

export const PCG_KNOWLEDGE_CARDS_2026: OfficialKnowledgeCardSeed[] = [
  {
    seedKey: "agos-data-addebito-rata",
    title: "Agos – data di addebito rata",
    legacyTitles: ["Agos – modifica data di addebito rata"],
    content: `ATTENZIONE: CON AGOS NON MODIFICARE LA DATA DI SCADENZA RATA CHE PROPONE IL SISTEMA DI CARICAMENTO.

La data della prima rata viene determinata automaticamente al momento dell’inserimento della tabella scelta, in funzione del differimento previsto dalla tabella.

Se prima della conferma della pratica viene modificata manualmente la data di scadenza, la liquidazione viene posticipata per mantenere circa il differimento previsto tra liquidazione e primo addebito.

Dopo questa modifica la data non sarà più modificabile.

I 30/60 giorni decorreranno quindi dalla data di liquidazione richiesta.

Esempio:
se il 10 del mese viene caricata una pratica e viene scelta come scadenza rata il giorno 25, anche se la pratica viene approvata la liquidazione può essere posticipata fino al 25 per mantenere il differimento previsto prima della prima rata.

Prestare particolare attenzione alle pratiche caricate a fine mese: la modifica della data può determinare lo slittamento della liquidazione al mese successivo.

Se il CM chiede informazioni sintetiche, mostrare prima l’alert.
Fornire la spiegazione estesa solo se richiesta o utile al caso.`,
    category: "operational_alert",
    network: "PCG",
    companyShortName: "Agos",
    keywords: [
      "agos",
      "rata",
      "data rata",
      "scadenza rata",
      "addebito",
      "liquidazione",
      "30 giorni",
      "60 giorni",
      "cambiare data",
      "modificare data",
      "data di addebito",
    ],
    priority: 100,
    alwaysInclude: false,
    isAlert: true,
    alertLabel: "Agos – non modificare data rata",
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
    showInFaq: true,
    faqQuestion: "Con Agos posso modificare la data di addebito rata?",
    faqCategory: "Rate e scadenze",
    faqOrder: 10,
  },
  {
    seedKey: "db-modifica-data-rata",
    title: "Deutsche Bank – modifica data di addebito rata",
    legacyTitles: ["Deutsche Bank – modifica data rata"],
    content: `Deutsche Bank consente di richiedere la modifica della data di addebito della rata a partire dal secondo mese.

La richiesta deve essere effettuata via e-mail secondo la procedura prevista dalla finanziaria.

La possibilità di modifica non deve essere interpretata come automatica: in caso di dubbio verificare con Deutsche Bank.`,
    category: "installment_date",
    network: "PCG",
    companyShortName: "Deutsche Bank",
    keywords: [
      "deutsche bank",
      "db",
      "rata",
      "data rata",
      "addebito",
      "scadenza",
      "modifica rata",
      "modificare data",
    ],
    priority: 80,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
  },
  {
    seedKey: "agos-liquidazione-fattura-48h",
    title: "Agos – liquidazione e fattura 48h",
    content: `Agos prevede l’auto-liquidazione entro circa 48 ore dall’approvazione della pratica.

Dopo la liquidazione, il Clinic Manager ha 48 ore per caricare la fattura SE QUESTA NON È STATA INVIATA AUTOMATICAMENTE DA PRIMOUP.

Se PrimoUp ha già trasmesso automaticamente la fattura, il CM non deve effettuare un secondo caricamento.

Il mancato caricamento della fattura entro i termini previsti può determinare il blocco delle successive liquidazioni Agos.

In caso di dubbio verificare sempre se la fattura sia già stata trasmessa automaticamente da PrimoUp prima di procedere manualmente.`,
    category: "liquidation",
    network: "PCG",
    companyShortName: "Agos",
    keywords: [
      "agos",
      "liquidazione",
      "liquido",
      "liquidare",
      "erogare",
      "erogazione",
      "auto-liquidazione",
      "autoliquidazione",
      "fattura",
      "48 ore",
      "48h",
      "primoup",
      "blocco liquidazione",
      "caricare fattura",
    ],
    priority: 95,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
    showInFaq: true,
    faqQuestion: "Quando devo caricare la fattura Agos?",
    faqCategory: "Agos",
    faqOrder: 20,
  },
  {
    seedKey: "agos-pass-liquidazione",
    title: "Agos Pass – liquidazione",
    content: `Agos Pass prevede liquidazione immediata.

Non è richiesto il caricamento della fattura nella procedura della finanziaria.

Non confondere questa procedura con quella prevista per i finanziamenti Agos classici.`,
    category: "liquidation",
    network: "PCG",
    companyShortName: "Agos",
    productName: "Agos Pass",
    keywords: ["agos pass", "liquidazione", "liquido", "liquidare", "fattura", "agos"],
    priority: 85,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
    showInFaq: true,
    faqQuestion: "Come funziona la liquidazione Agos Pass?",
    faqCategory: "Agos",
    faqOrder: 25,
  },
  {
    seedKey: "compass-liquidazione",
    title: "Compass – procedura di liquidazione",
    legacyTitles: ["Compass – liquidazione"],
    content: `Per liquidare una pratica Compass, il Clinic Manager deve inviare una richiesta via e-mail alla filiale Compass di riferimento.

La liquidazione non avviene automaticamente.

Il CM deve quindi procedere con la richiesta di liquidazione secondo la procedura concordata con la filiale di riferimento.

Se sono richiesti documenti aggiuntivi dalla filiale, devono essere forniti secondo le indicazioni ricevute.

Non inventare indirizzi e-mail o documenti specifici se non presenti nella Knowledge Base.`,
    category: "liquidation",
    network: "PCG",
    companyShortName: "Compass",
    keywords: [
      "compass",
      "liquidazione",
      "liquido",
      "liquidare",
      "erogare",
      "erogazione",
      "filiale",
      "email",
      "mail",
      "richiesta",
    ],
    priority: 85,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
    showInFaq: true,
    faqQuestion: "Come richiedo la liquidazione Compass?",
    faqCategory: "Compass",
    faqOrder: 30,
  },
  {
    seedKey: "db-liquidazione",
    title: "Deutsche Bank – procedura di liquidazione",
    legacyTitles: ["Deutsche Bank – liquidazione"],
    content: `Per liquidare una pratica Deutsche Bank, il Clinic Manager deve inviare una richiesta via e-mail alla filiale Deutsche Bank di riferimento.

La liquidazione non avviene automaticamente.

Il CM deve quindi procedere con la richiesta di liquidazione secondo la procedura concordata con la filiale di riferimento.

Se sono richiesti documenti aggiuntivi dalla filiale, devono essere forniti secondo le indicazioni ricevute.

Non inventare indirizzi e-mail o documenti specifici.`,
    category: "liquidation",
    network: "PCG",
    companyShortName: "Deutsche Bank",
    keywords: [
      "db",
      "deutsche bank",
      "liquidazione",
      "liquido",
      "liquidare",
      "erogare",
      "erogazione",
      "filiale",
      "email",
      "mail",
      "richiesta",
    ],
    priority: 85,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
    showInFaq: true,
    faqQuestion: "Come richiedo la liquidazione Deutsche Bank?",
    faqCategory: "Deutsche Bank",
    faqOrder: 35,
  },
  {
    seedKey: "fatturazione-finanziamenti",
    title: "Fatturazione dei finanziamenti",
    legacyTitles: ["Fatturazione finanziamenti"],
    content: `La fattura deve essere intestata al paziente.

La fattura deve essere emessa dopo la liquidazione del finanziamento, salvo diverse indicazioni operative dell’Area Manager o procedure specifiche della finanziaria.

Prestare attenzione alle procedure specifiche delle singole finanziarie relative all’invio o al caricamento della fattura.`,
    category: "invoicing",
    network: "PCG",
    keywords: [
      "fattura",
      "fatturazione",
      "paziente",
      "finanziamento",
      "liquidazione",
    ],
    priority: 70,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
  },
  {
    seedKey: "garante-soggetti-ammessi",
    title: "Garante – soggetti ammessi",
    content: `Come garante sono ammessi familiari stretti appartenenti alla prima cerchia familiare.

Sono preferibili:
- genitori;
- figli.

I nonni possono essere valutati, ma è preferibile chiedere preventivamente conferma al consulente della finanziaria.

Non utilizzare come garanti:
- amici;
- datori di lavoro;
- cugini;
- altri soggetti esterni alla prima cerchia familiare.

La presenza di un garante non garantisce l’approvazione della pratica.`,
    category: "guarantor",
    network: "PCG",
    keywords: [
      "garante",
      "genitore",
      "genitori",
      "figlio",
      "figli",
      "nonno",
      "nonni",
      "familiare",
      "cugino",
      "cugini",
      "amico",
      "amici",
      "datore lavoro",
      "prima cerchia",
    ],
    priority: 95,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
  },
  {
    seedKey: "garante-piu-anziano",
    title: "Garante più anziano dell’intestatario",
    legacyTitles: ["Garante più anziano"],
    content: `Quando il garante è più anziano dell’intestatario, il profilo del finanziamento deve tenere conto anche delle caratteristiche del garante.

Devono essere valutati in particolare:
- età;
- reddito;
- criteri di finanziabilità applicabili al garante.

In situazioni limite verificare preventivamente con la finanziaria.

Non presumere che l’età dell’intestatario sia l’unico riferimento della pratica quando è presente un garante.`,
    category: "guarantor",
    network: "PCG",
    keywords: [
      "garante anziano",
      "età garante",
      "garante senior",
      "intestatario",
      "età",
      "garante",
      "anziano",
    ],
    priority: 80,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
  },
  {
    seedKey: "pensione-invalidita",
    title: "Pensione di invalidità",
    content: `In presenza di pensione di invalidità valgono indicazioni differenti in base alla finanziaria.

AGOS:
la pratica non viene valutata senza la presenza di un garante.

DEUTSCHE BANK:
può essere ammessa la firma singola, ma deve essere valutata la tipologia di invalidità.

COMPASS:
l’accettazione è possibile solo dopo una valutazione preventiva della finanziaria.

In tutti i casi è fortemente consigliato valutare l’inserimento di un garante.

Non dichiarare mai automaticamente finanziabile una pratica sulla sola base di queste indicazioni.`,
    category: "invalidity_pension",
    network: "PCG",
    keywords: [
      "invalidità",
      "invalidita",
      "pensione invalidità",
      "pensione di invalidità",
      "invalido",
      "garante",
      "agos",
      "compass",
      "db",
      "deutsche bank",
    ],
    priority: 90,
    isAlert: true,
    alertLabel: "Pensione di invalidità",
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
  },
  {
    seedKey: "esenzione-documento-reddito",
    title: "Esenzione dalla presentazione del documento di reddito",
    legacyTitles: ["Esenzione documento di reddito"],
    content: `Per importi complessivi fino a 5.000 €, comprendendo importo richiesto e spese finanziate:

AGOS:
può essere prevista l’esenzione dalla presentazione del documento di reddito sia per cittadini italiani sia per stranieri.

COMPASS:
l’esenzione può essere prevista per cittadini italiani.

DEUTSCHE BANK:
l’esenzione può essere prevista per cittadini italiani.

Per importi complessivi superiori a 5.000 €, comprese le commissioni finanziate, il documento di reddito è richiesto secondo le indicazioni operative disponibili.

IMPORTANTE:
l’esenzione non è garantita.

La finanziaria può richiedere comunque la documentazione reddituale anche quando l’importo rientra nella soglia prevista.`,
    category: "income",
    network: "PCG",
    keywords: [
      "reddito",
      "documento reddito",
      "busta paga",
      "esenzione",
      "5000",
      "5.000",
      "straniero",
      "italiano",
    ],
    priority: 90,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
    showInFaq: true,
    faqQuestion: "Quando è prevista l’esenzione dal documento di reddito?",
    faqCategory: "Documenti",
    faqOrder: 40,
  },
  {
    seedKey: "studenti-casalinghe-documentazione",
    title: "Studenti e casalinghe – documentazione operativa",
    legacyTitles: ["Documentazione studente/casalinga"],
    content: `Per studenti e casalinghe devono essere disponibili almeno:

- documento di identità;
- codice fiscale;
- modalità di rimborso RID/SEPA.

Le condizioni di finanziabilità, i limiti di importo e l’eventuale obbligo di garante sono gestiti dalle policy strutturate di RataSmart.

Non usare questa scheda per determinare autonomamente la compatibilità.`,
    category: "documents",
    network: "PCG",
    keywords: [
      "studente",
      "studentessa",
      "casalinga",
      "documento",
      "codice fiscale",
      "rid",
      "sepa",
      "documentazione",
    ],
    priority: 75,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
    showInFaq: true,
    faqQuestion: "Quali documenti servono per studente o casalinga?",
    faqCategory: "Documenti",
    faqOrder: 45,
  },
  {
    seedKey: "ampliamento-finanziamento",
    title: "Ampliamento di un finanziamento esistente",
    legacyTitles: ["Ampliamenti"],
    content: `In caso di ampliamento di un finanziamento esistente:

AGOS:
può essere previsto l’accorpamento con il primo finanziamento previa estinzione del finanziamento precedente da parte dell’azienda, dopo conferma dell’approvazione.

In alternativa può essere valutato:
- un finanziamento parallelo dopo il pagamento di almeno 2 rate;
- Agos Pass, quando applicabile.

COMPASS:
può essere previsto un finanziamento parallelo.

DEUTSCHE BANK:
può essere previsto un finanziamento parallelo.

Prima di procedere con un ampliamento verificare comunque la situazione specifica con la finanziaria.`,
    category: "extensions",
    network: "PCG",
    keywords: [
      "ampliamento",
      "secondo finanziamento",
      "finanziamento parallelo",
      "estinzione",
      "accorpamento",
      "agos pass",
      "ampliare",
    ],
    priority: 85,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
  },
  {
    seedKey: "metodi-pagamento",
    title: "Metodi di pagamento e carte ammesse",
    legacyTitles: ["Metodi di pagamento"],
    content: `La modalità di rimborso da preferire è l’addebito diretto su conto corrente bancario.

PostePay Evolution può essere utilizzata per il finanziamento classico quando ammesso dalla finanziaria.

PostePay Evolution NON può essere utilizzata per:
- Agos Pass;
- HeyLight.

Le carte ricaricabili non possono essere utilizzate come modalità di rimborso dei finanziamenti.

In caso di dubbio sulla tipologia specifica di carta verificare preventivamente con la finanziaria.`,
    category: "payment_methods",
    network: "PCG",
    keywords: [
      "pagamento",
      "conto corrente",
      "rid",
      "sepa",
      "postepay",
      "postepay evolution",
      "carta",
      "ricaricabile",
      "agos pass",
      "heylight",
    ],
    priority: 85,
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
  },
  {
    seedKey: "agos-pratiche-respinte-dopo-17",
    title: "Agos – pratiche respinte dopo le ore 17",
    legacyTitles: ["Agos – pratiche respinte dopo le 17"],
    content: `Prestare particolare attenzione alle pratiche Agos respinte inserite dopo le ore 17.

Secondo la procedura operativa comunicata, le pratiche respinte inserite dopo le ore 17 non risultano più gestibili e/o riapribili.

In caso di necessità verificare direttamente con il referente Agos.`,
    category: "rejected_practices",
    network: "PCG",
    companyShortName: "Agos",
    keywords: [
      "agos",
      "respinta",
      "pratica respinta",
      "17",
      "ore 17",
      "riaprire",
      "gestire",
      "dopo le 17",
    ],
    priority: 95,
    isAlert: true,
    alertLabel: "Agos – respinte dopo le 17",
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
  },
  {
    seedKey: "tasso-zero-agevolato-sinergia",
    title: "Tasso Zero e Tasso Agevolato – utilizzo con listino Sinergia",
    legacyTitles: [
      "Tasso zero/agevolato – autorizzazione e listino Sinergia",
    ],
    content: `Le soluzioni Tasso Zero e Tasso Agevolato che comportano un costo per l’azienda possono essere utilizzate esclusivamente con listino Sinergia secondo le indicazioni aziendali.

Richiedono l’autorizzazione prevista dalla procedura aziendale.

RataSmart può segnalare che una soluzione comporta costo aziendale e richiede autorizzazione, ma non deve dichiarare che l’autorizzazione sia stata ottenuta.`,
    category: "operational_alert",
    network: "PCG",
    keywords: [
      "tasso zero",
      "tasso agevolato",
      "sinergia",
      "costo aziendale",
      "autorizzazione",
      "area manager",
      "listino",
    ],
    priority: 100,
    isAlert: true,
    alertLabel: "Tasso Zero / Agevolato – Sinergia",
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
  },
  {
    seedKey: "quando-valutare-garante",
    title: "Quando valutare un garante",
    legacyTitles: ["Alert reddito / rata / contratto breve"],
    content: `Valutare con particolare attenzione l’inserimento di un garante nei seguenti casi:

- reddito inferiore a 500 €;
- rata prevista più altre rate/impegni superiori al 50% del reddito;
- contratto a tempo determinato di breve durata;
- casalinga;
- studente;
- situazioni documentali o reddituali deboli.

Queste indicazioni sono alert operativi e NON costituiscono una garanzia di approvazione.

Non eseguire autonomamente nuovi calcoli reddituali se RataSmart non fornisce già i valori necessari.`,
    category: "guarantor",
    network: "PCG",
    keywords: [
      "garante",
      "reddito basso",
      "reddito 500",
      "rata reddito",
      "50 percento",
      "50%",
      "determinato breve",
      "studente",
      "casalinga",
    ],
    priority: 80,
    isAlert: true,
    alertLabel: "Quando valutare un garante",
    visibility: "internal_only",
    sourceReference: PCG_KB_SOURCE_REFERENCE,
    showInFaq: true,
    faqQuestion: "Posso utilizzare un garante?",
    faqCategory: "Garanti",
    faqOrder: 50,
  },
];
