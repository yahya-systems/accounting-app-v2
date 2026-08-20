import { z } from "zod";

export const listJournalLinesQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  account_id: z.string().optional(),
  journal_id: z.coerce.number().positive().max(2147483647).optional(),
  type: z.enum(["debit", "credit"]).optional(),
  description: z.string().optional(),
});

export const journalLineIdParamSchema = z.object({
  id: z.coerce.number().positive().max(2147483647),
});
