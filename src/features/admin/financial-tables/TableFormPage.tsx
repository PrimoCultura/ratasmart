import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { NETWORKS, type Network } from "@/lib/constants/app";
import {
  COMMON_FIRST_INSTALLMENT_DELAYS,
  INSTALLMENT_FEE_TYPES,
  INSTALLMENT_FEE_TYPE_LABELS,
  INTERNAL_COST_BASES,
  INTERNAL_COST_BASE_LABELS,
  OPENING_FEE_TYPES,
  OPENING_FEE_TYPE_LABELS,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  defaultRequiresManagerAuthorization,
  generateDurationMonths,
  type InstallmentFeeType,
  type InternalCostBase,
  type OpeningFeeType,
  type ProductCategory,
} from "@/lib/constants/financial";
import { financialTableEconomicsSchema } from "@/lib/validation/schemas";

type DurationTermFormRow = {
  durationMonths: string;
  minimumAmount: string;
  maximumAmount: string;
  customerTanPercent: string;
  internalCostPercent: string;
};

type TableFormState = {
  companyId: string;
  productId: string;
  network: Network;
  tableCode: string;
  displayName: string;
  description: string;
  category: ProductCategory;
  useDurationTerms: boolean;
  minimumAmount: string;
  maximumAmount: string;
  minimumDurationMonths: string;
  maximumDurationMonths: string;
  durationStepMonths: string;
  customerTanPercent: string;
  openingFeeType: OpeningFeeType;
  openingFeeValue: string;
  collectionFeePerInstallment: string;
  installmentFeeType: InstallmentFeeType;
  installmentFeeValue: string;
  internalCostPercentAt24Months: string;
  internalCostBase: InternalCostBase;
  firstInstallmentDelayDays: number[];
  requiresManagerAuthorizationNotice: boolean;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  adminNotes: string;
  durationTerms: DurationTermFormRow[];
};

const emptyTerm = (): DurationTermFormRow => ({
  durationMonths: "",
  minimumAmount: "",
  maximumAmount: "",
  customerTanPercent: "",
  internalCostPercent: "",
});

const emptyForm: TableFormState = {
  companyId: "",
  productId: "",
  network: "PCG",
  tableCode: "",
  displayName: "",
  description: "",
  category: "standard",
  useDurationTerms: false,
  minimumAmount: "",
  maximumAmount: "",
  minimumDurationMonths: "12",
  maximumDurationMonths: "84",
  durationStepMonths: "6",
  customerTanPercent: "0",
  openingFeeType: "none",
  openingFeeValue: "0",
  collectionFeePerInstallment: "0",
  installmentFeeType: "fixed",
  installmentFeeValue: "0",
  internalCostPercentAt24Months: "",
  internalCostBase: "financed_amount",
  firstInstallmentDelayDays: [30],
  requiresManagerAuthorizationNotice: false,
  isActive: true,
  validFrom: "",
  validTo: "",
  adminNotes: "",
  durationTerms: [],
};

function parseOptionalDate(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getTime();
}

function toDateInput(value?: number): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return parseNumber(trimmed);
}

type Mode = "create" | "view" | "newVersion";

export function TableFormPage({ mode }: { mode: Mode }) {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const companies = useQuery(api.financialCompanies.listFinancialCompanies);
  const existing = useQuery(
    api.financialTables.getFinancialTable,
    tableId ? { tableId: tableId as Id<"financialTables"> } : "skip",
  );
  const [form, setForm] = useState<TableFormState>(emptyForm);
  const [initialized, setInitialized] = useState(mode === "create");
  const companyProducts = useQuery(
    api.financialProducts.listProductsByCompany,
    form.companyId
      ? { companyId: form.companyId as Id<"financialCompanies"> }
      : "skip",
  );

  const createTable = useMutation(api.financialTables.createFinancialTable);
  const createVersion = useMutation(api.financialTables.createNewFinancialTableVersion);
  const updateMetadata = useMutation(api.financialTables.updateFinancialTableMetadata);

  useEffect(() => {
    if (mode === "create" || !existing || initialized) return;
    const terms = existing.durationTerms ?? [];
    setForm({
      companyId: existing.companyId,
      productId: existing.productId,
      network: existing.network,
      tableCode: existing.tableCode,
      displayName: existing.displayName,
      description: existing.description ?? "",
      category: existing.category,
      useDurationTerms: terms.length > 0,
      minimumAmount: String(existing.minimumAmount),
      maximumAmount: String(existing.maximumAmount),
      minimumDurationMonths: String(existing.minimumDurationMonths),
      maximumDurationMonths: String(existing.maximumDurationMonths),
      durationStepMonths: String(existing.durationStepMonths),
      customerTanPercent: String(existing.customerTanPercent),
      openingFeeType: existing.openingFeeType,
      openingFeeValue: String(existing.openingFeeValue),
      collectionFeePerInstallment: String(existing.collectionFeePerInstallment),
      installmentFeeType:
        existing.installmentFeeType ??
        (existing.collectionFeePerInstallment > 0 ? "fixed" : "none"),
      installmentFeeValue: String(
        existing.installmentFeeValue ?? existing.collectionFeePerInstallment,
      ),
      internalCostPercentAt24Months:
        existing.internalCostPercentAt24Months !== undefined
          ? String(existing.internalCostPercentAt24Months)
          : "",
      internalCostBase: existing.internalCostBase ?? "financed_amount",
      firstInstallmentDelayDays: existing.firstInstallmentDelayDays,
      requiresManagerAuthorizationNotice:
        existing.requiresManagerAuthorizationNotice,
      isActive: mode === "newVersion" ? true : existing.isActive,
      validFrom: toDateInput(existing.validFrom),
      validTo: toDateInput(existing.validTo),
      adminNotes: existing.adminNotes ?? "",
      durationTerms: terms.map((term) => ({
        durationMonths: String(term.durationMonths),
        minimumAmount: String(term.minimumAmount),
        maximumAmount: String(term.maximumAmount),
        customerTanPercent:
          term.customerTanPercent !== undefined
            ? String(term.customerTanPercent)
            : "",
        internalCostPercent:
          term.internalCostPercent !== undefined
            ? String(term.internalCostPercent)
            : "",
      })),
    });
    setInitialized(true);
  }, [existing, initialized, mode]);

  const durationPreview = useMemo(() => {
    if (form.useDurationTerms) {
      return form.durationTerms
        .map((term) => Number(term.durationMonths))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b);
    }
    return generateDurationMonths(
      Number(form.minimumDurationMonths),
      Number(form.maximumDurationMonths),
      Number(form.durationStepMonths),
    );
  }, [
    form.useDurationTerms,
    form.durationTerms,
    form.minimumDurationMonths,
    form.maximumDurationMonths,
    form.durationStepMonths,
  ]);

  const economicsLocked = mode === "view";

  if (companies === undefined || (mode !== "create" && existing === undefined)) {
    return <LoadingState />;
  }

  if (mode !== "create" && existing === null) {
    return <p className="text-sm text-destructive">Tabella non trovata.</p>;
  }

  const buildPayload = () => {
    const durationTerms = form.useDurationTerms
      ? [...form.durationTerms]
          .map((term) => {
            const mapped: {
              durationMonths: number;
              minimumAmount: number;
              maximumAmount: number;
              customerTanPercent?: number;
              internalCostPercent?: number;
            } = {
              durationMonths: Number(term.durationMonths),
              minimumAmount: parseNumber(term.minimumAmount),
              maximumAmount: parseNumber(term.maximumAmount),
            };
            const tan = parseOptionalNumber(term.customerTanPercent);
            const cost = parseOptionalNumber(term.internalCostPercent);
            if (tan !== undefined) mapped.customerTanPercent = tan;
            if (cost !== undefined) mapped.internalCostPercent = cost;
            return mapped;
          })
          .sort((a, b) => a.durationMonths - b.durationMonths)
      : undefined;

    let minimumAmount = parseNumber(form.minimumAmount);
    let maximumAmount = parseNumber(form.maximumAmount);
    let minimumDurationMonths = Number(form.minimumDurationMonths);
    let maximumDurationMonths = Number(form.maximumDurationMonths);
    let durationStepMonths = Number(form.durationStepMonths);

    if (durationTerms && durationTerms.length > 0) {
      minimumAmount = Math.min(...durationTerms.map((t) => t.minimumAmount));
      maximumAmount = Math.max(...durationTerms.map((t) => t.maximumAmount));
      minimumDurationMonths = Math.min(
        ...durationTerms.map((t) => t.durationMonths),
      );
      maximumDurationMonths = Math.max(
        ...durationTerms.map((t) => t.durationMonths),
      );
      durationStepMonths = 1;
    }

    const customerTanPercent = parseNumber(form.customerTanPercent);
    const openingFeeValue = parseNumber(form.openingFeeValue || "0");
    const collectionFeePerInstallment = parseNumber(
      form.collectionFeePerInstallment || "0",
    );
    const installmentFeeType = form.installmentFeeType;
    const installmentFeeValue =
      installmentFeeType === "none"
        ? 0
        : parseNumber(form.installmentFeeValue || "0");
    const legacyCollection =
      installmentFeeType === "fixed"
        ? installmentFeeValue
        : installmentFeeType === "none"
          ? 0
          : 0;
    const internalCostPercentAt24Months = form.useDurationTerms
      ? undefined
      : parseOptionalNumber(form.internalCostPercentAt24Months);
    const internalCostBase = form.internalCostBase;

    const parsed = financialTableEconomicsSchema.safeParse({
      useDurationTerms: form.useDurationTerms,
      minimumAmount,
      maximumAmount,
      minimumDurationMonths,
      maximumDurationMonths,
      durationStepMonths,
      customerTanPercent,
      openingFeeType: form.openingFeeType,
      openingFeeValue: form.openingFeeType === "none" ? 0 : openingFeeValue,
      collectionFeePerInstallment: legacyCollection || collectionFeePerInstallment,
      installmentFeeType,
      installmentFeeValue,
      internalCostPercentAt24Months,
      firstInstallmentDelayDays: form.firstInstallmentDelayDays,
      durationTerms,
    });

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Dati economici non validi";
      throw new Error(message);
    }

    return {
      companyId: form.companyId as Id<"financialCompanies">,
      productId: form.productId as Id<"financialProducts">,
      network: form.network,
      tableCode: form.tableCode,
      displayName: form.displayName,
      description: form.description || undefined,
      category: form.category,
      minimumAmount,
      maximumAmount,
      minimumDurationMonths,
      maximumDurationMonths,
      durationStepMonths,
      customerTanPercent,
      openingFeeType: form.openingFeeType,
      openingFeeValue: form.openingFeeType === "none" ? 0 : openingFeeValue,
      collectionFeePerInstallment: legacyCollection || collectionFeePerInstallment,
      installmentFeeType,
      installmentFeeValue,
      internalCostPercentAt24Months,
      internalCostBase,
      durationTerms,
      firstInstallmentDelayDays: form.firstInstallmentDelayDays,
      requiresManagerAuthorizationNotice: form.requiresManagerAuthorizationNotice,
      isActive: form.isActive,
      validFrom: parseOptionalDate(form.validFrom),
      validTo: parseOptionalDate(form.validTo),
      adminNotes: form.adminNotes || undefined,
    };
  };

  const saveCreate = async () => {
    if (!userId) return;
    try {
      const id = await createTable({ actorUserId: userId, ...buildPayload() });
      toast.success("Tabella creata");
      navigate(`/admin/tabelle/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio non riuscito");
    }
  };

  const saveVersion = async () => {
    if (!userId || !tableId) return;
    try {
      const id = await createVersion({
        actorUserId: userId,
        sourceTableId: tableId as Id<"financialTables">,
        ...buildPayload(),
      });
      toast.success("Nuova versione creata; versione precedente disattivata");
      navigate(`/admin/tabelle/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Versione non creata");
    }
  };

  const saveMetadata = async () => {
    if (!userId || !tableId) return;
    try {
      await updateMetadata({
        actorUserId: userId,
        tableId: tableId as Id<"financialTables">,
        displayName: form.displayName,
        description: form.description || undefined,
        adminNotes: form.adminNotes || undefined,
        validFrom: parseOptionalDate(form.validFrom),
        validTo: parseOptionalDate(form.validTo),
      });
      toast.success("Metadati aggiornati");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aggiornamento non riuscito");
    }
  };

  const title =
    mode === "create"
      ? "Nuova tabella"
      : mode === "newVersion"
        ? `Nuova versione · ${existing?.displayName ?? ""}`
        : existing?.displayName ?? "Dettaglio tabella";

  const updateTerm = (
    index: number,
    patch: Partial<DurationTermFormRow>,
  ) => {
    setForm((prev) => ({
      ...prev,
      durationTerms: prev.durationTerms.map((term, i) =>
        i === index ? { ...term, ...patch } : term,
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={
          mode === "view"
            ? "In visualizzazione puoi aggiornare solo metadati descrittivi. Per condizioni economiche usa «Nuova versione»."
            : "Compila i campi. Validazione Zod + lato server obbligatoria."
        }
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/tabelle">Torna all&apos;elenco</Link>
          </Button>
        }
      />

      <div className="grid gap-4">
        <Section title="Identificazione">
          <Field label="Società">
            <Select
              disabled={economicsLocked}
              value={form.companyId || undefined}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, companyId: value, productId: "" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company._id} value={company._id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prodotto">
            <Select
              disabled={economicsLocked || !form.companyId}
              value={form.productId || undefined}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, productId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona" />
              </SelectTrigger>
              <SelectContent>
                {(companyProducts ?? []).map((product) => (
                  <SelectItem key={product._id} value={product._id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rete">
            <Select
              disabled={economicsLocked}
              value={form.network}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, network: value as Network }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NETWORKS.map((network) => (
                  <SelectItem key={network} value={network}>
                    {network}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Codice tabella">
            <Input
              disabled={economicsLocked}
              value={form.tableCode}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tableCode: e.target.value }))
              }
            />
          </Field>
          <Field label="Nome visualizzato">
            <Input
              value={form.displayName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, displayName: e.target.value }))
              }
            />
          </Field>
          <Field label="Categoria">
            <Select
              disabled={economicsLocked}
              value={form.category}
              onValueChange={(value) => {
                const category = value as ProductCategory;
                setForm((prev) => ({
                  ...prev,
                  category,
                  requiresManagerAuthorizationNotice:
                    defaultRequiresManagerAuthorization(category),
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {PRODUCT_CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descrizione">
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </Field>
          </div>
        </Section>

        <Section title="Modalità condizioni">
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              disabled={economicsLocked}
              checked={form.useDurationTerms}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  useDurationTerms: Boolean(checked),
                  durationTerms:
                    checked && prev.durationTerms.length === 0
                      ? [emptyTerm()]
                      : prev.durationTerms,
                }))
              }
            />
            Condizioni per singola durata
          </label>
          {form.useDurationTerms ? (
            <p className="text-sm text-amber-800 sm:col-span-2">
              Le condizioni per singola durata prevalgono sui limiti generali
              della tabella.
            </p>
          ) : null}
        </Section>

        {!form.useDurationTerms ? (
          <>
            <Section title="Importi">
              <Field label="Importo minimo (€)">
                <Input
                  disabled={economicsLocked}
                  value={form.minimumAmount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      minimumAmount: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Importo massimo (€)">
                <Input
                  disabled={economicsLocked}
                  value={form.maximumAmount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      maximumAmount: e.target.value,
                    }))
                  }
                />
              </Field>
            </Section>

            <Section title="Durate">
              <Field label="Durata minima (mesi)">
                <Input
                  disabled={economicsLocked}
                  value={form.minimumDurationMonths}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      minimumDurationMonths: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Durata massima (mesi)">
                <Input
                  disabled={economicsLocked}
                  value={form.maximumDurationMonths}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      maximumDurationMonths: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Step durata">
                <Input
                  disabled={economicsLocked}
                  value={form.durationStepMonths}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      durationStepMonths: e.target.value,
                    }))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Preview durate:{" "}
                  {durationPreview.length > 0
                    ? durationPreview.join(", ")
                    : "parametri non validi"}
                </p>
              </div>
            </Section>
          </>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                Condizioni per singola durata
              </CardTitle>
              {!economicsLocked ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      durationTerms: [...prev.durationTerms, emptyTerm()],
                    }))
                  }
                >
                  Aggiungi durata
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-2">Durata</th>
                      <th className="p-2">Importo minimo</th>
                      <th className="p-2">Importo massimo</th>
                      <th className="p-2">TAN</th>
                      <th className="p-2">Costo aziendale %</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.durationTerms.map((term, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">
                          <Input
                            disabled={economicsLocked}
                            value={term.durationMonths}
                            onChange={(e) =>
                              updateTerm(index, {
                                durationMonths: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            disabled={economicsLocked}
                            value={term.minimumAmount}
                            onChange={(e) =>
                              updateTerm(index, {
                                minimumAmount: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            disabled={economicsLocked}
                            value={term.maximumAmount}
                            onChange={(e) =>
                              updateTerm(index, {
                                maximumAmount: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            disabled={economicsLocked}
                            placeholder="opz."
                            value={term.customerTanPercent}
                            onChange={(e) =>
                              updateTerm(index, {
                                customerTanPercent: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            disabled={economicsLocked}
                            placeholder="opz."
                            value={term.internalCostPercent}
                            onChange={(e) =>
                              updateTerm(index, {
                                internalCostPercent: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          {!economicsLocked ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  durationTerms: prev.durationTerms.filter(
                                    (_t, i) => i !== index,
                                  ),
                                }))
                              }
                            >
                              Elimina
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Preview durate:{" "}
                {durationPreview.length > 0
                  ? durationPreview.join(", ")
                  : "nessuna"}
              </p>
            </CardContent>
          </Card>
        )}

        <Section title="Prima rata">
          <div className="sm:col-span-2 space-y-2">
            <Label>Prima rata disponibile (giorni)</Label>
            <div className="flex flex-wrap gap-4">
              {COMMON_FIRST_INSTALLMENT_DELAYS.map((day) => (
                <label key={day} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    disabled={economicsLocked}
                    checked={form.firstInstallmentDelayDays.includes(day)}
                    onCheckedChange={(checked) => {
                      setForm((prev) => ({
                        ...prev,
                        firstInstallmentDelayDays: checked
                          ? [...prev.firstInstallmentDelayDays, day].sort(
                              (a, b) => a - b,
                            )
                          : prev.firstInstallmentDelayDays.filter(
                              (d) => d !== day,
                            ),
                      }));
                    }}
                  />
                  {day} giorni
                </label>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Condizioni paziente">
          <Field label="TAN paziente (%)">
            <Input
              disabled={economicsLocked}
              value={form.customerTanPercent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  customerTanPercent: e.target.value,
                }))
              }
            />
          </Field>
          <Field label="Commissione apertura">
            <Select
              disabled={economicsLocked}
              value={form.openingFeeType}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  openingFeeType: value as OpeningFeeType,
                  openingFeeValue: value === "none" ? "0" : prev.openingFeeValue,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPENING_FEE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {OPENING_FEE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valore commissione">
            <Input
              disabled={economicsLocked || form.openingFeeType === "none"}
              value={form.openingFeeValue}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, openingFeeValue: e.target.value }))
              }
            />
          </Field>
          <Field label="Spesa/commissione per rata">
            <Select
              disabled={economicsLocked}
              value={form.installmentFeeType}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  installmentFeeType: value as InstallmentFeeType,
                  installmentFeeValue:
                    value === "none" ? "0" : prev.installmentFeeValue,
                  collectionFeePerInstallment:
                    value === "none" ? "0" : prev.collectionFeePerInstallment,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTALLMENT_FEE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {INSTALLMENT_FEE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={
              form.installmentFeeType === "percentage_of_requested_amount"
                ? "Valore % importo richiesto/rata"
                : "Valore €/rata"
            }
          >
            <Input
              disabled={
                economicsLocked || form.installmentFeeType === "none"
              }
              value={form.installmentFeeValue}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  installmentFeeValue: e.target.value,
                  collectionFeePerInstallment:
                    prev.installmentFeeType === "fixed"
                      ? e.target.value
                      : prev.collectionFeePerInstallment,
                }))
              }
            />
          </Field>
        </Section>

        <Section title="Condizioni azienda">
          <Field label="Base costo aziendale %">
            <Select
              disabled={economicsLocked}
              value={form.internalCostBase}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  internalCostBase: value as InternalCostBase,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERNAL_COST_BASES.map((base) => (
                  <SelectItem key={base} value={base}>
                    {INTERNAL_COST_BASE_LABELS[base]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!form.useDurationTerms ? (
            <Field label="Costo interno % a 24 mesi">
              <Input
                disabled={economicsLocked}
                value={form.internalCostPercentAt24Months}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    internalCostPercentAt24Months: e.target.value,
                  }))
                }
              />
            </Field>
          ) : (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Con condizioni per durata, il costo aziendale va impostato sul
              singolo termine (valore esatto, senza proporzione da 24 mesi).
            </p>
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              disabled={economicsLocked}
              checked={form.requiresManagerAuthorizationNotice}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  requiresManagerAuthorizationNotice: Boolean(checked),
                }))
              }
            />
            Alert autorizzazione responsabile (informativo)
          </label>
          <div className="sm:col-span-2">
            <Field label="Note admin">
              <Textarea
                value={form.adminNotes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, adminNotes: e.target.value }))
                }
              />
            </Field>
          </div>
        </Section>

        <Section title="Validità">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              disabled={economicsLocked}
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isActive: Boolean(checked) }))
              }
            />
            Attiva
          </label>
          <Field label="Valida da">
            <Input
              type="date"
              value={form.validFrom}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, validFrom: e.target.value }))
              }
            />
          </Field>
          <Field label="Valida a">
            <Input
              type="date"
              value={form.validTo}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, validTo: e.target.value }))
              }
            />
          </Field>
        </Section>
      </div>

      <div className="flex flex-wrap gap-2">
        {mode === "create" ? (
          <Button onClick={() => void saveCreate()}>Salva tabella</Button>
        ) : null}
        {mode === "newVersion" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button>Crea nuova versione</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Creare una nuova versione?</AlertDialogTitle>
                <AlertDialogDescription>
                  La versione precedente verrà disattivata e conservata nello
                  storico. Non verrà cancellata.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={() => void saveVersion()}>
                  Conferma
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        {mode === "view" ? (
          <>
            <Button onClick={() => void saveMetadata()}>
              Salva metadati
            </Button>
            <Button asChild variant="outline">
              <Link to={`/admin/tabelle/${tableId}/nuova-versione`}>
                Nuova versione economica
              </Link>
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
