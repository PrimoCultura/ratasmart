import type { Doc, Id } from "../../../convex/_generated/dataModel";

export type UserRole = "cm" | "admin";

export type AppUser = Doc<"appUsers">;

export type AuthSession = {
  userId: Id<"appUsers">;
  user: AppUser;
};

/**
 * Adapter di autenticazione.
 * DemoAuthAdapter usa localStorage.
 * In futuro: Auth0Adapter implementerà la stessa interfaccia
 * senza modificare i componenti UI.
 */
export interface AuthAdapter {
  getStoredUserId(): string | null;
  setStoredUserId(userId: string): void;
  clearStoredUserId(): void;
}
