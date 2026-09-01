import { Link, Outlet, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AdminNav } from "@/components/navigation/AdminNav";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { APP_NAME } from "@/lib/constants/app";

export function AdminLayout() {
  const { user, clearSession } = useCurrentUser();
  const navigate = useNavigate();

  const handleExit = () => {
    clearSession();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-r border-border bg-card">
        <div className="space-y-2 px-5 py-6">
          <Link to="/admin">
            <p className="text-lg font-semibold text-primary">{APP_NAME}</p>
          </Link>
          <Badge variant="warning">Admin demo · solo sviluppo</Badge>
          <p className="text-xs text-muted-foreground">{user?.displayName}</p>
        </div>
        <Separator />
        <div className="px-3 py-4">
          <AdminNav />
        </div>
        <div className="border-t border-border p-4">
          <Button variant="outline" size="sm" className="w-full" onClick={handleExit}>
            Esci dall&apos;admin
          </Button>
        </div>
      </aside>

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
