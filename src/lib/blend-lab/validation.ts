import { z } from "zod";

export const pincodeCoverageSchema = z.object({
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Must be a valid 6-digit Indian postal code"),
  country: z.literal("IN").default("IN").optional(),
  planCode: z.enum(["MATCH_QUOTE", "QUALITY_AUDIT", "SIGNATURE"]).optional(),
});

export const sampleInfoSchema = z.object({
  category: z.enum([
    "CTC",
    "orthodox",
    "green",
    "white",
    "oolong",
    "flavoured",
    "other",
    "unknown",
  ]),
  leafGrade: z.string().trim().max(60).optional().default(""),
  currentPurchasePricePerKg: z.coerce.number().positive().optional(),
  sampleWeightGrams: z.coerce
    .number()
    .min(50, "At least 50g sample required (100g recommended)")
    .max(1000, "Maximum 1kg per intake parcel")
    .default(100),
  primaryUseCase: z
    .string()
    .trim()
    .min(3, "Please describe your primary usage (e.g. Milk chai, Cafeteria blend, Retail pack)")
    .max(200),
});

export const commercialGoalsSchema = z.object({
  goalType: z.enum(["lower_cost", "stronger_chai", "consistent_cup", "new_signature"]),
  targetPricePerKg: z.coerce.number().positive().optional(),
  notes: z.string().trim().max(1000).optional().default(""),
  sensorySliders: z
    .object({
      strength: z.coerce.number().min(1).max(5).default(3),
      astringency: z.coerce.number().min(1).max(5).default(3),
      aroma: z.coerce.number().min(1).max(5).default(3),
      sweetness: z.coerce.number().min(1).max(5).default(3),
    })
    .optional(),
});

export const pickupDetailsSchema = z.object({
  contactName: z
    .string()
    .trim()
    .min(2, "Full contact name is required")
    .max(100),
  businessName: z.string().trim().max(100).optional().default(""),
  email: z.string().trim().email("Valid email address is required"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Valid 10-digit Indian mobile number required"),
  gstin: z.string().trim().max(20).optional().default(""),
  addressLine1: z
    .string()
    .trim()
    .min(5, "Street address line 1 is required")
    .max(150),
  addressLine2: z.string().trim().max(150).optional().default(""),
  city: z.string().trim().min(2, "City is required").max(100),
  state: z.string().trim().min(2, "State is required").max(100),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Valid 6-digit Indian PIN code required"),
});

export const intakeDraftSchema = z.object({
  planCode: z.enum(["MATCH_QUOTE", "QUALITY_AUDIT", "SIGNATURE"]),
  sampleInfo: sampleInfoSchema,
  commercialGoals: commercialGoalsSchema,
  pickupDetails: pickupDetailsSchema,
  acceptedTermsVersion: z
    .string()
    .trim()
    .min(1, "Service terms must be accepted to proceed"),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Valid idempotency key is required")
    .max(128),
});

export type PincodeCoverageInput = z.infer<typeof pincodeCoverageSchema>;
export type SampleInfoInput = z.infer<typeof sampleInfoSchema>;
export type CommercialGoalsInput = z.infer<typeof commercialGoalsSchema>;
export type PickupDetailsInput = z.infer<typeof pickupDetailsSchema>;
export type IntakeDraftParsed = z.infer<typeof intakeDraftSchema>;
export type IntakeDraftInput = z.input<typeof intakeDraftSchema>;
