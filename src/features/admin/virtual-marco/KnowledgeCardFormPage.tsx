import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type FormState = {
  title: string;
  content: string;
  category: KnowledgeCategory;
  network: KnowledgeNetwork;
  companyId: string;
  productId: string;
  financialTableId: string;
  keywordsText: string;
  priority: string;
  alwaysInclude: boolean;
  isAlert: boolean;
  alertLabel: string;
  visibility: "patient_safe" | "internal_only";
  sourceReference: string;
  adminNotes: string;
  showInFaq: boolean;
  faqQuestion: string;
  faqCategory: string;
  faqOrder: string;
  isActive: boolean;
  validFrom: string;
  validTo: string;
};

const emptyForm: FormState = {
  title: "",
  content: "",
  category: "faq",
  network: "BOTH",
  companyId: "",
  productId: "",
  financialTableId: "",
  keywordsText: "",
  priority: "50",
  alwaysInclude: false,
  isAlert: false,
  alertLabel: "",
  visibility: "internal_only",
  sourceReference: "",
  adminNotes: "",
  showInFaq: false,
  faqQuestion: "",
  faqCategory: "",
  faqOrder: "",
  isActive: true,
  validFrom: "",
  validTo: "",
};

function parseDate(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
}

function toDateInput(value?: number): string {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function KnowledgeCardFormPage({
  mode,
}: {
  mode: "create" | "edit" | "newVersion";
}) {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const card = useQuery(
    api.knowledgeCards.getKnowledgeCard,
    cardId ? { cardId: cardId as Id<"knowledgeCards"> } : "skip",
  );
  const companies = useQuery(api.financialCompanies.listFinancialCompanies);
  const products = useQuery(api.financialProducts.listFinancialProducts);
  const tables = useQuery(api.financialTables.listFinancialTablesAdmin);
  const createCard = useMutation(api.knowledgeCards.createKnowledgeCard);
  const createVersion = useMutation(api.knowledgeCards.createKnowledgeCardVersion);
  const updateMetadata = useMutation(
    api.knowledgeCards.updateKnowledgeCardMetadata,
  );

  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!card || mode === "create") return;
    setForm({
      title: card.title,
      content: card.content,
      category: card.category,
      network: card.network,
      companyId: card.companyId ?? "",
      productId: card.productId ?? "",
      financialTableId: card.financialTableId ?? "",
      keywordsText: card.keywords.join(", "),
      priority: String(card.priority),
      alwaysInclude: card.alwaysInclude,
      isAlert: card.isAlert,
      alertLabel: card.alertLabel ?? "",
      visibility: card.visibility ?? "internal_only",
      sourceReference: card.sourceReference ?? "",
      adminNotes: card.adminNotes ?? "",
      showInFaq: card.showInFaq ?? false,
      faqQuestion: card.faqQuestion ?? "",
      faqCategory: card.faqCategory ?? "",
      faqOrder:
        card.faqOrder !== undefined && card.faqOrder !== null
          ? String(card.faqOrder)
          : "",
      isActive: card.isActive,
      validFrom: toDateInput(card.validFrom),
      validTo: toDateInput(card.validTo),
    });
  }, [card, mode]);

  const filteredProducts = useMemo(
    () =>
      (products ?? []).filter((product) =>
        form.companyId ? product.companyId === form.companyId : true,
      ),
    [products, form.companyId],
  );

  const filteredTables = useMemo(
    () =>
      (tables ?? []).filter((table) => {
        if (form.companyId && table.companyId !== form.companyId) return false;
        if (form.productId && table.productId !== form.productId) return false;
        return true;
      }),
    [tables, form.companyId, form.productId],
  );

  if (
    companies === undefined ||
    products === undefined ||
    tables === undefined ||
    (mode !== "create" && card === undefined)
  ) {
    return <LoadingState />;
  }

  const contentLocked = mode === "edit";

  const buildPayload = () => ({
    title: form.title,
    content: form.content,
    category: form.category,
    network: form.network,
    companyId: form.companyId
      ? (form.companyId as Id<"financialCompanies">)
      : undefined,
    productId: form.productId
      ? (form.productId as Id<"financialProducts">)
      : undefined,
    financialTableId: form.financialTableId
      ? (form.financialTableId as Id<"financialTables">)
      : undefined,
    keywords: form.keywordsText
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
    priority: Number(form.priority),
    alwaysInclude: form.alwaysInclude,
    isAlert: form.isAlert,
    alertLabel: form.alertLabel || undefined,
    visibility: form.visibility,
    sourceReference: form.sourceReference || undefined,
    adminNotes: form.adminNotes || undefined,
    showInFaq: form.showInFaq,
    faqQuestion: form.faqQuestion || undefined,
    faqCategory: form.faqCategory || undefined,
    faqOrder: form.faqOrder.trim() ? Number(form.faqOrder) : undefined,
    isActive: form.isActive,
    validFrom: parseDate(form.validFrom),
    validTo: parseDate(form.validTo),
  });

  const onSubmit = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const payload = buildPayload();
      if (mode === "create") {
        const id = await createCard({ actorUserId: userId, ...payload });
        toast.success("Scheda creata");
        navigate(`/admin/virtual-marco/conoscenza/${id}`);
      } else if (mode === "newVersion" && cardId) {
        const id = await createVersion({
          actorUserId: userId,
          supersedesCardId: cardId as Id<"knowledgeCards">,
          ...payload,
        });
        toast.success("Nuova versione creata");
        navigate(`/admin/virtual-marco/conoscenza/${id}`);
      } else if (mode === "edit" && cardId) {
        await updateMetadata({
          actorUserId: userId,
          cardId: cardId as Id<"knowledgeCards">,
          keywords: payload.keywords,
          priority: payload.priority,
          isActive: payload.isActive,
          validFrom: payload.validFrom,
          validTo: payload.validTo,
          adminNotes: payload.adminNotes,
          sourceReference: payload.sourceReference,
          alwaysInclude: payload.alwaysInclude,
          isAlert: payload.isAlert,
          alertLabel: payload.alertLabel,
          showInFaq: payload.showInFaq,
          faqQuestion: payload.faqQuestion,
          faqCategory: payload.faqCategory,
          faqOrder: payload.faqOrder,
        });
        toast.success("Metadati aggiornati");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Salvataggio non riuscito.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          mode === "create"
            ? "Nuova scheda"
            : mode === "newVersion"
              ? "Nuova versione scheda"
              : "Scheda conoscenza"
        }
        description={
          contentLocked
            ? "In modifica diretta puoi aggiornare solo metadati. Per titolo/contenuto crea una nuova versione."
            : "Scheda operativa per Virtual Marco."
        }
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/virtual-marco/conoscenza">Torna all’elenco</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Contenuto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input
              disabled={contentLocked}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Testo operativo</Label>
            <Textarea
              className="min-h-40"
              disabled={contentLocked}
              value={form.content}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  content: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.category}
              disabled={contentLocked}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  category: value as KnowledgeCategory,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KNOWLEDGE_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {KNOWLEDGE_CATEGORY_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ambito</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Rete</Label>
            <Select
              value={form.network}
              disabled={contentLocked}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  network: value as KnowledgeNetwork,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KNOWLEDGE_NETWORKS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {KNOWLEDGE_NETWORK_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Finanziaria</Label>
            <Select
              value={form.companyId || "NONE"}
              disabled={contentLocked}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  companyId: value === "NONE" ? "" : value,
                  productId: "",
                  financialTableId: "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Nessuna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Nessuna (generale)</SelectItem>
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
              value={form.productId || "NONE"}
              disabled={contentLocked}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  productId: value === "NONE" ? "" : value,
                  financialTableId: "",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Nessuno" />
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
              value={form.financialTableId || "NONE"}
              disabled={contentLocked}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  financialTableId: value === "NONE" ? "" : value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Nessuna" />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FAQ operative (CM)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={form.showInFaq}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  showInFaq: checked === true,
                }))
              }
            />
            Mostra nelle FAQ
          </label>
          <div className="space-y-2 sm:col-span-2">
            <Label>Domanda FAQ</Label>
            <Input
              value={form.faqQuestion}
              placeholder="Opzionale: se vuota usa il titolo"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  faqQuestion: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria FAQ</Label>
            <Input
              value={form.faqCategory}
              placeholder="es. Documenti"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  faqCategory: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Ordine FAQ</Label>
            <Input
              value={form.faqOrder}
              inputMode="numeric"
              placeholder="es. 10"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  faqOrder: event.target.value,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ricerca, alert e validità</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Keywords (separate da virgola)</Label>
            <Input
              value={form.keywordsText}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  keywordsText: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Priorità (0–100)</Label>
            <Input
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priority: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Etichetta alert</Label>
            <Input
              value={form.alertLabel}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  alertLabel: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Visibilità</Label>
            <Select
              value={form.visibility}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  visibility: value as "patient_safe" | "internal_only",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="patient_safe">Patient safe</SelectItem>
                <SelectItem value="internal_only">Solo interna</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.alwaysInclude}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  alwaysInclude: checked === true,
                }))
              }
            />
            Sempre inclusa
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isAlert}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  isAlert: checked === true,
                }))
              }
            />
            È un alert
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  isActive: checked === true,
                }))
              }
            />
            Attiva
          </label>
          <div className="space-y-2">
            <Label>Valida da</Label>
            <Input
              type="date"
              value={form.validFrom}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  validFrom: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Valida fino a</Label>
            <Input
              type="date"
              value={form.validTo}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  validTo: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Fonte</Label>
            <Input
              value={form.sourceReference}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sourceReference: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Note admin</Label>
            <Input
              value={form.adminNotes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  adminNotes: event.target.value,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={isSaving} onClick={() => void onSubmit()}>
          {isSaving
            ? "Salvataggio…"
            : mode === "edit"
              ? "Salva metadati"
              : mode === "newVersion"
                ? "Crea nuova versione"
                : "Crea scheda"}
        </Button>
        {mode === "edit" && cardId ? (
          <Button asChild variant="outline">
            <Link to={`/admin/virtual-marco/conoscenza/${cardId}/nuova-versione`}>
              Crea nuova versione
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
