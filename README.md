# RataSmart

**Il tuo Virtual Marco**

Applicazione interna per Clinic Manager: confronta prodotti finanziari, calcola rate, verifica l’aderenza formale alle policy, riceve spiegazioni via chat AI e salva le simulazioni.

Stato attuale: **Fase 1 + Fase 2 + Fase 3A + Fase 3B + Fase 3C + Fase 4A + Fase 4B + pre-screening Virtual Marco** completate.

## Stack

- React + Vite + TypeScript (strict)
- Tailwind CSS + componenti in stile shadcn/ui
- React Router
- Convex (backend + database)
- React Hook Form + Zod
- date-fns (locale italiano)
- Sonner
- Lucide React

## Prerequisiti

- Node.js 20+
- npm
- Account Convex (consigliato) oppure modalità anonima locale

## Installazione

```bash
npm install
```

## Configurazione Convex

```bash
npx convex dev
```

In un secondo terminale:

```bash
npm run dev
```

| Variabile | Descrizione |
|---|---|
| `VITE_CONVEX_URL` | URL del deployment Convex |

## Staging Vercel

Frontend staging su **Vercel**; backend sullo **stesso Convex DEV** già esistente (nessun nuovo deployment Convex, nessun `npx convex deploy` nel flusso di staging frontend).

| Impostazione Vercel | Valore |
|---|---|
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Env (Preview/Production) | `VITE_CONVEX_URL` = URL del Convex DEV |

- `OPENAI_API_KEY` e `AI_PROVIDER_MODE` restano **solo** su Convex (`npx convex env set …`), mai su Vercel né come `VITE_*`.
- `vercel.json` riscrive le route SPA su `/index.html` (refresh e deep link).
- Autenticazione: demo attuale (nessun Auth0 in staging).

## Comandi

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia Vite |
| `npm run dev:backend` | Avvia Convex in watch |
| `npm run build` | Typecheck + build |
| `npm run typecheck` | Solo TypeScript |
| `npm run lint` | Oxlint |
| `npm run test:financial` | Test motore finanziario |
| `npm run test:policy` | Test motore policy / ranking / confronto |
| `npm run test:snapshot` | Test snapshot confronto / idempotenza |
| `npm run test:knowledge` | Test knowledge engine (selezione schede) |
| `npm run test:assistant` | Test context builder / privacy / mock provider |
| `npm run test` | Tutti i test Vitest |

## Seed Fase 2 (Agos Pass demo)

1. Entra come **admin demo**
2. Vai su **Finanziarie**
3. Clicca **Esegui seed Agos Pass**

Oppure da Convex dashboard/mutation:

```text
seed.seedAgosPassDemo({ actorUserId: <adminId> })
```

Il seed è idempotente e crea:

- società **Agos**
- prodotto **Agos Pass** (`special`)
- tabella **AGOS_PASS_DEMO** su rete **PCG**

Gli importi min/max sono **valori DEMO** (non ufficiali), segnalati nelle note admin.

## Modello dati finanziario (Fase 2)

Tabelle Convex:

- `financialCompanies` — società
- `financialProducts` — famiglie/prodotti
- `financialTables` — condizioni economiche versionabili
- `policySets` / `policyRules` — policy formali
- `commercialPriorities` — priorità di presentazione
- `internalMessages` — messaggi riservati al personale

### Categorie prodotto

| Codice | Label IT |
|---|---|
| `standard` | Tasso standard |
| `zero_interest` | Tasso zero |
| `subsidized` | Tasso agevolato |
| `small_amount` | Piccoli importi |
| `special` | Prodotto speciale |

### Distinzione PCG / DES

Ogni tabella, policy, priorità e messaggio interno è legato a una rete.  
Una condizione PCG non è mai considerata valida automaticamente per DES.

### Versionamento

Per variazioni economiche rilevanti:

1. si crea una nuova versione (`version + 1`)
2. si collega `supersedesTableId` / `supersedesPolicySetId`
3. la versione precedente viene disattivata e conservata

Metadati descrittivi possono usare `updateFinancialTableMetadata`.

### Policy

Le policy rappresentano solo **aderenza formale**.

> La compatibilità indicata riguarda esclusivamente i requisiti formali conosciuti. L’approvazione, il rifiuto e le condizioni definitive della pratica dipendono esclusivamente dalla società finanziaria.

### Priorità aziendali

Modificano solo l’ordine futuro delle soluzioni compatibili.  
Non alterano la compatibilità.

### Messaggi interni

Il CM vede solo un’icona. Dopo conferma privacy può leggere il contenuto.

## Decisioni di dominio confermate

- Commissione apertura: aggiunta all’importo richiesto prima della rateizzazione
- Durate configurabili tramite minimo, massimo e step
- Prima rata a 30/60/90 giorni senza variazione della rata / TAN / interessi nominali
- Costo interno inserito esclusivamente come percentuale a 24 mesi (proporzionale in Fase 3A)
- Priorità aziendale non modifica la compatibilità
- Tasso zero e agevolato richiedono futuro alert informativo
- Le policy indicano solo aderenza formale
- L’esito finale dipende esclusivamente dalla finanziaria

## Limiti della Fase 2

- Nessun confronto automatico tra finanziarie
- Nessun motore policy runtime
- Nessuna OpenAI reale
- Nessun Auth0
- Nessuno snapshot completo condizioni sulle simulazioni (tipo predisposto in `src/types/domain.ts`)

## Motore finanziario – Fase 3A

Libreria pura in `shared/financial-engine/`, isolata da React e Convex.

### Formule

**Rata alla francese (TAN > 0):**

```text
monthlyRate = TAN% / 100 / 12
rata = finanziato × monthlyRate / [1 − (1 + monthlyRate)^(-n)]
```

**TAN = 0:** `rata = finanziato / n`

**Commissione di apertura:** aggiunta all’importo richiesto → `finanziato = richiesto + commissione`.

**Spese di incasso:** aggiunte a ogni rata, senza generare interessi.

**Costo interno:** `applied% = percentAt24 × n / 24`, poi `costo = finanziato × applied% / 100`.

**Netto liquidato:** `finanziato − costo interno`.

### Arrotondamento

- Calcoli intermedi con `decimal.js` (precisione elevata)
- Monetario finale: 2 decimali, `ROUND_HALF_UP`
- Rate 1…n−1: rata regolare arrotondata; interessi arrotondati; capitale = differenza
- Ultima rata: capitale = saldo residuo; interessi sul saldo; rata base = somma

### TAEG tecnico stimato

Flusso iniziale: `+importo richiesto` (non l’importo finanziato).  
Flussi successivi: `−rata totale` agli offset effettivi (30/60/90 → mesi 1/2/3).

Solver: Newton-Raphson con fallback a bisezione.  
Annualizzazione: `(1 + i_mensile)^12 − 1`.

> Il TAEG prodotto in questa fase è una stima tecnica basata sui flussi
> configurati in RataSmart. Non include ancora bollo, imposta sostitutiva
> o altri oneri fiscali e deve essere validato confrontandolo con esempi
> ufficiali delle società finanziarie prima dell’uso in produzione.

> La prima rata differita a 60 o 90 giorni non modifica rata, TAN,
> interessi nominali o costo aziendale. Può modificare il TAEG tecnico
> stimato perché cambia la tempistica effettiva dei flussi.

### Comandi

```bash
npm run test:financial
npm run verify:financial
```

### Limiti Fase 3A

- Nessun bollo / imposta sostitutiva nel TAEG
- Nessuno snapshot immutabile (arriva in Fase 3C)

## Motore policy e confronto – Fase 3B

Libreria pura in `shared/policy-engine/`, isolata da React e Convex. Usa il motore finanziario tramite gli export pubblici di `shared/financial-engine`.

### Condizioni tecniche tabella vs policy

| Tipo | Esempi | Effetto |
|---|---|---|
| Condizioni tecniche tabella | importo fuori range, durata assente, differimento non previsto | esclusione tecnica `not_compatible` senza chiamare il motore finanziario |
| Policy formali | età, lavoro, permesso, importi/durate di policy, custom | valutazione regola per regola |

### Stati di compatibilità

- `compatible` — tutte le regole deterministiche applicabili rispettate
- `verification_required` — informazioni mancanti, regola custom o valutazione discrezionale
- `not_compatible` — almeno una regola deterministica violata

Aggregazione: fallita > verifica > compatibile. Una regola passata non annulla una fallita. Policy company + product + table si sommano senza override impliciti.

### Durata comune del confronto

Il confronto principale usa **una sola durata** per tutte le finanziarie.  
Se la durata scelta dal CM non è supportata, non viene sostituita in silenzio: le tabelle risultano non compatibili e vengono suggerite le durate comuni più vicine.

Senza durata ma con rata obiettivo: tra le sole soluzioni `compatible` si cerca la rata totale più vicina, poi si confronta tutta la rete su quella durata.  
Senza entrambi: preferenza a 24 mesi, altrimenti la più vicina a 24 (a parità la più breve).

### Rata obiettivo

`distance = rataTotale − obiettivo`. Si mostra sopra/sotto in valore assoluto. La più vicina è `min(|distance|)` tra le compatibili.

### Priorità aziendali

Modificano solo l’ordine delle soluzioni **compatibili** (score decrescente).  
Non rendono compatibile una esclusa, non cambiano rata/condizioni, non si applicano a `verification_required` / `not_compatible`.

### Ranking

1. Compatibili: priorità ↓, rata ↑, TAEG ↑, nome, codice tabella  
2. Da verificare: rata ↑, nome, codice (senza priorità)  
3. Non compatibili: numero motivi ↑, nome, codice  

### Orchestrazione

Action Convex `comparison.calculateSimulationComparison`:

1. verifica ownership CM
2. recupera tabelle / società / prodotti / policy / priorità / messaggi attivi
3. normalizza in tipi runtime
4. calcola con motori condivisi
5. persiste run + soluzioni (Fase 3C)
6. aggiorna `lastComparisonAt` / `latestComparisonRunId`

### Limiti Fase 3B (risolti in 3C)

La Fase 3B calcolava senza snapshot. Dalla Fase 3C ogni confronto è immutabile.

## Snapshot immutabili – Fase 3C

Ogni confronto crea un **run** (`simulationComparisonRuns`) e salva ogni soluzione in `simulationComparisonSolutions` con condizioni, compatibilità, priorità e messaggi fotografati.

- Il **ricalcolo** genera sempre un **nuovo run** (`source: manual_recalculation`) con nuovo `requestId`.
- I run precedenti restano invariati.
- La **proposta** è un riferimento a una soluzione fotografata e può appartenere anche a un run storico.
- Lo stesso `requestId` è **idempotente**: non crea un secondo run.

### Piano non persistito

Il piano di ammortamento non viene salvato riga per riga.
RataSmart conserva gli input economici e il riepilogo e rigenera il piano
utilizzando il motore finanziario deterministico.

### Versione motore

Ogni confronto conserva la versione del motore finanziario e del motore policy.
Se in futuro gli algoritmi cambiano, il riepilogo storico resterà invariato,
mentre la rigenerazione del piano potrebbe richiedere il mantenimento
delle precedenti versioni del motore.

### Immutabilità

- modificare una tabella non cambia i run precedenti;
- modificare una policy non cambia gli esiti precedenti;
- cambiare dati paziente non cancella lo storico (mostra alert e richiede ricalcolo esplicito);
- la proposta è un riferimento a una soluzione fotografata.

### UI CM

- Cronologia confronti per simulazione
- Apertura confronti storici (solo snapshot)
- Badge “Confronto attuale” / “Soluzione proposta al paziente”
- Ricalcolo con conferma (`manual_recalculation`)
- Alert se `lastInputUpdatedAt` > data ultimo run
- Selezione / sostituzione proposta (solo soluzioni `compatible`)

### Admin

Consultazione sola lettura su `/admin/simulazioni` e dettaglio run/soluzioni.
Badge: `Consultazione admin – sola lettura`.

### Comandi

```bash
npm run test:snapshot
npm run test:policy
npm run test:financial
npm run test
npm run typecheck
npm run build
```

### Limiti ancora presenti (dopo 3C; in parte risolti in 4A)

- nessun Auth0;
- nessuna chiamata OpenAI / chat reale (Fase 4B);
- knowledge base amministrabile presente (Fase 4A), senza embeddings;
- nessun bollo/imposta nel TAEG;
- nessun esito pratica;
- nessun PDF;
- nessuna dashboard comportamentale avanzata.

## Knowledge base Virtual Marco – Fase 4A

RataSmart separa nettamente le fonti di conoscenza:

```text
Prompt di comportamento
+ dati strutturati Convex (tabelle, policy, priorità)
+ risultati del motore finanziario / policy
+ knowledge base operativa (schede)
+ domanda del CM
```

### Architettura Virtual Marco

| Layer | Contenuto | Dove vive |
|---|---|---|
| Prompt di comportamento | Ruolo, limiti, stile di risposta | `assistantConfigs.behaviorPrompt` |
| Dati strutturati | TAN, durate, commissioni, policy, priorità | Tabelle Convex esistenti |
| Knowledge base | Procedure, FAQ, alert, documenti, eccezioni | `knowledgeCards` |
| Motori | Calcolo rata/TAEG e compatibilità formale | `shared/financial-engine`, `shared/policy-engine` |

### Cosa non sta più nel prompt

Il prompt **non** deve contenere:

- tabelle economiche, TAN, commissioni, durate;
- formule di calcolo rata / TAEG;
- elenco completo delle policy;
- dati che cambiano frequentemente.

Queste informazioni restano nei motori e nelle tabelle versionate.

### Knowledge base

Schede amministrabili (`knowledgeCards`) con:

- categorie (documenti, liquidazione, garanti, alert, FAQ, …);
- rete `PCG` / `DES` / `BOTH`;
- scope opzionale (finanziaria / prodotto / tabella);
- keywords normalizzate;
- priorità 0–100;
- `alwaysInclude` (poche schede fondamentali);
- alert operativi;
- validità temporale;
- versionamento (`version` + `supersedesCardId`).

Selezione **deterministica** in `shared/knowledge-engine/` (rete, scope, keyword, priorità, limiti caratteri). Nessun embedding.

### Scelta architetturale

RataSmart utilizza una knowledge base amministrabile a schede.
Per la V1 non usa embeddings o ricerca vettoriale: il numero contenuto
di procedure permette una selezione deterministica basata su rete,
scope, keyword, priorità e validità. Questa scelta riduce complessità,
costi e rischio di recuperare contenuti non pertinenti.

### Admin UI

- `/admin/virtual-marco` — hub
- `/admin/virtual-marco/configurazione` — prompt e versioni assistant
- `/admin/virtual-marco/conoscenza` — elenco/form schede
- `/admin/virtual-marco/anteprima` — anteprima contesto senza OpenAI

Seed idempotente: `seed.seedVirtualMarcoDemo` (anche dal pannello Configurazione).

Contenuti demo marcati **DEMO TECNICA – NON USARE COME POLICY UFFICIALE**.

### Limiti Fase 4A (risolti in parte dalla 4B)

- embeddings / vector store assenti (scelta consapevole);
- contenuti demo non ufficiali;
- nessun Auth0;
- nessuna chiave API in database o frontend.

## Chat Virtual Marco – Fase 4B

### Architettura chat

```text
Guardrail tecnico
+ prompt di comportamento
+ knowledge base selezionata
+ contesto anonimo della simulazione
+ cronologia limitata
+ domanda del CM
```

### Privacy

- chiave solo server-side (`OPENAI_API_KEY`, `AI_PROVIDER_MODE`);
- Responses API con `store: false`;
- nessun nome paziente / clinica / IBAN inviato al provider;
- modalità predefinita `patient_safe`;
- modalità `internal` solo dopo conferma esplicita;
- avviso UI contro dati personali;
- nessun prompt completo nei log.

> L’impostazione store:false evita la conservazione dello stato applicativo
> della risposta da parte della Responses API, ma non equivale automaticamente
> a Zero Data Retention o all’assenza di eventuali log di sicurezza del provider.

Configurazione Convex:

```text
npx convex env set OPENAI_API_KEY "..."
npx convex env set AI_PROVIDER_MODE "openai"
```

Seed demo (nuova versione, senza mutare in-place):

- `modelProvider: openai`
- `modelName: gpt-5.6-luna` (modificabile dall’admin; mai hardcoded nell’action)
- `temperature: 0.2`
- `maxOutputTokens: 1200`

### Provider

- interfaccia `ServerAiProvider` sostituibile;
- adapter OpenAI Responses API;
- adapter mock esplicito (`AI_PROVIDER_MODE=mock`);
- nessuna garanzia che provider “compatibili” supportino la Responses API.

### Limitazioni Fase 4B

- nessun embedding / web search / tool / function calling;
- nessun calcolo AI autonomo;
- nessuna modifica della simulazione dalla chat;
- nessuno streaming;
- nessun Auth0 / fiscale / PDF / esito pratica.

## Virtual Marco – Pre-screening (senza simulazione)

Virtual Marco supporta due modalità informative:

1. **PRE-SCREENING** — disponibile anche senza simulazione aperta. Usa tabelle finanziarie attive, policy strutturate valide e knowledge card pertinenti per un primo filtro operativo (età, importi, durate, lavoro, permesso, pensione, documenti, garanti, finanziarie/prodotti).
2. **ASSISTENZA ALLA SIMULAZIONE** — utilizza risultati e snapshot deterministici già calcolati dal financial-engine e dal policy-engine.

**Virtual Marco non esegue autonomamente calcoli finanziari** (rata, TAN, TAEG, costi, ammortamento). Per un calcolo economico senza simulazione indirizza il CM al simulatore.

Il riconoscimento degli intent è deterministico (nessuna seconda chiamata LLM). Le finanziarie/prodotti/tabelle citate vengono matchate dal catalogo attivo Convex (con alias tecnici da iniziali, es. “Deutsche Bank” → “DB”).

Audit opzionale sui messaggi assistant: `usedPreScreeningContext`, `preScreeningIntents`, `matchedCompanyIds`.

### Policy formali PCG 2026

Seed idempotente: `seedPcgFinancingPolicies2026` (admin → Policy → “Carica policy finanziamenti PCG 2026”).

Carica requisiti paziente Agos / Compass / Deutsche Bank (età, lavoro, permesso, ricevuta, studente/casalinga). Non modifica TAN/importi/durate delle tabelle.

Prompt PRE-SCREENING: `activateVirtualMarcoPreScreeningPrompt` o `seedVirtualMarcoDemo` se manca la sezione PRE-SCREENING.

### Comandi

```bash
npm run test:knowledge
npm run test:assistant
npm run test
npm run typecheck
npm run build
```

## Struttura rilevante Fase 2–4B

```text
shared/
  financial-engine/
  policy-engine/
  comparison-snapshot/
  knowledge-engine/
  assistant-context/
convex/
  assistantConfigs.ts
  knowledgeCards.ts
  assistantChat.ts
  assistantConversations.ts
  lib/ai/
src/features/chat/
src/features/admin/virtual-marco/
```

## Roadmap

1. Fondamenta e profili demo. ✅
2. Modello dati finanziarie e tabelle. ✅
3. Motore di calcolo rata e TAEG.
   - 3A Motore deterministico e testato. ✅
   - 3B Collegamento al simulatore / confronto / policy. ✅
   - 3C Snapshot immutabile condizioni e risultati. ✅
4. Chat contestuale.
   - 4A Knowledge base + selezione deterministica. ✅
   - 4B Chiamate modello / chat reale. ✅
5. Pannello admin completo (estensioni UX avanzate).
6. Auth0 e sicurezza di produzione.
7. Dashboard comportamentale.

## Preparazione Auth0

- `externalAuthId` su `appUsers`
- `AuthAdapter` / `DemoAuthAdapter`
- UI solo via `AuthProvider` / `useCurrentUser`
- Mutation admin con `requireAdmin` + TODO Auth0 (`ctx.auth`)
