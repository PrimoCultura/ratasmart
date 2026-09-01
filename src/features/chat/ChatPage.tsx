import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { MessageSquarePlus, Send, Shield, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { cn } from "@/lib/utils";

const WELCOME =
  "Sono Virtual Marco.\n\nPosso aiutarti a comprendere policy, procedure e risultati delle simulazioni.\nNon effettuo calcoli autonomi e non sostituisco la decisione della finanziaria.";

function outcomeBadge(outcome?: string, requiresVerification?: boolean) {
  if (outcome === "needs_information") return "Servono altre informazioni";
  if (outcome === "not_covered") return "Informazione non coperta";
  if (outcome === "requires_verification" || requiresVerification) {
    return "Verifica richiesta";
  }
  if (outcome === "answered") return "Risposta dalle fonti aziendali";
  return null;
}

function verificationLabel(target?: string) {
  if (target === "area_manager") return "Verifica con il responsabile";
  if (target === "financial_company") return "Verifica con la finanziaria";
  if (target === "both") return "Verifica con responsabile e finanziaria";
  return null;
}

export function ChatPage() {
  const { userId } = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get("c") as Id<"assistantConversations"> | null;

  const conversations = useQuery(
    api.assistantConversations.listMyAssistantConversations,
    userId ? { currentUserId: userId } : "skip",
  );
  const conversation = useQuery(
    api.assistantConversations.getAssistantConversation,
    userId && selectedId
      ? { currentUserId: userId, conversationId: selectedId }
      : "skip",
  );
  const messages = useQuery(
    api.assistantConversations.listAssistantMessages,
    userId && selectedId
      ? { currentUserId: userId, conversationId: selectedId }
      : "skip",
  );

  const createConversation = useMutation(
    api.assistantConversations.createAssistantConversation,
  );
  const updatePrivacy = useMutation(
    api.assistantConversations.updateAssistantConversationPrivacyMode,
  );
  const sendMessage = useAction(api.assistantChat.sendVirtualMarcoMessage);

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [privacyConfirmOpen, setPrivacyConfirmOpen] = useState(false);

  const activeConversations = useMemo(
    () => (conversations ?? []).filter((item) => item.status === "active"),
    [conversations],
  );

  const handleNew = async () => {
    if (!userId) return;
    try {
      const id = await createConversation({
        currentUserId: userId,
        privacyMode: "patient_safe",
      });
      navigate(`/app/chat?c=${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore creazione");
    }
  };

  const handlePrivacyChange = async (mode: "patient_safe" | "internal") => {
    if (!userId || !selectedId) return;
    if (mode === "internal") {
      setPrivacyConfirmOpen(true);
      return;
    }
    await updatePrivacy({
      currentUserId: userId,
      conversationId: selectedId,
      privacyMode: "patient_safe",
    });
  };

  const confirmInternal = async () => {
    if (!userId || !selectedId) return;
    await updatePrivacy({
      currentUserId: userId,
      conversationId: selectedId,
      privacyMode: "internal",
    });
    setPrivacyConfirmOpen(false);
  };

  const handleSend = async () => {
    if (!userId || !selectedId || !draft.trim() || isSending) return;
    const requestId = crypto.randomUUID();
    const content = draft.trim();
    setDraft("");
    setIsSending(true);
    try {
      const result = await sendMessage({
        currentUserId: userId,
        conversationId: selectedId,
        message: content,
        requestId,
      });
      if (result.status === "failed") {
        toast.error(result.userFacingError ?? "Risposta non completata");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Virtual Marco non è riuscito a completare la risposta.",
      );
    } finally {
      setIsSending(false);
    }
  };

  if (!userId || conversations === undefined) {
    return <LoadingState />;
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <PageHeader
        title="Virtual Marco"
        description="Assistente interno basato su knowledge base e risultati delle simulazioni."
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="flex min-h-0 flex-col rounded-lg border border-border bg-card">
          <div className="border-b border-border p-3">
            <Button className="w-full" size="sm" onClick={() => void handleNew()}>
              <MessageSquarePlus className="h-4 w-4" />
              Nuova conversazione
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {activeConversations.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">
                Nessuna conversazione.
              </p>
            ) : (
              activeConversations.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => navigate(`/app/chat?c=${item._id}`)}
                  className={cn(
                    "mb-1 w-full rounded-md px-2 py-2 text-left text-sm",
                    selectedId === item._id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <div className="line-clamp-2 font-medium">{item.title}</div>
                  <div
                    className={cn(
                      "mt-1 text-[11px]",
                      selectedId === item._id
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.privacyMode === "internal"
                      ? "Modalità interna"
                      : "Patient safe"}
                    {item.simulationId ? " · Simulazione" : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          {!selectedId ? (
            <EmptyState
              title="Seleziona o crea una conversazione"
              description="Puoi anche aprire Virtual Marco da una simulazione con “Chiedi a Virtual Marco”."
            />
          ) : conversation === undefined || messages === undefined ? (
            <LoadingState />
          ) : !conversation ? (
            <EmptyState title="Conversazione non trovata" />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">{conversation.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {conversation.simulation
                      ? `Simulazione ${conversation.simulation.network}${
                          conversation.simulation.requestedAmount
                            ? ` · €${conversation.simulation.requestedAmount}`
                            : ""
                        }`
                      : "Conversazione generale"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={
                      conversation.privacyMode === "patient_safe"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => void handlePrivacyChange("patient_safe")}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Patient safe
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      conversation.privacyMode === "internal"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => void handlePrivacyChange("internal")}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Interna
                  </Button>
                </div>
              </div>

              {privacyConfirmOpen ? (
                <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-medium">Modalità riservata al personale.</p>
                  <p className="mt-1">
                    Verifica che il paziente non possa vedere lo schermo prima di
                    mostrare costi aziendali, priorità, alert interni o altre
                    informazioni riservate.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => void confirmInternal()}>
                      Confermo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPrivacyConfirmOpen(false)}
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <div className="max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
                  {WELCOME}
                </div>
                {messages.map((message) => {
                  const badge = outcomeBadge(
                    message.outcome,
                    message.requiresVerification,
                  );
                  const verification = verificationLabel(
                    message.verificationTarget,
                  );
                  return (
                    <div
                      key={message._id}
                      className={cn(
                        "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                        message.role === "user"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {message.status === "pending" ? (
                        <span className="text-muted-foreground">
                          Virtual Marco sta elaborando…
                        </span>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}
                      {message.role === "assistant" &&
                      message.status === "completed" ? (
                        <div className="mt-2 space-y-1 text-xs opacity-90">
                          {badge ? (
                            <div className="font-medium">{badge}</div>
                          ) : null}
                          {verification ? <div>{verification}</div> : null}
                          {message.alerts && message.alerts.length > 0 ? (
                            <ul className="list-disc pl-4">
                              {message.alerts.map((alert) => (
                                <li key={alert}>{alert}</li>
                              ))}
                            </ul>
                          ) : null}
                          {message.missingInformation &&
                          message.missingInformation.length > 0 ? (
                            <div>
                              Dati mancanti:{" "}
                              {message.missingInformation.join(", ")}
                            </div>
                          ) : null}
                          {message.sources && message.sources.length > 0 ? (
                            <details className="mt-2">
                              <summary className="cursor-pointer font-medium">
                                Contesto aziendale consultato
                              </summary>
                              <p className="mt-1 text-[11px]">
                                Contesto fornito a Virtual Marco (non implica che
                                ogni scheda sia stata usata nella risposta).
                              </p>
                              <ul className="mt-1 space-y-1">
                                {message.sources.map((source) => (
                                  <li key={source.knowledgeCardId}>
                                    {source.titleSnapshot} ·{" "}
                                    {source.categorySnapshot}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Non inserire nomi, codici fiscali, IBAN, numeri di documenti o
                  informazioni sanitarie.
                </p>
                <div className="flex gap-2">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Scrivi un messaggio a Virtual Marco…"
                    className="min-h-[72px] resize-none"
                    disabled={isSending}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button
                    className="shrink-0 self-end"
                    onClick={() => void handleSend()}
                    disabled={isSending || !draft.trim()}
                  >
                    <Send />
                    Invia
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Helper usable from simulation pages */
export function AskVirtualMarcoButton({
  simulationId,
  comparisonRunId,
}: {
  simulationId: Id<"simulations">;
  comparisonRunId?: Id<"simulationComparisonRuns">;
}) {
  const { userId } = useCurrentUser();
  const navigate = useNavigate();
  const createConversation = useMutation(
    api.assistantConversations.createAssistantConversation,
  );
  const existing = useQuery(
    api.assistantConversations.findConversationForSimulation,
    userId
      ? {
          currentUserId: userId,
          simulationId,
          comparisonRunId,
        }
      : "skip",
  );

  const open = async () => {
    if (!userId) return;
    try {
      const id =
        existing?._id ??
        (await createConversation({
          currentUserId: userId,
          simulationId,
          comparisonRunId,
          title: "Simulazione collegata",
          privacyMode: "patient_safe",
        }));
      navigate(`/app/chat?c=${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={() => void open()}>
      Chiedi a Virtual Marco
    </Button>
  );
}
