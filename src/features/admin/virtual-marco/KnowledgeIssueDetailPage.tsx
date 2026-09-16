import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { formatDateTime } from "@/lib/formatting/currency";

type IssueStatus =
  | "NEW"
  | "REVIEWING"
  | "CONFIRMED_GAP"
  | "CONTENT_ERROR"
  | "NOT_A_GAP"
  | "RESOLVED";

export function KnowledgeIssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const { userId } = useCurrentUser();
  const detail = useQuery(
    api.vmIntelligenceAdmin.getKnowledgeIssueDetail,
    userId && issueId
      ? {
          actorUserId: userId,
          issueId: issueId as Id<"knowledgeIssues">,
        }
      : "skip",
  );
  const updateStatus = useMutation(
    api.vmIntelligenceAdmin.updateKnowledgeIssueStatus,
  );
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<IssueStatus | "">("");
  const [saving, setSaving] = useState(false);

  if (detail === undefined) return <LoadingState />;
  if (detail === null) {
    return (
      <ErrorState
        title="Issue non trovata"
        message="L’issue richiesta non esiste o non è più disponibile."
      />
    );
  }

  const { issue } = detail;
  const currentStatus = status || issue.status;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Issue · ${issue.topicLabel}`}
        description="Verifica operativa. Domanda/risposta da messaggi originali (non duplicati)."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/virtual-marco/intelligence">Torna a Intelligence</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{issue.status}</Badge>
        <Badge variant="secondary">{issue.detectedBy}</Badge>
        <Badge variant="outline">{issue.primaryReasonCode}</Badge>
        {issue.network ? <Badge variant="outline">{issue.network}</Badge> : null}
      </div>

      <section className="space-y-2 rounded-md border p-3">
        <h2 className="text-sm font-semibold">Domanda CM</h2>
        <p className="whitespace-pre-wrap text-sm">
          {detail.userMessage?.content ?? "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          {detail.userMessage
            ? formatDateTime(detail.userMessage.createdAt)
            : ""}
        </p>
      </section>

      <section className="space-y-2 rounded-md border p-3">
        <h2 className="text-sm font-semibold">Risposta Virtual Marco</h2>
        <p className="whitespace-pre-wrap text-sm">
          {detail.assistantMessage?.content ?? "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          Outcome: {detail.assistantMessage?.outcome ?? "n/d"}
        </p>
      </section>

      <section className="space-y-2 rounded-md border p-3">
        <h2 className="text-sm font-semibold">Fonti</h2>
        {detail.sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna fonte KB.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detail.sources.map((source) => (
              <li key={source.knowledgeCardId}>
                {source.titleSnapshot} · {source.categorySnapshot}
                <Button asChild variant="link" className="h-auto px-2 text-xs">
                  <Link
                    to={`/admin/virtual-marco/conoscenza/${source.knowledgeCardId}`}
                  >
                    Apri scheda KB
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-md border p-3">
        <h2 className="text-sm font-semibold">Feedback utente</h2>
        {detail.feedbacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun feedback.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detail.feedbacks.map((item, index) => (
              <li key={`${item.userId}-${index}`}>
                {item.feedbackType}
                {item.comment ? ` — ${item.comment}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-md border p-3">
        <h2 className="text-sm font-semibold">Azioni Admin</h2>
        <Select
          value={currentStatus}
          onValueChange={(value) => setStatus(value as IssueStatus)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="REVIEWING">Prendi in carico</SelectItem>
            <SelectItem value="CONFIRMED_GAP">Conferma knowledge gap</SelectItem>
            <SelectItem value="CONTENT_ERROR">Segna errore contenuto</SelectItem>
            <SelectItem value="NOT_A_GAP">Segna come non gap</SelectItem>
            <SelectItem value="RESOLVED">Risolvi</SelectItem>
            <SelectItem value="NEW">NEW</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          value={notes || issue.adminNotes || ""}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Note admin…"
          rows={3}
        />
        <Button
          disabled={saving || !userId}
          onClick={async () => {
            if (!userId) return;
            setSaving(true);
            try {
              await updateStatus({
                actorUserId: userId,
                issueId: issue._id,
                status: currentStatus as IssueStatus,
                adminNotes: notes || issue.adminNotes,
              });
              toast.success("Issue aggiornata");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Aggiornamento fallito",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          Salva
        </Button>
        {issue.linkedKnowledgeCardId ? (
          <Button asChild variant="outline" size="sm">
            <Link
              to={`/admin/virtual-marco/conoscenza/${issue.linkedKnowledgeCardId}`}
            >
              Apri scheda KB collegata
            </Link>
          </Button>
        ) : null}
      </section>
    </div>
  );
}
