import { z } from "zod";

// Days-in-month per month index (1-12), non-leap-year baseline; February is
// checked separately against the resolved (current) year's leap-year rule.
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Client sends only month+day ("MM-DD"), matching the month-before-day
// ordering of the full "YYYY-MM-DD" dates returned by GET endpoints; the
// year is always implied to be the current year at the moment of the
// request, since journal lines can span multiple years and the client
// never specifies one. This schema validates "MM-DD" and expands it to a
// full "YYYY-MM-DD" string using the current server-clock year, so
// downstream code (services, SQL) only ever deals with full dates.
const dayMonthDateSchema = z
  .string()
  .regex(/^\d{2}-\d{2}$/, "date must be in MM-DD format")
  .transform((value, ctx) => {
    const parts = value.split("-").map(Number);
    const month = parts[0];
    const day = parts[1];
    if (day === undefined || month === undefined) {
      ctx.addIssue({ code: "custom", message: "date must be in MM-DD format" });
      return z.NEVER;
    }

    const year = new Date().getFullYear();
    const maxDay = month === 2 && isLeapYear(year)
      ? 29
      : DAYS_IN_MONTH[month - 1];

    if (month < 1 || month > 12 || maxDay === undefined || day < 1 || day > maxDay) {
      ctx.addIssue({ code: "custom", message: "date must be a valid MM-DD calendar date" });
      return z.NEVER;
    }

    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  });

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
    date: dayMonthDateSchema,
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

export const createJournalLinesBodySchema = z
  .array(createJournalLineBodySchema)
  .min(1, "At least one journal line is required");

export const updateJournalLineBodySchema = z
  .object({
    journal_id: z.coerce.number().int().positive().max(2147483647).optional(),
    account_id: z.string().trim().min(1, "account_id cannot be empty").optional(),
    date: dayMonthDateSchema.optional(),
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
