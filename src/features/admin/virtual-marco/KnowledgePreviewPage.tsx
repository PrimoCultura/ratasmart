import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { NETWORKS, type Network } from "@/lib/constants/app";
import { KNOWLEDGE_CATEGORY_LABELS, type KnowledgeCategory } from "@/lib/constants/knowledge";

export function KnowledgePreviewPage() {
  const { userId } = useCurrentUser();
  const companies = useQuery(api.financialCompanies.listFinancialCompanies);
  const products = useQuery(api.financialProducts.listFinancialProducts);
  const tables = useQuery(api.financialTables.listFinancialTablesAdmin);

  const [network, setNetwork] = useState<Network>("PCG");
  const [companyId, setCompanyId] = useState("");
  const [productId, setProductId] = useState("");
  const [financialTableId, setFinancialTableId] = useState("");
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState<{
    network: Network;
    companyId?: Id<"financialCompanies">;
    productId?: Id<"financialProducts">;
    financialTableId?: Id<"financialTables">;
    userQuestion?: string;
  } | null>(null);

  const preview = useQuery(
    api.knowledgeCards.previewKnowledgeContext,
    userId && submitted
      ? {
          actorUserId: userId,
          network: submitted.network,
          companyId: submitted.companyId,
          productId: submitted.productId,
          financialTableId: submitted.financialTableId,
          userQuestion: submitted.userQuestion,
        }
      : "skip",
  );

  const filteredProducts = useMemo(
    () =>
      (products ?? []).filter((product) =>
        companyId ? product.companyId === companyId : true,
      ),
    [products, companyId],
  );

  const filteredTables = useMemo(
    () =>
      (tables ?? []).filter((table) => {
        if (companyId && table.companyId !== companyId) return false;
        if (productId && table.productId !== productId) return false;
        return true;
      }),
    [tables, companyId, productId],
  );

  if (
    companies === undefined ||
    products === undefined ||
    tables === undefined
  ) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anteprima contesto"
        description="Selezione deterministica delle schede senza chiamate OpenAI."
      />

      <Card>
        <CardHeader>
          <CardTitle>Parametri di prova</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Rete</Label>
            <Select
              value={network}
              onValueChange={(value) => setNetwork(value as Network)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NETWORKS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Finanziaria</Label>
            <Select
              value={companyId || "NONE"}
              onValueChange={(value) => {
                setCompanyId(value === "NONE" ? "" : value);
                setProductId("");
                setFinancialTableId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Nessuna</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company._id} value={company._id}>
                    {company.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prodotto</Label>
            <Select
              value={productId || "NONE"}
              onValueChange={(value) => {
                setProductId(value === "NONE" ? "" : value);
                setFinancialTableId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Nessuno</SelectItem>
                {filteredProducts.map((product) => (
                  <SelectItem key={product._id} value={product._id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tabella</Label>
            <Select
              value={financialTableId || "NONE"}
              onValueChange={(value) =>
                setFinancialTableId(value === "NONE" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Nessuna</SelectItem>
                {filteredTables.map((table) => (
                  <SelectItem key={table._id} value={table._id}>
                    {table.tableCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Domanda di prova</Label>
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="es. Come funziona la liquidazione Agos?"
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              onClick={() =>
                setSubmitted({
                  network,
                  companyId: companyId
                    ? (companyId as Id<"financialCompanies">)
                    : undefined,
                  productId: productId
                    ? (productId as Id<"financialProducts">)
                    : undefined,
                  financialTableId: financialTableId
                    ? (financialTableId as Id<"financialTables">)
                    : undefined,
                  userQuestion: question.trim() || undefined,
                })
              }
            >
              Genera contesto
            </Button>
          </div>
        </CardContent>
      </Card>

      {submitted && preview === undefined ? <LoadingState /> : null}

      {preview ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Riepilogo selezione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Schede selezionate: {preview.selectedCards.length} · Caratteri:{" "}
                {preview.totalCharacters} · Escluse per limite:{" "}
                {preview.excludedByLimitCount}
              </p>
              {preview.warnings.map((warning) => (
                <p key={warning} className="text-amber-800">
                  {warning}
                </p>
              ))}
            </CardContent>
          </Card>

          {preview.selectedCards.map((card, index) => (
            <Card key={card.id}>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">
                    #{index + 1} · {card.title}
                  </CardTitle>
                  <Badge variant="secondary">
                    {KNOWLEDGE_CATEGORY_LABELS[
                      card.category as KnowledgeCategory
                    ] ?? card.category}
                  </Badge>
                  <Badge variant="outline">score {card.score}</Badge>
                  {card.isAlert ? <Badge variant="warning">Alert</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="whitespace-pre-wrap">{card.content}</p>
                <p className="text-xs text-muted-foreground">
                  Motivi: {card.matchReasons.join(" · ")}
                </p>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Testo finale del contesto</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">
                {preview.contextText}
              </pre>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
