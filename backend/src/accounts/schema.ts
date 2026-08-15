import { z } from "zod";

export const listAccountsQuerySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  created_after: z.string().date().optional(),
  created_before: z.string().date().optional(),
});

export const createAccountBodySchema = z.object({
  pcg_code: z
    .string()
    .trim()
    .min(1, "pcg_code is required")
    .max(10, "pcg_code cannot exceed 10 digits")
    .regex(/^\d+$/, "pcg_code must contain digits only"),
  name: z.string().trim().min(1, "name cannot be empty"),
  description: z.string().trim().min(1).nullable().optional().transform((v) => v ?? null),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const updateAccountBodySchema = z.object({
  name: z.string().trim().min(1, "name cannot be empty").optional(),
  description: z.string().trim().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export const getAccountJournalLinesQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  journal_id: z.coerce.number().int().positive().optional(),
  type: z.enum(["debit", "credit"]).optional(),
  description: z.string().optional(),
});

export const getAccountBalanceQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
