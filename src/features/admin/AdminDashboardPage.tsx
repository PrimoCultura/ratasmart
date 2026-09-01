import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";

export function AdminDashboardPage() {
  const cmCount = useQuery(api.users.countDemoCmUsers);
  const simulationCount = useQuery(api.simulations.countAllSimulations);

  if (cmCount === undefined || simulationCount === undefined) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard admin"
        description="Panoramica demo. Consultazione simulazioni in sola lettura."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              CM demo attivi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{cmCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Simulazioni totali
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{simulationCount}</p>
          </CardContent>
        </Card>
      </div>

      <Button asChild variant="outline">
        <Link to="/admin/simulazioni">Vai a tutte le simulazioni</Link>
      </Button>
    </div>
  );
}

export { AdminSimulationsPage } from "./simulations/AdminSimulationsPage";
