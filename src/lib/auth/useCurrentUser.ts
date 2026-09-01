import { useAuthContext } from "./AuthProvider";
import type { AppUser } from "./types";
import type { Id } from "../../../convex/_generated/dataModel";

export type CurrentUserResult = {
  user: AppUser | null;
  userId: Id<"appUsers"> | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isCm: boolean;
  isAdmin: boolean;
  selectUser: (userId: Id<"appUsers">) => void;
  clearSession: () => void;
  ensureDemoAdmin: () => Promise<Id<"appUsers">>;
};

/**
 * Hook unico per leggere l'utente corrente.
 * I componenti UI devono usare questo hook e non localStorage.
 */
export function useCurrentUser(): CurrentUserResult {
  const auth = useAuthContext();

  return {
    user: auth.user,
    userId: auth.userId,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    isCm: auth.user?.role === "cm",
    isAdmin: auth.user?.role === "admin",
    selectUser: auth.selectUser,
    clearSession: auth.clearSession,
    ensureDemoAdmin: auth.ensureDemoAdmin,
  };
}
