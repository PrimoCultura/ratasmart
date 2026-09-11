import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ActiveBadge } from "@/components/common/ActiveBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CATEGORY_LABELS,
  KNOWLEDGE_NETWORKS,
  KNOWLEDGE_NETWORK_LABELS,
  type KnowledgeCategory,
  type KnowledgeNetwork,
} from "@/lib/constants/knowledge";
import { formatDateTime } from "@/lib/formatting/currency";

export function KnowledgeCardsPage() {
  const { userId } = useCurrentUser();
  const cards = useQuery(api.knowledgeCards.listKnowledgeCardsAdmin);
  const setActive = useMutation(api.knowledgeCards.setKnowledgeCardActive);
  const seedKnowledge = useMutation(api.seed.seedPcgKnowledgeBase2026);
  const [seeding, setSeeding] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"ALL" | KnowledgeCategory>("ALL");
  const [network, setNetwork] = useState<"ALL" | KnowledgeNetwork>("ALL");
  const [companyId, setCompanyId] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "active" | "inactive">(
    "ALL",
  );
  const [alertOnly, setAlertOnly] = useState(false);

  const filtered = useMemo(() => {
    if (!cards) return [];
    const query = search.trim().toLowerCase();
    return cards
      .filter((card) => {
        if (category !== "ALL" && card.category !== category) return false;
        if (network !== "ALL" && card.network !== network) return false;
        if (companyId !== "ALL" && card.companyId !== companyId) return false;
        if (activeFilter === "active" && !card.isActive) return false;
        if (activeFilter === "inactive" && card.isActive) return false;
        if (alertOnly && !card.isAlert) return false;
        if (!query) return true;
        return (
          card.title.toLowerCase().includes(query) ||
          card.content.toLowerCase().includes(query) ||
          card.keywords.some((keyword) => keyword.includes(query))
        );
      })
      .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, "it"));
  }, [cards, search, category, network, companyId, activeFilter, alertOnly]);

  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const card of cards ?? []) {
      if (card.company) {
        map.set(card.company._id, card.company.shortName);
      }
    }
    return [...map.entries()];
  }, [cards]);

  if (cards === undefined) {
    return <LoadingState />;
  }

  const toggleActive = async (cardId: Id<"knowledgeCards">, isActive: boolean) => {
    if (!userId) return;
    try {
      await setActive({ actorUserId: userId, cardId, isActive: !isActive });
      toast.success(isActive ? "Scheda disattivata" : "Scheda attivata");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    }
  };

  const runKnowledgeSeed = () => {
    if (!userId) return;
    setSeeding(true);
    void seedKnowledge({ actorUserId: userId })
      .then((summary) => {
        toast.success(
          `KB PCG: +${summary.created.length} create, ${summary.versioned.length} versionate, ${summary.skipped.length} invariate`,
        );
        if (summary.deactivatedDemo.length > 0) {
          toast.message(
            `DEMO TECNICA disattivate: ${summary.deactivatedDemo.length}`,
          );
        }
        for (const warning of summary.warnings) {
          toast.message(warning);
        }
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Seed Knowledge Base non riuscito",
        );
      })
      .finally(() => setSeeding(false));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base di conoscenza"
        description="Schede operative versionabili per Virtual Marco."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!userId || seeding}
              onClick={runKnowledgeSeed}
            >
              {seeding ? "Caricamento…" : "Carica Knowledge Base PCG 2026"}
            </Button>
            <Button asChild>
              <Link to="/admin/virtual-marco/conoscenza/nuova">Nuova scheda</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Input
          className="md:col-span-2"
          placeholder="Cerca titolo, contenuto, keyword"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          value={category}
          onValueChange={(value) =>
            setCategory(value as "ALL" | KnowledgeCategory)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le categorie</SelectItem>
            {KNOWLEDGE_CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {KNOWLEDGE_CATEGORY_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={network}
          onValueChange={(value) =>
            setNetwork(value as "ALL" | KnowledgeNetwork)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Rete" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le reti</SelectItem>
            {KNOWLEDGE_NETWORKS.map((item) => (
              <SelectItem key={item} value={item}>
                {KNOWLEDGE_NETWORK_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger>
            <SelectValue placeholder="Finanziaria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le finanziarie</SelectItem>
            {companies.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={activeFilter}
          onValueChange={(value) =>
            setActiveFilter(value as "ALL" | "active" | "inactive")
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Attive e non</SelectItem>
            <SelectItem value="active">Solo attive</SelectItem>
            <SelectItem value="inactive">Solo non attive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={alertOnly}
          onChange={(event) => setAlertOnly(event.target.checked)}
        />
        Solo alert
      </label>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nessuna scheda"
          description="Crea una scheda oppure esegui il seed demo dalla configurazione."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((card) => (
            <div
              key={card._id}
              className="flex flex-col gap-3 rounded-md border border-border px-3 py-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{card.title}</p>
                  <Badge variant="secondary">
                    {KNOWLEDGE_CATEGORY_LABELS[card.category]}
                  </Badge>
                  <Badge variant="outline">
                    {KNOWLEDGE_NETWORK_LABELS[card.network]}
                  </Badge>
                  {card.title.includes("DEMO TECNICA") ||
                  card.content.includes("NON USARE COME POLICY UFFICIALE") ? (
                    <Badge variant="warning">DEMO</Badge>
                  ) : card.sourceReference?.includes("PCG KB ufficiale") ||
                    card.sourceReference?.includes("PCG KB 2026") ? (
                    <Badge variant="outline">Ufficiale PCG</Badge>
                  ) : null}
                  {card.isAlert ? <Badge variant="warning">Alert</Badge> : null}
                  <ActiveBadge active={card.isActive} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Priorità {card.priority} · v{card.version} ·{" "}
                  {card.company?.shortName ?? "Generale"}
                  {card.product ? ` / ${card.product.name}` : ""}
                  {card.financialTable
                    ? ` / ${card.financialTable.tableCode}`
                    : ""}{" "}
                  · {formatDateTime(card.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/admin/virtual-marco/conoscenza/${card._id}`}>
                    Visualizza
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void toggleActive(card._id, card.isActive)}
                >
                  {card.isActive ? "Disattiva" : "Attiva"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
