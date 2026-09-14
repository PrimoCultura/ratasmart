export const APP_NAME = "RataSmart";
export const APP_PAYOFF = "Il tuo Virtual Marco";
export const APP_SUBTITLE =
  "Confronta finanziamenti, verifica le condizioni e costruisci la proposta più adatta.";

export const MAX_DEMO_CM_USERS = 2;

export const NETWORKS = ["PCG", "DES", "Paoleschi"] as const;
export type Network = (typeof NETWORKS)[number];

export const SIMULATION_STATUSES = ["draft", "proposed"] as const;
export type SimulationStatus = (typeof SIMULATION_STATUSES)[number];
