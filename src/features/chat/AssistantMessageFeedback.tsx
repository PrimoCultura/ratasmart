import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { cn } from "@/lib/utils";

type FeedbackType =
  | "HELPFUL"
  | "NOT_HELPFUL"
  | "INCORRECT_INFORMATION"
  | "MISSING_INFORMATION";

const OPTIONS: Array<{ type: FeedbackType; label: string }> = [
  { type: "HELPFUL", label: "Utile" },
  { type: "NOT_HELPFUL", label: "Non utile" },
  { type: "INCORRECT_INFORMATION", label: "Informazione errata" },
  { type: "MISSING_INFORMATION", label: "Informazione mancante" },
];

export function AssistantMessageFeedback({
  assistantMessageId,
  currentFeedback,
}: {
  assistantMessageId: Id<"assistantMessages">;
  currentFeedback?: FeedbackType | null;
}) {
  const { userId } = useCurrentUser();
  const upsert = useMutation(api.assistantFeedback.upsertAssistantFeedback);
  const [selected, setSelected] = useState<FeedbackType | null>(
    currentFeedback ?? null,
  );
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const needsComment = useMemo(
    () =>
      selected !== null &&
      selected !== "HELPFUL",
    [selected],
  );

  if (!userId) return null;

  const submit = async (type: FeedbackType, withComment?: string) => {
    setSaving(true);
    try {
      await upsert({
        actorUserId: userId,
        assistantMessageId,
        feedbackType: type,
        comment: withComment,
      });
      setSelected(type);
      toast.success("Feedback registrato");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Feedback non inviato",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 border-t border-border/60 pt-2">
      <p className="mb-1 text-[11px] text-muted-foreground">
        Questa risposta ti è stata utile?
      </p>
      <div className="flex flex-wrap gap-1">
        {OPTIONS.map((option) => (
          <Button
            key={option.type}
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            className={cn(
              "h-7 px-2 text-[11px]",
              selected === option.type && "border-primary bg-primary/10",
            )}
            onClick={() => {
              if (option.type === "HELPFUL") {
                setComment("");
                void submit("HELPFUL");
                return;
              }
              setSelected(option.type);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {needsComment ? (
        <div className="mt-2 space-y-1">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Commento opzionale…"
            className="min-h-[56px] text-xs"
            disabled={saving}
          />
          <Button
            type="button"
            size="sm"
            className="h-7 text-[11px]"
            disabled={saving || !selected || selected === "HELPFUL"}
            onClick={() => {
              if (!selected || selected === "HELPFUL") return;
              void submit(selected, comment.trim() || undefined);
            }}
          >
            Invia feedback
          </Button>
        </div>
      ) : null}
    </div>
  );
}
