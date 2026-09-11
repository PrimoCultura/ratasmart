import type { Id } from "../../../../convex/_generated/dataModel";
import {
  CompactSolutionCard,
  type CompactCardTone,
} from "./CompactSolutionCard";
import type { ComparisonSolution } from "./solutionDisplay";

type ComparisonSectionProps = {
  title: string;
  description?: string;
  empty: string;
  solutions: ComparisonSolution[];
  tone?: CompactCardTone;
  grid?: boolean;
  headingLevel?: "h2" | "h3";
  proposedSolutionId?: Id<"simulationComparisonSolutions">;
  hasExistingProposal: boolean;
  readOnly: boolean;
  isCurrentRun: boolean;
  expandedSolutionId: string | null;
  onToggleExpanded: (solutionId: string) => void;
  onPropose?: (solutionId: Id<"simulationComparisonSolutions">) => Promise<void>;
};

export function ComparisonSection({
  title,
  description,
  empty,
  solutions,
  tone = "default",
  grid = true,
  headingLevel = "h2",
  proposedSolutionId,
  hasExistingProposal,
  readOnly,
  isCurrentRun,
  expandedSolutionId,
  onToggleExpanded,
  onPropose,
}: ComparisonSectionProps) {
  const Heading = headingLevel;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <Heading
          className={
            headingLevel === "h3"
              ? "text-base font-semibold"
              : "text-lg font-semibold"
          }
        >
          {title}
        </Heading>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {solutions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div
          className={
            grid
              ? "grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3"
              : "grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {solutions.map((solution) => {
            const id = solution._id;
            return (
              <CompactSolutionCard
                key={id}
                solution={solution}
                tone={tone}
                isProposed={
                  proposedSolutionId === id || solution.isProposed
                }
                hasExistingProposal={hasExistingProposal}
                readOnly={readOnly}
                isCurrentRun={isCurrentRun}
                isExpanded={expandedSolutionId === id}
                onToggleExpanded={() => onToggleExpanded(id)}
                onPropose={
                  onPropose
                    ? () => onPropose(id as Id<"simulationComparisonSolutions">)
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
