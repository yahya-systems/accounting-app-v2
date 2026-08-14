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

export const createJournalLineBodySchema = z
  .object({
    journal_id: z.coerce.number().int().positive().max(2147483647),
    account_id: z.string().trim().min(1, "account_id is required"),
    date: z.string().date(),
    description: z.string().trim().min(1, "description is required"),
    debit_amount: z.number().positive().nullable().optional(),
    credit_amount: z.number().positive().nullable().optional(),
  })
  .refine(
    (data) => {
      const hasDebit = data.debit_amount != null;
      const hasCredit = data.credit_amount != null;
      return hasDebit !== hasCredit; // exactly one, XOR
    },
    {
      message: "Exactly one of debit_amount or credit_amount must be provided, as a positive nonzero number",
    }
  );

export const updateJournalLineBodySchema = z
  .object({
    journal_id: z.coerce.number().int().positive().max(2147483647).optional(),
    account_id: z.string().trim().min(1, "account_id cannot be empty").optional(),
    date: z.string().date().optional(),
    description: z.string().trim().min(1, "description cannot be empty").optional(),
    debit_amount: z.number().positive().nullable().optional(),
    credit_amount: z.number().positive().nullable().optional(),
  })
  .refine(
    (data) => {
      const hasDebit = data.debit_amount !== undefined;
      const hasCredit = data.credit_amount !== undefined;

      if (!hasDebit && !hasCredit) return true; // both omitted, fine

      if (hasDebit !== hasCredit) return false; // exactly one provided, reject

      // both provided: exactly one must be a real value, the other null
      const debitSet = data.debit_amount != null;
      const creditSet = data.credit_amount != null;
      return debitSet !== creditSet;
    },
    {
      message:
        "debit_amount and credit_amount must both be omitted, or both provided with exactly one set to a positive nonzero value and the other null",
    }
  );
