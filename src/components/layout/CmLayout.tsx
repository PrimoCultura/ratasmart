import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Menu, UserRound, X } from "lucide-react";
import { CmNav } from "@/components/navigation/CmNav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { APP_NAME, APP_PAYOFF } from "@/lib/constants/app";

export function CmLayout() {
  const { user, clearSession } = useCurrentUser();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleChangeProfile = () => {
    clearSession();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-card lg:flex lg:flex-col">
        <div className="space-y-1 px-5 py-6">
          <Link to="/app" className="block">
            <p className="text-lg font-semibold tracking-tight text-primary">
              {APP_NAME}
            </p>
            <p className="text-xs text-muted-foreground">{APP_PAYOFF}</p>
          </Link>
        </div>
        <Separator />
        <div className="flex-1 px-3 py-4">
          <CmNav />
        </div>
        <div className="space-y-3 border-t border-border p-4">
          <div className="flex items-start gap-2">
            <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.clinicName ?? "Clinica non indicata"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleChangeProfile}
          >
            Cambia profilo
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <div>
            <p className="font-semibold text-primary">{APP_NAME}</p>
            <p className="text-xs text-muted-foreground">{user?.displayName}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Apri menu"
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </header>

        {mobileOpen ? (
          <div className="border-b border-border bg-card px-3 py-3 lg:hidden">
            <CmNav onNavigate={() => setMobileOpen(false)} />
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={handleChangeProfile}
            >
              Cambia profilo
            </Button>
          </div>
        ) : null}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
