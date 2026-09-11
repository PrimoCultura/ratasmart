import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ActiveBadge } from "@/components/common/ActiveBadge";
import { EmptyState } from "@/components/common/EmptyState";
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
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  POLICY_OPERATORS,
  POLICY_OPERATOR_LABELS,
  POLICY_RULE_TYPES,
  POLICY_RULE_TYPE_LABELS,
  type PolicyOperator,
  type PolicyRuleType,
} from "@/lib/constants/financial";

export function PolicyDetailPage() {
  const { policySetId } = useParams<{ policySetId: string }>();
  const navigate = useNavigate();
  const { userId } = useCurrentUser();
  const detail = useQuery(
    api.policies.getPolicySetWithRules,
    policySetId ? { policySetId: policySetId as Id<"policySets"> } : "skip",
  );
  const addRule = useMutation(api.policies.addPolicyRule);
  const updateRule = useMutation(api.policies.updatePolicyRule);
  const deleteRule = useMutation(api.policies.deletePolicyRule);
  const createVersion = useMutation(api.policies.createNewPolicySetVersion);

  const [form, setForm] = useState({
    ruleType: "minimum_age" as PolicyRuleType,
    operator: "greater_than_or_equal" as PolicyOperator,
    numericValue: "",
    stringValue: "",
    booleanValue: true,
    stringValues: [] as string[],
    monthsBuffer: "",
    failureMessage: "",
    verificationMessage: "",
    adminNotes: "",
    isActive: true,
  });

  const valueFields = useMemo(() => {
    switch (form.ruleType) {
      case "employment_type_allowed":
      case "guarantor_required_for_employment_types":
        return "employment";
      case "maximum_amount_for_employment_types":
        return "employment_numeric";
      case "pensioner_allowed":
      case "non_eu_allowed":
      case "renewal_receipt_allowed":
        return "boolean";
      case "temporary_contract_expiry":
      case "residence_permit_expiry":
        return "months";
      case "custom":
        return "custom";
      default:
        return "numeric";
    }
  }, [form.ruleType]);

  if (detail === undefined) {
    return <LoadingState />;
  }

  if (detail === null) {
    return <p className="text-sm text-destructive">Policy non trovata.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.name}
        description={`${detail.network} · ${detail.company?.name ?? "—"} · v${detail.version}`}
        actions={
          <>
            <ActiveBadge active={detail.isActive} />
            <Button asChild variant="outline">
              <Link to="/admin/policy">Torna alle policy</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!userId) return;
                void createVersion({
                  actorUserId: userId,
                  sourcePolicySetId: detail._id,
                  companyId: detail.companyId,
                  productId: detail.productId,
                  financialTableId: detail.financialTableId,
                  network: detail.network,
                  name: detail.name,
                  description: detail.description,
                  sourceReference: detail.sourceReference,
                  isActive: true,
                  validFrom: detail.validFrom,
                  validTo: detail.validTo,
                  copyRules: true,
                })
                  .then((id) => {
                    toast.success("Nuova versione policy creata");
                    navigate(`/admin/policy/${id}`);
                  })
                  .catch((error: unknown) =>
                    toast.error(
                      error instanceof Error ? error.message : "Versione non creata",
                    ),
                  );
              }}
            >
              Nuova versione
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Aggiungi regola</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo regola</Label>
            <Select
              value={form.ruleType}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  ruleType: value as PolicyRuleType,
                  stringValues: [],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_RULE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {POLICY_RULE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Operatore</Label>
            <Select
              value={form.operator}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  operator: value as PolicyOperator,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPERATORS.map((operator) => (
                  <SelectItem key={operator} value={operator}>
                    {POLICY_OPERATOR_LABELS[operator]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {valueFields === "numeric" || valueFields === "employment_numeric" ? (
            <div className="space-y-2">
              <Label>Valore numerico</Label>
              <Input
                value={form.numericValue}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, numericValue: e.target.value }))
                }
              />
            </div>
          ) : null}

          {valueFields === "boolean" ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.booleanValue}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, booleanValue: checked }))
                }
              />
              Valore booleano vero
            </label>
          ) : null}

          {valueFields === "months" ? (
            <div className="space-y-2">
              <Label>Buffer mesi</Label>
              <Input
                value={form.monthsBuffer}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, monthsBuffer: e.target.value }))
                }
              />
            </div>
          ) : null}

          {valueFields === "employment" ||
          valueFields === "employment_numeric" ? (
            <div className="sm:col-span-2 space-y-2">
              <Label>Tipologie di lavoro</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {EMPLOYMENT_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.stringValues.includes(type)}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          stringValues: checked
                            ? [...prev.stringValues, type]
                            : prev.stringValues.filter((item) => item !== type),
                        }))
                      }
                    />
                    {EMPLOYMENT_TYPE_LABELS[type]}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {valueFields === "custom" ? (
            <div className="sm:col-span-2 space-y-2">
              <Label>Testo regola</Label>
              <Textarea
                value={form.stringValue}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, stringValue: e.target.value }))
                }
              />
            </div>
          ) : null}

          <div className="sm:col-span-2 space-y-2">
            <Label>Messaggio di non compatibilità</Label>
            <Input
              value={form.failureMessage}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, failureMessage: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Messaggio di verifica</Label>
            <Input
              value={form.verificationMessage}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  verificationMessage: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Note admin</Label>
            <Input
              value={form.adminNotes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, adminNotes: e.target.value }))
              }
            />
          </div>
          <div>
            <Button
              onClick={() => {
                if (!userId || !policySetId) return;
                void addRule({
                  actorUserId: userId,
                  policySetId: policySetId as Id<"policySets">,
                  ruleType: form.ruleType,
                  operator: form.operator,
                  numericValue: form.numericValue
                    ? Number(form.numericValue.replace(",", "."))
                    : undefined,
                  stringValue: form.stringValue || undefined,
                  booleanValue:
                    valueFields === "boolean" ? form.booleanValue : undefined,
                  stringValues:
                    valueFields === "employment" ? form.stringValues : undefined,
                  monthsBuffer: form.monthsBuffer
                    ? Number(form.monthsBuffer)
                    : undefined,
                  failureMessage: form.failureMessage,
                  verificationMessage: form.verificationMessage || undefined,
                  adminNotes: form.adminNotes || undefined,
                  isActive: form.isActive,
                })
                  .then(() => {
                    toast.success("Regola aggiunta");
                    setForm((prev) => ({
                      ...prev,
                      numericValue: "",
                      stringValue: "",
                      stringValues: [],
                      monthsBuffer: "",
                      failureMessage: "",
                      verificationMessage: "",
                      adminNotes: "",
                    }));
                  })
                  .catch((error: unknown) =>
                    toast.error(
                      error instanceof Error ? error.message : "Regola non aggiunta",
                    ),
                  );
              }}
            >
              Aggiungi regola
            </Button>
          </div>
        </CardContent>
      </Card>

      {detail.rules.length === 0 ? (
        <EmptyState
          title="Nessuna regola"
          description="Aggiungi regole strutturate. La valutazione automatica arriverà più avanti."
        />
      ) : (
        <div className="space-y-2">
          {detail.rules.map((rule) => (
            <div
              key={rule._id}
              className="rounded-md border border-border bg-card px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    #{rule.sortOrder} · {POLICY_RULE_TYPE_LABELS[rule.ruleType]} ·{" "}
                    {POLICY_OPERATOR_LABELS[rule.operator]}
                  </p>
                  <p className="text-xs text-muted-foreground">{rule.failureMessage}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!userId) return;
                      void updateRule({
                        actorUserId: userId,
                        ruleId: rule._id,
                        ruleType: rule.ruleType,
                        operator: rule.operator,
                        numericValue: rule.numericValue,
                        stringValue: rule.stringValue,
                        booleanValue: rule.booleanValue,
                        stringValues: rule.stringValues,
                        monthsBuffer: rule.monthsBuffer,
                        failureMessage: rule.failureMessage,
                        verificationMessage: rule.verificationMessage,
                        adminNotes: rule.adminNotes,
                        sortOrder: rule.sortOrder,
                        isActive: !rule.isActive,
                      })
                        .then(() => toast.success("Regola aggiornata"))
                        .catch((error: unknown) =>
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Aggiornamento non riuscito",
                          ),
                        );
                    }}
                  >
                    {rule.isActive ? "Disattiva" : "Attiva"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!userId) return;
                      void deleteRule({ actorUserId: userId, ruleId: rule._id })
                        .then(() => toast.success("Regola eliminata"))
                        .catch((error: unknown) =>
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Eliminazione non riuscita",
                          ),
                        );
                    }}
                  >
                    Elimina
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
