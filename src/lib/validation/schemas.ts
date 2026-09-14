import { z } from "zod";
import { NETWORKS } from "@/lib/constants/app";
import {
  COMMON_FIRST_INSTALLMENT_DELAYS,
  EMPLOYMENT_TYPES,
} from "@/lib/constants/financial";

export const demoCmProfileSchema = z.object({
  firstName: z.string().trim().min(1, "Il nome è obbligatorio"),
  lastName: z.string().trim().min(1, "Il cognome è obbligatorio"),
  clinicName: z.string().trim().min(1, "Il nome della clinica è obbligatorio"),
});

export type DemoCmProfileInput = z.infer<typeof demoCmProfileSchema>;

export const simulationBasicSchema = z.object({
  patientFirstName: z.string().trim().min(1, "Il nome del paziente è obbligatorio"),
  patientLastName: z.string().trim().min(1, "Il cognome del paziente è obbligatorio"),
  network: z.enum(NETWORKS, {
    required_error: "Seleziona la rete",
  }),
  requestedAmount: z
    .number({
      required_error: "L'importo richiesto è obbligatorio",
      invalid_type_error: "Inserisci un importo valido",
    })
    .gt(0, "L'importo richiesto deve essere maggiore di zero"),
  targetInstallment: z
    .number({
      invalid_type_error: "Inserisci una rata valida",
    })
    .gt(0, "La rata obiettivo deve essere maggiore di zero")
    .optional(),
});

export type SimulationBasicInput = z.infer<typeof simulationBasicSchema>;

const delayDaysTuple = COMMON_FIRST_INSTALLMENT_DELAYS as unknown as [
  (typeof COMMON_FIRST_INSTALLMENT_DELAYS)[number],
  ...(typeof COMMON_FIRST_INSTALLMENT_DELAYS)[number][],
];

export const patientSimulationSchema = z
  .object({
    patientFirstName: z
      .string()
      .trim()
      .min(1, "Il nome del paziente è obbligatorio"),
    patientLastName: z
      .string()
      .trim()
      .min(1, "Il cognome del paziente è obbligatorio"),
    network: z.enum(NETWORKS, {
      required_error: "Seleziona la rete",
    }),
    patientAge: z
      .number({
        required_error: "L'età è obbligatoria",
        invalid_type_error: "Inserisci un'età valida",
      })
      .int("L'età deve essere un numero intero")
      .gte(18, "L'età deve essere almeno 18 anni"),
    patientBirthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data di nascita non valida")
      .optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES, {
      required_error: "Seleziona la condizione lavorativa",
    }),
    temporaryContractExpiry: z.number().optional(),
    isNonEuCitizen: z.boolean({
      required_error: "Indicare se il paziente è cittadino extracomunitario",
    }),
    residencePermitExpiry: z.number().optional(),
    hasResidencePermitRenewalReceiptOnly: z.boolean().optional(),
    employmentStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data di assunzione non valida")
      .optional(),
    employmentSeniorityMonths: z
      .number()
      .int()
      .gte(0)
      .optional(),
    hasGuarantor: z.boolean().optional(),
    patientRequestsZeroInterest: z.boolean().optional().default(false),
    requestedAmount: z
      .number({
        required_error: "L'importo richiesto è obbligatorio",
        invalid_type_error: "Inserisci un importo valido",
      })
      .gt(0, "L'importo richiesto deve essere maggiore di zero"),
    targetInstallment: z
      .number({
        invalid_type_error: "Inserisci una rata valida",
      })
      .gt(0, "La rata obiettivo deve essere maggiore di zero")
      .optional(),
    requestedDurationMonths: z
      .number({
        invalid_type_error: "Inserisci una durata valida",
      })
      .int("La durata deve essere un numero intero")
      .gt(0, "La durata deve essere maggiore di zero")
      .optional(),
    preferredFirstInstallmentDelayDays: z
      .union([z.literal(30), z.literal(60), z.literal(90)])
      .optional()
      .refine(
        (value) =>
          value === undefined ||
          (delayDaysTuple as readonly number[]).includes(value),
        "La prima rata deve essere a 30, 60 o 90 giorni",
      ),
  })
  .superRefine((data, ctx) => {
    const now = Date.now();

    if (data.employmentType === "temporary_employee") {
      if (data.temporaryContractExpiry === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["temporaryContractExpiry"],
          message: "La scadenza del contratto è obbligatoria",
        });
      } else if (data.temporaryContractExpiry <= now) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["temporaryContractExpiry"],
          message: "La scadenza del contratto deve essere futura",
        });
      }
    }

    if (data.isNonEuCitizen) {
      if (data.hasResidencePermitRenewalReceiptOnly === true) {
        // Solo ricevuta: la scadenza permesso non è utilizzabile come requisito.
      } else if (data.residencePermitExpiry === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["residencePermitExpiry"],
          message:
            "Indicare la scadenza del permesso oppure segnalare la sola ricevuta di rinnovo",
        });
      } else if (data.residencePermitExpiry <= now) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["residencePermitExpiry"],
          message: "La scadenza del permesso deve essere futura",
        });
      }
    }
  });

export type PatientSimulationInput = z.infer<typeof patientSimulationSchema>;

const optionalNonNegativeNumber = z
  .number({ invalid_type_error: "Inserisci un numero valido" })
  .finite()
  .gte(0)
  .optional();

export const durationTermSchema = z.object({
  durationMonths: z
    .number({ invalid_type_error: "Durata non valida" })
    .int("La durata deve essere intera")
    .gt(0, "La durata deve essere maggiore di zero"),
  minimumAmount: z
    .number({ invalid_type_error: "Importo minimo non valido" })
    .gt(0, "L'importo minimo deve essere maggiore di zero"),
  maximumAmount: z
    .number({ invalid_type_error: "Importo massimo non valido" })
    .gt(0, "L'importo massimo deve essere maggiore di zero"),
  customerTanPercent: optionalNonNegativeNumber,
  internalCostPercent: optionalNonNegativeNumber,
}).superRefine((term, ctx) => {
  if (term.maximumAmount < term.minimumAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maximumAmount"],
      message: "Il massimo deve essere ≥ al minimo",
    });
  }
});

export const financialTableEconomicsSchema = z
  .object({
    useDurationTerms: z.boolean(),
    minimumAmount: z
      .number({ invalid_type_error: "Importo minimo non valido" })
      .gt(0, "L'importo minimo deve essere maggiore di zero"),
    maximumAmount: z
      .number({ invalid_type_error: "Importo massimo non valido" })
      .gt(0, "L'importo massimo deve essere maggiore di zero"),
    minimumDurationMonths: z
      .number({ invalid_type_error: "Durata minima non valida" })
      .int()
      .gt(0),
    maximumDurationMonths: z
      .number({ invalid_type_error: "Durata massima non valida" })
      .int()
      .gt(0),
    durationStepMonths: z
      .number({ invalid_type_error: "Step durata non valido" })
      .int()
      .gt(0),
    customerTanPercent: z
      .number({ invalid_type_error: "TAN non valido" })
      .gte(0),
    openingFeeType: z.enum(["none", "fixed", "percentage"]),
    openingFeeValue: z.number().gte(0),
    collectionFeePerInstallment: z.number().gte(0),
    internalCostPercentAt24Months: optionalNonNegativeNumber,
    firstInstallmentDelayDays: z
      .array(z.number().int().gt(0))
      .min(1, "Indica almeno un ritardo prima rata"),
    durationTerms: z.array(durationTermSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.maximumAmount < data.minimumAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maximumAmount"],
        message: "L'importo massimo deve essere ≥ al minimo",
      });
    }
    if (data.maximumDurationMonths < data.minimumDurationMonths) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maximumDurationMonths"],
        message: "La durata massima deve essere ≥ alla minima",
      });
    }
    if (data.openingFeeType === "none" && data.openingFeeValue !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["openingFeeValue"],
        message: "Con commissione assente il valore deve essere zero",
      });
    }
    if (data.useDurationTerms) {
      if (!data.durationTerms || data.durationTerms.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["durationTerms"],
          message: "Aggiungi almeno una durata",
        });
      } else {
        const seen = new Set<number>();
        for (const term of data.durationTerms) {
          if (seen.has(term.durationMonths)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["durationTerms"],
              message: `Durata duplicata: ${term.durationMonths} mesi`,
            });
          }
          seen.add(term.durationMonths);
        }
      }
    }
  });

export type FinancialTableEconomicsInput = z.infer<
  typeof financialTableEconomicsSchema
>;
