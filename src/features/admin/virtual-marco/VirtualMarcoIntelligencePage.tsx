import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { formatPercent } from "../../../../shared/admin-analytics";
import {
  VM_TOPICS,
  VM_TOPIC_LABELS,
} from "../../../../shared/virtual-marco-intelligence";

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function VirtualMarcoIntelligencePage() {
  const { userId } = useCurrentUser();
  const [periodDays, setPeriodDays] = useState("30");
  const [network, setNetwork] = useState<"ALL" | "PCG" | "DES" | "Paoleschi">(
    "ALL",
  );
  const [topic, setTopic] = useState("ALL");
  const [issueStatus, setIssueStatus] = useState("ALL");

  const periodRange = useMemo(() => {
    const toMs = Date.now();
    return {
      toMs,
      fromMs: toMs - Number(periodDays) * 24 * 60 * 60 * 1000,
    };
  }, [periodDays]);

  const dashboard = useQuery(
    api.vmIntelligenceAdmin.getVmIntelligenceDashboard,
    userId
      ? {
          actorUserId: userId,
          fromMs: periodRange.fromMs,
          toMs: periodRange.toMs,
          network: network === "ALL" ? undefined : network,
          topic: topic === "ALL" ? undefined : topic,
        }
      : "skip",
  );

  const issues = useQuery(
    api.vmIntelligenceAdmin.listKnowledgeIssuesAdmin,
    userId
      ? {
          actorUserId: userId,
          fromMs: periodRange.fromMs,
          toMs: periodRange.toMs,
          network: network === "ALL" ? undefined : network,
          topic: topic === "ALL" ? undefined : topic,
          status:
            issueStatus === "ALL"
              ? undefined
              : (issueStatus as
                  | "NEW"
                  | "REVIEWING"
                  | "CONFIRMED_GAP"
                  | "CONTENT_ERROR"
                  | "NOT_A_GAP"
                  | "RESOLVED"),
        }
      : "skip",
  );

  const backfill = useMutation(api.vmIntelligenceAdmin.backfillAssistantAnalytics);
  const [backfilling, setBackfilling] = useState(false);

  if (!userId || dashboard === undefined || issues === undefined) {
    return <LoadingState />;
  }

  const { kpis } = dashboard;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Virtual Marco Intelligence"
        description="Segnali aggregati su temi, coverage e candidati gap. La conferma spetta all’Admin."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/virtual-marco/conoscenza">Apri KB</Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={backfilling}
              onClick={async () => {
                setBackfilling(true);
                try {
                  const result = await backfill({
                    actorUserId: userId,
                    limit: 800,
                  });
                  toast.success(
                    `Backfill: ${result.created} nuovi, ${result.skipped} già presenti`,
                  );
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Backfill non riuscito",
                  );
                } finally {
                  setBackfilling(false);
                }
              }}
            >
              {backfilling ? "Backfill…" : "Backfill storico"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select value={periodDays} onValueChange={setPeriodDays}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 giorni</SelectItem>
            <SelectItem value="30">30 giorni</SelectItem>
            <SelectItem value="90">90 giorni</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={network}
          onValueChange={(value) => setNetwork(value as typeof network)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutte le reti</SelectItem>
            <SelectItem value="PCG">PCG</SelectItem>
            <SelectItem value="DES">DES</SelectItem>
            <SelectItem value="Paoleschi">Paoleschi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={topic} onValueChange={setTopic}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Topic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutti i topic</SelectItem>
            {VM_TOPICS.map((code) => (
              <SelectItem key={code} value={code}>
                {VM_TOPIC_LABELS[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dashboard.empty ? (
        <EmptyState
          title="Nessuna interazione nel periodo"
          description="Esegui un backfill storico o attendi nuove chat CM."
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="1. Domande a Virtual Marco" value={String(kpis.questions)} />
        <Kpi label="2. Utenti unici" value={String(kpis.uniqueUsers)} />
        <Kpi
          label="3. Knowledge coverage %"
          value={formatPercent(kpis.knowledgeCoverageRate)}
          hint="FULL / knowledge-seeking (PARTIAL non usato)"
        />
        <Kpi
          label="4. Candidate knowledge issues"
          value={String(kpis.candidateIssues)}
        />
        <Kpi
          label="5. Feedback negativi"
          value={String(kpis.negativeFeedbacks)}
        />
        <Kpi
          label="6. Issue aperte confermate"
          value={String(kpis.confirmedOpenIssues)}
          hint="CONFIRMED_GAP + CONTENT_ERROR"
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">A. Cosa chiedono a Virtual Marco?</h2>
        {dashboard.topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun tema.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Topic</th>
                  <th className="px-3 py-2">Domande</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2">Utenti</th>
                  <th className="px-3 py-2">Cliniche</th>
                  <th className="px-3 py-2">Coverage</th>
                  <th className="px-3 py-2">Issue %</th>
                  <th className="px-3 py-2">Feedback −</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.topics.map((row) => (
                  <tr key={row.topic} className="border-b last:border-0">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 tabular-nums">{row.questions}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatPercent(row.percent)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.uniqueUsers}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.uniqueClinics}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatPercent(row.coverageRate)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatPercent(row.issueRate)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatPercent(row.negativeFeedbackRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">B. Knowledge coverage</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">
            FULL: {dashboard.coverageBreakdown.FULL}
          </Badge>
          <Badge variant="warning">
            NONE: {dashboard.coverageBreakdown.NONE}
          </Badge>
          <Badge variant="outline">
            N/A: {dashboard.coverageBreakdown.NOT_APPLICABLE}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Matrice descrittiva: {dashboard.matrixHints.highQuestionsLowCoverage}{" "}
          · {dashboard.matrixHints.highQuestionsHighCoverage} ·{" "}
          {dashboard.matrixHints.highIncorrectFeedback}
        </p>
        {dashboard.companies.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Company id</th>
                  <th className="px-3 py-2">Domande</th>
                  <th className="px-3 py-2">Topic principali</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.companies.map((row) => (
                  <tr key={row.companyCode} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.companyCode.slice(0, 12)}…
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.questions}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.topTopics
                        .map(
                          (item) =>
                            `${item.label} ${formatPercent(item.percent)}`,
                        )
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nessuna company citata nel periodo.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">C. Knowledge Issues</h2>
          <Select value={issueStatus} onValueChange={setIssueStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutti gli stati</SelectItem>
              <SelectItem value="NEW">NEW</SelectItem>
              <SelectItem value="REVIEWING">REVIEWING</SelectItem>
              <SelectItem value="CONFIRMED_GAP">CONFIRMED_GAP</SelectItem>
              <SelectItem value="CONTENT_ERROR">CONTENT_ERROR</SelectItem>
              <SelectItem value="NOT_A_GAP">NOT_A_GAP</SelectItem>
              <SelectItem value="RESOLVED">RESOLVED</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Candidati automatici / da feedback. Possibili errori contenuto:{" "}
          {dashboard.contentBugCandidates}
        </p>
        {issues.length === 0 ? (
          <EmptyState
            title="Nessuna issue"
            description="Nessun candidato nel periodo/filtri."
          />
        ) : (
          <div className="space-y-2">
            {issues.slice(0, 40).map((issue) => (
              <div
                key={issue._id}
                className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{issue.topicLabel}</span>
                    <Badge variant="outline">{issue.status}</Badge>
                    <Badge variant="secondary">{issue.detectedBy}</Badge>
                    {issue.network ? (
                      <Badge variant="outline">{issue.network}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {issue.primaryReasonCode} ·{" "}
                    {new Date(issue.createdAt).toLocaleString("it-IT")}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to={`/admin/virtual-marco/intelligence/issues/${issue._id}`}
                  >
                    Apri
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">D. Segnali formativi</h2>
        <p className="text-xs text-muted-foreground">
          Soglie: ≥{dashboard.trainingThresholds.minimumQuestions} domande, ≥
          {dashboard.trainingThresholds.minimumUniqueUsers} utenti, coverage ≥
          {Math.round(dashboard.trainingThresholds.minimumCoverageRate * 100)}%,
          gap ≤
          {Math.round(
            dashboard.trainingThresholds.maximumKnowledgeGapRate * 100,
          )}
          %. Non è una diagnosi di formazione necessaria.
        </p>
        {dashboard.trainingSignals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun segnale formativo nel periodo.
          </p>
        ) : (
          <div className="space-y-2">
            {dashboard.trainingSignals.map((row) => (
              <div key={row.topic} className="rounded-md border px-3 py-2">
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">
                  Tema frequentemente richiesto nonostante la presenza di
                  conoscenza strutturata. · {row.questions} domande ·{" "}
                  {row.uniqueUsers} utenti · coverage{" "}
                  {formatPercent(row.coverageRate)} · issue{" "}
                  {formatPercent(row.issueRate)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
