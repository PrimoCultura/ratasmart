import type { AuthAdapter } from "./types";

const STORAGE_KEY = "ratasmart.demo.userId";

/**
 * Adapter demo basato su localStorage.
 * I componenti UI NON devono accedere direttamente a localStorage:
 * usare sempre AuthProvider / useCurrentUser.
 *
 * TODO fase Auth0: creare Auth0Adapter che implementa AuthAdapter
 * e sostituirlo nel provider senza riscrivere le pagine.
 */
export class DemoAuthAdapter implements AuthAdapter {
  getStoredUserId(): string | null {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(STORAGE_KEY);
  }

  setStoredUserId(userId: string): void {
    window.localStorage.setItem(STORAGE_KEY, userId);
  }

  clearStoredUserId(): void {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export const demoAuthAdapter = new DemoAuthAdapter();
