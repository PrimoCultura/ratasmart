import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { formatDateTime } from "@/lib/formatting/currency";

export function AssistantConversationsAdminPage() {
  const { userId } = useCurrentUser();
  const [gapOnly, setGapOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<
    Id<"assistantConversations"> | null
  >(null);

  const rows = useQuery(
    api.assistantConversations.listAssistantConversationsAdmin,
    userId
      ? { actorUserId: userId, knowledgeGapOnly: gapOnly }
      : "skip",
  );
  const detail = useQuery(
    api.assistantConversations.getAssistantConversationAdmin,
    userId && selectedId
      ? { actorUserId: userId, conversationId: selectedId }
      : "skip",
  );

  const selected = useMemo(
    () => rows?.find((row) => row._id === selectedId) ?? null,
    [rows, selectedId],
  );

  if (!userId || rows === undefined) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversazioni Virtual Marco"
        description="Consultazione sola lettura. Nessuna modifica a messaggi o risposte."
      />

      <div className="flex items-center gap-2">
        <Checkbox
          id="gap"
          checked={gapOnly}
          onCheckedChange={(checked) => setGapOnly(Boolean(checked))}
        />
        <Label htmlFor="gap">Possibili gap di conoscenza</Label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Elenco</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.length === 0 ? (
              <EmptyState title="Nessuna conversazione" />
            ) : (
              rows.map((row) => (
                <button
                  key={row._id}
                  type="button"
                  className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => setSelectedId(row._id)}
                >
                  <div className="font-medium">{row.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.ownerDisplayName}
                    {row.clinicName ? ` · ${row.clinicName}` : ""} ·{" "}
                    {row.privacyMode} · {row.messageCount} msg ·{" "}
                    {formatDateTime(row.lastMessageAt)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.lastModel ?? "—"} · token {row.lastTotalTokens ?? "—"} ·{" "}
                    {row.lastStatus ?? "—"}
                    {row.hasKnowledgeGap ? " · gap" : ""}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Dettaglio {selected ? `· ${selected.title}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedId ? (
              <EmptyState title="Seleziona una conversazione" />
            ) : detail === undefined ? (
              <LoadingState />
            ) : !detail ? (
              <EmptyState title="Non trovata" />
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  CM: {detail.conversation.ownerDisplayName}
                  {detail.conversation.clinicName
                    ? ` · ${detail.conversation.clinicName}`
                    : ""}
                  {detail.conversation.simulationId ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link
                        className="underline"
                        to={`/admin/simulazioni/${detail.conversation.simulationId}`}
                      >
                        Simulazione
                      </Link>
                    </>
                  ) : null}
                </p>
                {detail.messages.map((message) => (
                  <div
                    key={message._id}
                    className="rounded-md border border-border p-3 text-sm"
                  >
                    <div className="text-xs text-muted-foreground">
                      {message.role} · {message.status} ·{" "}
                      {formatDateTime(message.createdAt)}
                      {message.outcome ? ` · ${message.outcome}` : ""}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">
                      {message.content || "(vuoto)"}
                    </div>
                    {message.role === "assistant" ? (
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <div>
                          Config v{message.assistantConfigVersion ?? "—"} ·{" "}
                          {message.provider}/{message.model} · token{" "}
                          {message.totalTokens ?? "—"}
                        </div>
                        {message.errorCode ? (
                          <div>
                            Errore: {message.errorCode} – {message.errorMessage}
                          </div>
                        ) : null}
                        {message.alerts && message.alerts.length > 0 ? (
                          <div>Alert: {message.alerts.join("; ")}</div>
                        ) : null}
                        {message.sources.length > 0 ? (
                          <div>
                            Schede fornite:
                            <ul className="list-disc pl-4">
                              {message.sources.map((source) => (
                                <li key={source._id}>
                                  {source.titleSnapshot} (score {source.score}) –{" "}
                                  {source.matchReasons.join(", ")}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/virtual-marco">Torna a Virtual Marco</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
