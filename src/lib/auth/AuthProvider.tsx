import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { demoAuthAdapter } from "./DemoAuthAdapter";
import type { AppUser, AuthAdapter, AuthSession } from "./types";

type AuthContextValue = {
  user: AppUser | null;
  userId: Id<"appUsers"> | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  selectUser: (userId: Id<"appUsers">) => void;
  clearSession: () => void;
  ensureDemoAdmin: () => Promise<Id<"appUsers">>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
  /**
   * Permette di iniettare un adapter diverso (es. Auth0Adapter in futuro)
   * senza riscrivere AuthProvider.
   */
  adapter?: AuthAdapter;
};

export function AuthProvider({
  children,
  adapter = demoAuthAdapter,
}: AuthProviderProps) {
  const [storedUserId, setStoredUserId] = useState<string | null>(() =>
    adapter.getStoredUserId(),
  );

  const userId =
    storedUserId !== null ? (storedUserId as Id<"appUsers">) : null;

  const user = useQuery(
    api.users.getUserById,
    userId ? { userId } : "skip",
  );

  const ensureDemoAdminMutation = useMutation(api.users.ensureDemoAdmin);

  const isLoading = userId !== null && user === undefined;

  useEffect(() => {
    if (userId && user === null) {
      adapter.clearStoredUserId();
      setStoredUserId(null);
    }
  }, [adapter, user, userId]);

  const selectUser = useCallback(
    (nextUserId: Id<"appUsers">) => {
      adapter.setStoredUserId(nextUserId);
      setStoredUserId(nextUserId);
    },
    [adapter],
  );

  const clearSession = useCallback(() => {
    adapter.clearStoredUserId();
    setStoredUserId(null);
  }, [adapter]);

  const ensureDemoAdmin = useCallback(async () => {
    const adminId = await ensureDemoAdminMutation();
    selectUser(adminId);
    return adminId;
  }, [ensureDemoAdminMutation, selectUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      userId,
      isLoading,
      isAuthenticated: Boolean(user),
      selectUser,
      clearSession,
      ensureDemoAdmin,
    }),
    [user, userId, isLoading, selectUser, clearSession, ensureDemoAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext deve essere usato dentro AuthProvider.");
  }
  return context;
}

export type { AuthSession };
