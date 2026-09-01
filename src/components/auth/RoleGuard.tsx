import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingState } from "@/components/common/LoadingState";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";

type RoleGuardProps = {
  allow: Array<"cm" | "admin">;
  redirectTo?: string;
};

/**
 * Guard demo basato sul profilo selezionato.
 * Con Auth0 verrà sostituito da claim/ruolo lato identity provider.
 */
export function RoleGuard({ allow, redirectTo = "/" }: RoleGuardProps) {
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (!allow.includes(user.role)) {
    const fallback = user.role === "admin" ? "/admin" : "/app";
    return <Navigate to={redirectTo === "/" ? fallback : redirectTo} replace />;
  }

  return <Outlet />;
}
