/**
 * Config soglie “Segnale formativo” (Virtual Marco Intelligence).
 * Valori iniziali espliciti e modificabili in un unico punto.
 */
export const TRAINING_SIGNAL_DEFAULTS = {
  minimumQuestions: 5,
  minimumUniqueUsers: 3,
  minimumCoverageRate: 0.8,
  maximumKnowledgeGapRate: 0.2,
} as const;

export type TrainingSignalThresholds = {
  minimumQuestions: number;
  minimumUniqueUsers: number;
  minimumCoverageRate: number;
  maximumKnowledgeGapRate: number;
};

export function getTrainingSignalThresholds(
  overrides?: Partial<TrainingSignalThresholds>,
): TrainingSignalThresholds {
  return { ...TRAINING_SIGNAL_DEFAULTS, ...overrides };
}
