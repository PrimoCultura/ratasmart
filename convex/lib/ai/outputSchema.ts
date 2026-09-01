import { z } from "zod";

export const VirtualMarcoOutputSchema = z.object({
  outcome: z.enum([
    "answered",
    "needs_information",
    "requires_verification",
    "not_covered",
  ]),
  answer: z.string().min(1),
  requiresVerification: z.boolean(),
  verificationTarget: z.enum([
    "none",
    "area_manager",
    "financial_company",
    "both",
  ]),
  alerts: z.array(z.string()),
  missingInformation: z.array(z.string()),
});

export type VirtualMarcoOutput = z.infer<typeof VirtualMarcoOutputSchema>;

export const VIRTUAL_MARCO_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "outcome",
    "answer",
    "requiresVerification",
    "verificationTarget",
    "alerts",
    "missingInformation",
  ],
  properties: {
    outcome: {
      type: "string",
      enum: [
        "answered",
        "needs_information",
        "requires_verification",
        "not_covered",
      ],
    },
    answer: { type: "string", minLength: 1 },
    requiresVerification: { type: "boolean" },
    verificationTarget: {
      type: "string",
      enum: ["none", "area_manager", "financial_company", "both"],
    },
    alerts: { type: "array", items: { type: "string" } },
    missingInformation: { type: "array", items: { type: "string" } },
  },
} as const;
