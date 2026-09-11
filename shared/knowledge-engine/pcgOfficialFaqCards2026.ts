/**
 * Card FAQ aggiuntive PCG 2026 (seed idempotente).
 * Contenuti derivati da policy strutturate e da KB ufficiale già presente.
 * Non inventano regole esterne.
 */
import { PCG_2026_POLICY_CONSTANTS as C } from "../policy-engine/pcg-2026-constants.ts";
import type { OfficialKnowledgeCardSeed } from "./officialPcgCards2026.ts";

const PCG_KB_SOURCE_REFERENCE = "PCG KB ufficiale 2026";

const eur = (value: number) =>
  value.toLocaleString("it-IT", { maximumFractionDigits: 0 });

/**
 * FAQ “supplementari”: argomenti già supportati da policy/KB ma senza card dedicata
 * oppure domande multiple sullo stesso tema (una card = una faqQuestion).
 */
export const PCG_OFFICIAL_FAQ_SUPPLEMENT_CARDS_2026: OfficialKnowledgeCardSeed[] =
  [
    // —— Requisiti paziente (policy) ——
    {
      seedKey: "faq-eta-minima",
      title: "FAQ – Età minima finanziamento",
      content: `Il richiedente deve avere almeno ${C.minimumAge} anni.

Questo requisito deriva dalle policy formali PCG strutturate in RataSmart.
L’età minima da sola non implica approvazione della pratica.`,
      category: "faq",
      network: "PCG",
      keywords: ["età", "eta", "maggiorenne", "18", "minima", "requisiti"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Qual è l’età minima per richiedere un finanziamento?",
      faqCategory: "Requisiti paziente",
      faqOrder: 100,
    },
    {
      seedKey: "faq-eta-massima-agos",
      title: "FAQ – Età massima Agos",
      content: `Con Agos il finanziamento deve terminare entro gli ${C.agosMaxAgeAtEnd} anni del richiedente.

Il dato proviene dalle policy formali PCG Agos in RataSmart.
Non costituisce una garanzia di approvazione.`,
      category: "faq",
      network: "PCG",
      companyShortName: "Agos",
      keywords: ["età", "eta", "agos", "82", "massima", "fine piano"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Qual è l’età massima con Agos?",
      faqCategory: "Requisiti paziente",
      faqOrder: 110,
    },
    {
      seedKey: "faq-eta-massima-compass",
      title: "FAQ – Età massima Compass",
      content: `Per Compass, secondo le policy PCG strutturate:

- età alla richiesta inferiore a ${C.compassMaxAgeAtApplicationExclusive} anni;
- fine del finanziamento entro gli ${C.compassMaxAgeAtEnd} anni.

La compatibilità sul caso concreto è determinata dal policy engine.`,
      category: "faq",
      network: "PCG",
      companyShortName: "Compass",
      keywords: ["età", "eta", "compass", "75", "80", "massima"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Qual è l’età massima con Compass?",
      faqCategory: "Requisiti paziente",
      faqOrder: 120,
    },
    {
      seedKey: "faq-eta-massima-db",
      title: "FAQ – Età massima Deutsche Bank",
      content: `Per Deutsche Bank (prodotti standard attualmente caricati), secondo le policy PCG:

- età alla richiesta inferiore a ${C.deutscheBankMaxAgeAtApplicationExclusive} anni;
- fine del finanziamento entro gli ${C.deutscheBankMaxAgeAtEnd} anni.

La compatibilità sul caso concreto è determinata dal policy engine.`,
      category: "faq",
      network: "PCG",
      companyShortName: "Deutsche Bank",
      keywords: ["età", "eta", "deutsche bank", "db", "79", "80", "massima"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Qual è l’età massima con Deutsche Bank?",
      faqCategory: "Requisiti paziente",
      faqOrder: 130,
    },
    {
      seedKey: "faq-tempo-determinato",
      title: "FAQ – Contratto a tempo determinato",
      content: `Sì, un paziente con contratto a tempo determinato può essere valutato.

La durata del finanziamento deve essere compatibile con la scadenza del contratto: il piano deve terminare prima della scadenza del contratto, secondo le policy PCG.

La compatibilità effettiva sul caso concreto è determinata dal policy engine di RataSmart, non da questa FAQ.`,
      category: "faq",
      network: "PCG",
      keywords: [
        "tempo determinato",
        "contratto",
        "scadenza contratto",
        "determinato",
      ],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion:
        "Posso finanziare un paziente con contratto a tempo determinato?",
      faqCategory: "Requisiti paziente",
      faqOrder: 140,
    },
    {
      seedKey: "faq-anzianita-lavorativa",
      title: "FAQ – Anzianità lavorativa",
      content: `Le indicazioni operative PCG prevedono almeno ${C.seniorityMonths} mesi di anzianità lavorativa.

Se l’anzianità è inferiore oppure la data di assunzione non è disponibile, la pratica richiede verifica secondo le policy RataSmart.

La severità (verifica, non blocco automatico sotto soglia) è gestita dal policy engine.`,
      category: "faq",
      network: "PCG",
      keywords: ["anzianità", "anzianita", "assunzione", "12 mesi", "lavoro"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Quanta anzianità lavorativa è richiesta?",
      faqCategory: "Requisiti paziente",
      faqOrder: 150,
    },
    {
      seedKey: "faq-permesso-soggiorno-durata",
      title: "FAQ – Permesso di soggiorno e durata piano",
      content: `Sì. Per un paziente extracomunitario la scadenza del permesso di soggiorno deve essere compatibile con la data di fine del piano.

Il finanziamento deve terminare entro la validità del permesso, secondo le policy PCG.

Non usare formule alternative rispetto al policy engine di RataSmart.`,
      category: "faq",
      network: "PCG",
      keywords: [
        "permesso",
        "soggiorno",
        "extracomunitario",
        "scadenza permesso",
        "straniero",
      ],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion:
        "Il permesso di soggiorno deve coprire la durata del finanziamento?",
      faqCategory: "Requisiti paziente",
      faqOrder: 160,
    },
    {
      seedKey: "faq-ricevuta-rinnovo-permesso",
      title: "FAQ – Ricevuta di rinnovo permesso",
      content: `Secondo le policy formali PCG strutturate in RataSmart:

- Agos: la sola ricevuta di rinnovo del permesso di soggiorno non è ammessa;
- Compass: può valutare una ricevuta di rinnovo valida e recente (verifica documentale della finanziaria);
- Deutsche Bank: può valutare una ricevuta di rinnovo valida e recente (verifica documentale della finanziaria).

La decisione finale resta della società finanziaria.`,
      category: "faq",
      network: "PCG",
      keywords: [
        "ricevuta",
        "rinnovo",
        "permesso",
        "extracomunitario",
        "agos",
        "compass",
        "deutsche bank",
      ],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion:
        "La ricevuta di rinnovo del permesso di soggiorno è sufficiente?",
      faqCategory: "Requisiti paziente",
      faqOrder: 170,
    },
    {
      seedKey: "faq-studente-finanziamento",
      title: "FAQ – Studente e finanziamento",
      content: `Secondo le policy PCG strutturate:

- Agos: profilo studente non previsto;
- Compass: può essere valutato entro i limiti previsti e può richiedere garante;
- Deutsche Bank: può essere valutato entro i limiti previsti.

Per Compass e Deutsche Bank il limite massimo di importo sul profilo studente/casalinga previsto dalle policy è €${eur(C.studentHousewifeMaxAmountEur)}.

Documentazione operativa e obbligo di garante dipendono dalla finanziaria e dal caso concreto.`,
      category: "faq",
      network: "PCG",
      keywords: ["studente", "studentessa", "2500", "2.500", "garante", "importo"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Uno studente può richiedere un finanziamento?",
      faqCategory: "Requisiti paziente",
      faqOrder: 180,
    },
    {
      seedKey: "faq-casalinga-finanziamento",
      title: "FAQ – Casalinga e finanziamento",
      content: `Secondo le policy PCG strutturate:

- Agos: profilo casalinga non previsto;
- Compass e Deutsche Bank possono valutarla entro i limiti previsti.

Limite massimo di importo sul profilo studente/casalinga secondo le policy: €${eur(C.studentHousewifeMaxAmountEur)}.

Documentazione e eventuali garanti dipendono dalla finanziaria e dal caso concreto.`,
      category: "faq",
      network: "PCG",
      keywords: ["casalinga", "2500", "2.500", "importo", "agos", "compass"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Una casalinga può richiedere un finanziamento?",
      faqCategory: "Requisiti paziente",
      faqOrder: 190,
    },

    // —— Documenti (derivate dalla card esenzione) ——
    {
      seedKey: "faq-esenzione-extracomunitari",
      title: "FAQ – Esenzione documento reddito extracomunitari",
      content: `Per pazienti extracomunitari, entro la soglia di €${eur(C.incomeDocumentThresholdEur)} (importo richiesto + spese finanziate):

- Agos può prevedere l’esenzione dal documento di reddito;
- Compass richiede il documento di reddito;
- Deutsche Bank richiede il documento di reddito.

L’esenzione Agos non è automatica né garantita: la finanziaria può richiedere comunque la documentazione.`,
      category: "faq",
      network: "PCG",
      keywords: [
        "extracomunitario",
        "straniero",
        "documento reddito",
        "esenzione",
        "5000",
        "agos",
        "compass",
      ],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion:
        "L’esenzione dal documento di reddito vale anche per gli extracomunitari?",
      faqCategory: "Documenti",
      faqOrder: 220,
    },
    {
      seedKey: "faq-documento-reddito-sopra-soglia",
      title: "FAQ – Documento reddito sopra soglia",
      content: `Sopra la soglia di €${eur(C.incomeDocumentThresholdEur)} (importo richiesto + spese finanziate / commissioni finanziate) il documento di reddito è richiesto secondo le indicazioni operative PCG.

La verifica finale resta della finanziaria.`,
      category: "faq",
      network: "PCG",
      keywords: [
        "documento reddito",
        "sopra 5000",
        "5.000",
        "soglia",
        "busta paga",
      ],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Sopra €5.000 serve il documento di reddito?",
      faqCategory: "Documenti",
      faqOrder: 230,
    },

    // —— Garanti ——
    {
      seedKey: "faq-garante-amico-cugino",
      title: "FAQ – Garante amico o cugino",
      content: `Secondo le indicazioni operative PCG non vanno utilizzati come garanti:

- amici;
- datori di lavoro;
- cugini;
- altri soggetti esterni alla prima cerchia familiare prevista.

Sono preferibili genitori e figli; i nonni possono essere valutati con conferma della finanziaria.`,
      category: "faq",
      network: "PCG",
      keywords: ["garante", "amico", "cugino", "datore", "non ammessi"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Può fare da garante un amico o un cugino?",
      faqCategory: "Garanti",
      faqOrder: 320,
    },
    {
      seedKey: "faq-garante-non-garantisce-approvazione",
      title: "FAQ – Garante e approvazione",
      content: `No.

La presenza del garante non garantisce l’approvazione della pratica.

La decisione finale resta della società finanziaria.`,
      category: "faq",
      network: "PCG",
      keywords: ["garante", "approvazione", "non garantisce", "finanziaria"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Con un garante la pratica viene sicuramente approvata?",
      faqCategory: "Garanti",
      faqOrder: 340,
    },

    // —— Agos ——
    {
      seedKey: "faq-agos-liquidazione-automatica",
      title: "FAQ – Liquidazione Agos automatica",
      content: `La liquidazione Agos avviene normalmente in automatico circa 48 ore dopo l’approvazione della pratica.

Dopo la liquidazione verificare la gestione della fattura (caricamento entro 48 ore se non già trasmessa da PrimoUp).`,
      category: "faq",
      network: "PCG",
      companyShortName: "Agos",
      keywords: ["agos", "liquidazione", "automatica", "48 ore", "autoliquidazione"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "La liquidazione Agos è automatica?",
      faqCategory: "Agos",
      faqOrder: 410,
    },
    {
      seedKey: "faq-agos-mancata-fattura",
      title: "FAQ – Mancata fattura Agos",
      content: `Il mancato caricamento della fattura Agos entro i termini previsti può determinare il blocco delle successive liquidazioni Agos.

Se PrimoUp ha già trasmesso automaticamente la fattura, non effettuare un secondo caricamento.`,
      category: "faq",
      network: "PCG",
      companyShortName: "Agos",
      keywords: ["agos", "fattura", "blocco", "liquidazione", "primoup"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Cosa succede se non carico la fattura Agos?",
      faqCategory: "Agos",
      faqOrder: 430,
    },
    {
      seedKey: "faq-agos-ampliamento",
      title: "FAQ – Ampliamento finanziamento Agos",
      content: `Agos può gestire l’ampliamento di un finanziamento esistente:

- tramite consolidamento/accorpamento del finanziamento precedente, dopo conferma dell’approvazione e con estinzione del precedente da parte dell’azienda;
- oppure con finanziamento parallelo dopo il pagamento di almeno 2 rate;
- oppure tramite Agos Pass, quando applicabile.

Il caso concreto va verificato con la finanziaria.`,
      category: "faq",
      network: "PCG",
      companyShortName: "Agos",
      keywords: [
        "agos",
        "ampliamento",
        "parallelo",
        "agos pass",
        "secondo finanziamento",
      ],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Posso ampliare un finanziamento Agos già esistente?",
      faqCategory: "Agos",
      faqOrder: 460,
    },

    // —— Compass / DB ampliamento ——
    {
      seedKey: "faq-compass-ampliamento",
      title: "FAQ – Ampliamento finanziamento Compass",
      content: `L’ampliamento di un finanziamento Compass viene normalmente gestito tramite una nuova pratica parallela.

La verifica finale resta di Compass.`,
      category: "faq",
      network: "PCG",
      companyShortName: "Compass",
      keywords: ["compass", "ampliamento", "parallelo", "secondo finanziamento"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Posso ampliare un finanziamento Compass già esistente?",
      faqCategory: "Compass",
      faqOrder: 520,
    },
    {
      seedKey: "faq-db-ampliamento",
      title: "FAQ – Ampliamento finanziamento Deutsche Bank",
      content: `L’ampliamento di un finanziamento Deutsche Bank viene normalmente gestito tramite una nuova pratica parallela.

La verifica finale resta della finanziaria.`,
      category: "faq",
      network: "PCG",
      companyShortName: "Deutsche Bank",
      keywords: [
        "deutsche bank",
        "db",
        "ampliamento",
        "parallelo",
        "secondo finanziamento",
      ],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion:
        "Posso ampliare un finanziamento Deutsche Bank già esistente?",
      faqCategory: "Deutsche Bank",
      faqOrder: 620,
    },

    // —— Pagamenti ——
    {
      seedKey: "faq-postepay-evolution",
      title: "FAQ – PostePay Evolution",
      content: `PostePay Evolution può essere utilizzabile per finanziamenti classici.

Non è utilizzabile per:
- Agos Pass;
- HeyLight.

In caso di dubbio verificare la carta e la procedura della finanziaria.`,
      category: "faq",
      network: "PCG",
      keywords: [
        "postepay",
        "poste pay",
        "evolution",
        "agos pass",
        "heylight",
        "pagamento",
      ],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion:
        "Posso utilizzare PostePay Evolution per l’addebito delle rate?",
      faqCategory: "Pagamenti e fatturazione",
      faqOrder: 810,
    },
    {
      seedKey: "faq-carta-ricaricabile",
      title: "FAQ – Carta ricaricabile",
      content: `Le normali carte ricaricabili non sono ammesse per l’addebito delle rate.

Preferire l’addebito diretto su conto corrente.`,
      category: "faq",
      network: "PCG",
      keywords: ["ricaricabile", "carta", "addebito", "conto corrente", "rid"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Posso utilizzare una carta ricaricabile?",
      faqCategory: "Pagamenti e fatturazione",
      faqOrder: 820,
    },
    {
      seedKey: "faq-intestazione-fattura",
      title: "FAQ – Intestazione fattura",
      content: `La fattura del finanziamento deve essere intestata al paziente.

Prestare attenzione alle procedure specifiche delle singole finanziarie per invio o caricamento.`,
      category: "faq",
      network: "PCG",
      keywords: ["fattura", "intestazione", "paziente", "fatturazione"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "A chi deve essere intestata la fattura del finanziamento?",
      faqCategory: "Pagamenti e fatturazione",
      faqOrder: 830,
    },
    {
      seedKey: "faq-quando-emettere-fattura",
      title: "FAQ – Quando emettere la fattura",
      content: `La fattura va normalmente emessa dopo la liquidazione del finanziamento.

Fare salvo il caso in cui l’Area Manager o la procedura specifica della finanziaria indichi diversamente.`,
      category: "faq",
      network: "PCG",
      keywords: ["fattura", "emissione", "liquidazione", "area manager"],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "Quando va emessa la fattura?",
      faqCategory: "Pagamenti e fatturazione",
      faqOrder: 840,
    },

    // —— Tasso zero ——
    {
      seedKey: "faq-tasso-zero-quando",
      title: "FAQ – Quando usare tasso zero o agevolato",
      content: `I prodotti a tasso zero o agevolato che generano costo aziendale possono essere utilizzati esclusivamente con listino Sinergia e quando è prevista l’autorizzazione aziendale.

RataSmart può segnalare il costo aziendale, ma non sostituisce l’autorizzazione.`,
      category: "faq",
      network: "PCG",
      keywords: [
        "tasso zero",
        "agevolato",
        "sinergia",
        "autorizzazione",
        "costo aziendale",
      ],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion:
        "Quando posso utilizzare un finanziamento a tasso zero o agevolato?",
      faqCategory: "Tasso zero e autorizzazioni",
      faqOrder: 910,
    },
    {
      seedKey: "faq-tasso-zero-ratasmart-autorizza",
      title: "FAQ – RataSmart e autorizzazione tasso zero",
      content: `No.

RataSmart segnala quando una soluzione richiede autorizzazione aziendale, ma non concede né certifica l’autorizzazione.

L’autorizzazione resta un atto aziendale esterno a RataSmart.`,
      category: "faq",
      network: "PCG",
      keywords: [
        "tasso zero",
        "autorizzazione",
        "ratasmart",
        "sinergia",
        "costo aziendale",
      ],
      priority: 70,
      visibility: "internal_only",
      sourceReference: PCG_KB_SOURCE_REFERENCE,
      showInFaq: true,
      faqQuestion: "RataSmart autorizza un finanziamento a tasso zero?",
      faqCategory: "Tasso zero e autorizzazioni",
      faqOrder: 920,
    },
  ];
