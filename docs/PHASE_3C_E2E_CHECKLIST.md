# Checklist E2E browser — Fase 3C

Checklist per verifiche manuali sull’app avviata (`npm run dev` + `npm run dev:backend`) con seed demo.

**Stato:** i test sotto non sono stati eseguiti in browser in questa sessione. Segnare `Pass` solo dopo esecuzione reale.

| ID | Scenario | Pass | Note |
|---|---|---|---|
| A | Immutabilità tabella: calcola → versiona tabella (TAN/commissione) → storico invariato → ricalcolo usa nuova versione | ☐ | |
| B | Immutabilità policy: calcola → modifica/versiona policy → storico invariato → ricalcolo nuovo esito | ☐ | |
| C | Proposta: seleziona compatibile → badge → stato `proposed` → sostituisci → una sola attiva | ☐ | |
| D | Blocco proposta: non proponibile `verification_required` / `not_compatible` / altro CM | ☐ | |
| E | Piano storico: apri run → rigenera piano → saldo zero → coerente col riepilogo | ☐ | |
| F | Dati cambiati: calcola → modifica importo/età → alert → nessun auto-ricalcolo → ricalcolo → nuovo run | ☐ | |
| G | Idempotenza: stesso `requestId` due volte → un solo run | ☐ | Via Convex / action |
| H | Cancellazione: elimina simulazione → run e soluzioni eliminati, nessun orfano | ☐ | |
| I | Isolamento CM: secondo CM non vede/apre/rigenera/propone/cancella simulazioni altrui | ☐ | |
| J | Admin: vede tutto, apre cronologia, vede proposta, non modifica/ricalcola/propone | ☐ | |

## Prerequisiti

1. Seed Agos Pass eseguito dall’admin.
2. Almeno un profilo CM demo.
3. Tabelle/policy attive sulla rete della simulazione.
