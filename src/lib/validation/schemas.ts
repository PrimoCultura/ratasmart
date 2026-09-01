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
    employmentType: z.enum(EMPLOYMENT_TYPES, {
      required_error: "Seleziona la condizione lavorativa",
    }),
    temporaryContractExpiry: z.number().optional(),
    isNonEuCitizen: z.boolean({
      required_error: "Indicare se il paziente è cittadino extracomunitario",
    }),
    residencePermitExpiry: z.number().optional(),
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
      if (data.residencePermitExpiry === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["residencePermitExpiry"],
          message: "La scadenza del permesso di soggiorno è obbligatoria",
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
