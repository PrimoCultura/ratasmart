import { Navigate, Route, Routes } from "react-router-dom";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { CmLayout } from "@/components/layout/CmLayout";
import { AdminDashboardPage, AdminSimulationsPage } from "@/features/admin/AdminDashboardPage";
import { AdminUsersPage } from "@/features/admin/users/AdminUsersPage";
import { AdminSimulationDetailPage } from "@/features/admin/simulations/AdminSimulationDetailPage";
import { CompaniesPage } from "@/features/admin/financial-companies/CompaniesPage";
import { TablesPage } from "@/features/admin/financial-tables/TablesPage";
import { TableFormPage } from "@/features/admin/financial-tables/TableFormPage";
import { PoliciesPage } from "@/features/admin/policies/PoliciesPage";
import { PolicyDetailPage } from "@/features/admin/policies/PolicyDetailPage";
import { PrioritiesPage } from "@/features/admin/priorities/PrioritiesPage";
import { InternalMessagesPage } from "@/features/admin/internal-messages/InternalMessagesPage";
import { VirtualMarcoHubPage } from "@/features/admin/virtual-marco/VirtualMarcoHubPage";
import { AssistantConfigPage } from "@/features/admin/virtual-marco/AssistantConfigPage";
import { KnowledgeCardsPage } from "@/features/admin/virtual-marco/KnowledgeCardsPage";
import { KnowledgeCardFormPage } from "@/features/admin/virtual-marco/KnowledgeCardFormPage";
import { KnowledgePreviewPage } from "@/features/admin/virtual-marco/KnowledgePreviewPage";
import { AssistantConversationsAdminPage } from "@/features/admin/virtual-marco/AssistantConversationsAdminPage";
import { ChatPage } from "@/features/chat/ChatPage";
import { FaqPage } from "@/features/faq/FaqPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { HistoryPage } from "@/features/history/HistoryPage";
import { SimulationDetailPage } from "@/features/history/SimulationDetailPage";
import { SimulatorPage } from "@/features/simulator/SimulatorPage";
import { LoginPage } from "@/pages/LoginPage";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { LoadingState } from "@/components/common/LoadingState";

function RootRedirect() {
  const { user, isLoading, isAuthenticated } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  if (isAuthenticated && user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (isAuthenticated && user?.role === "cm") {
    return <Navigate to="/app" replace />;
  }

  return <LoginPage />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route element={<RoleGuard allow={["cm"]} />}>
        <Route path="/app" element={<CmLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="simulator" element={<SimulatorPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/:simulationId" element={<SimulationDetailPage />} />
        </Route>
      </Route>

      <Route element={<RoleGuard allow={["admin"]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="utenti" element={<AdminUsersPage />} />
          <Route path="finanziarie" element={<CompaniesPage />} />
          <Route path="tabelle" element={<TablesPage />} />
          <Route path="tabelle/nuova" element={<TableFormPage mode="create" />} />
          <Route path="tabelle/:tableId" element={<TableFormPage mode="view" />} />
          <Route
            path="tabelle/:tableId/nuova-versione"
            element={<TableFormPage mode="newVersion" />}
          />
          <Route path="policy" element={<PoliciesPage />} />
          <Route path="policy/:policySetId" element={<PolicyDetailPage />} />
          <Route path="priorita" element={<PrioritiesPage />} />
          <Route path="messaggi" element={<InternalMessagesPage />} />
          <Route path="virtual-marco" element={<VirtualMarcoHubPage />} />
          <Route
            path="virtual-marco/configurazione"
            element={<AssistantConfigPage />}
          />
          <Route
            path="virtual-marco/conoscenza"
            element={<KnowledgeCardsPage />}
          />
          <Route
            path="virtual-marco/conoscenza/nuova"
            element={<KnowledgeCardFormPage mode="create" />}
          />
          <Route
            path="virtual-marco/conoscenza/:cardId"
            element={<KnowledgeCardFormPage mode="edit" />}
          />
          <Route
            path="virtual-marco/conoscenza/:cardId/nuova-versione"
            element={<KnowledgeCardFormPage mode="newVersion" />}
          />
          <Route
            path="virtual-marco/anteprima"
            element={<KnowledgePreviewPage />}
          />
          <Route
            path="virtual-marco/conversazioni"
            element={<AssistantConversationsAdminPage />}
          />
          <Route path="simulazioni" element={<AdminSimulationsPage />} />
          <Route
            path="simulazioni/:simulationId"
            element={<AdminSimulationDetailPage />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
