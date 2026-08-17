import { z } from "zod";

export const listJournalsQuerySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  created_after: z.string().date().optional(),
  created_before: z.string().date().optional(),
});

export const createJournalBodySchema = z.object({
  name: z.string().trim().min(1, "name cannot be empty"),
  description: z.string().trim().min(1).nullable().optional().transform((v) => v ?? null),
});

export const updateJournalSchema = z.object({
  name: z.string().min(1, "name cannot be empty").optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const getJournalJournalLinesQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  account_id: z.string().optional(),
  type: z.enum(["debit", "credit"]).optional(),
  description: z.string().optional(),
});

export const getJournalBalanceQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const journalIdParamSchema = z.object({
  id: z.coerce.number().int().positive().max(2147483647),
});
