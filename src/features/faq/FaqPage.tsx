import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  buildFaqEntries,
  filterFaqByCategory,
  listFaqCategories,
  searchFaqEntries,
} from "../../../shared/knowledge-engine/faq";

export function FaqPage() {
  const cards = useQuery(api.knowledgeCards.listFaqKnowledgeCards);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = useMemo(() => {
    if (!cards) return [];
    return buildFaqEntries(
      cards.map((card) => ({
        id: card._id,
        title: card.title,
        content: card.content,
        category: card.category,
        network: card.network,
        keywords: card.keywords,
        priority: card.priority,
        alwaysInclude: card.alwaysInclude,
        isAlert: card.isAlert,
        alertLabel: card.alertLabel,
        visibility: card.visibility,
        isActive: card.isActive,
        validFrom: card.validFrom,
        validTo: card.validTo,
        version: card.version,
        supersedesCardId: card.supersedesCardId,
        showInFaq: card.showInFaq,
        faqQuestion: card.faqQuestion,
        faqCategory: card.faqCategory,
        faqOrder: card.faqOrder,
      })),
    );
  }, [cards]);

  const categories = useMemo(() => listFaqCategories(entries), [entries]);

  const filtered = useMemo(() => {
    const searched = searchFaqEntries(entries, query);
    return filterFaqByCategory(searched, category);
  }, [entries, query, category]);

  if (cards === undefined) {
    return <LoadingState label="Caricamento FAQ…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="FAQ operative"
        description="Procedure operative dalle knowledge card attive. Non sostituisce Virtual Marco."
      />

      <div className="space-y-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca nelle FAQ…"
          aria-label="Cerca nelle FAQ"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={category === "all" ? "default" : "outline"}
            onClick={() => setCategory("all")}
          >
            Tutte ({entries.length})
          </Button>
          {categories.map((item) => {
            const count = entries.filter((entry) => entry.category === item)
              .length;
            return (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={category === item ? "default" : "outline"}
                onClick={() => setCategory(item)}
              >
                {item} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna FAQ trovata con i filtri correnti.
        </p>
      ) : (
        <div className="divide-y rounded-md border">
          {filtered.map((entry) => {
            const open = openId === entry.id;
            return (
              <div key={entry.id} className="bg-background">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
                  aria-expanded={open}
                  onClick={() =>
                    setOpenId((current) =>
                      current === entry.id ? null : entry.id,
                    )
                  }
                >
                  <span>{entry.question}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {entry.category}
                  </span>
                </button>
                {open ? (
                  <div className="whitespace-pre-wrap px-4 pb-4 text-sm text-muted-foreground">
                    {entry.answer}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
