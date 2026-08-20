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
// request, since transactions can span multiple years and the client
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

export const listTransactionsQuerySchema = z.object({
  journal_id: z.coerce.number().int().positive().max(2147483647).optional(),
  status: z.enum(["draft", "posted"]).optional(),
  name: z.string().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  created_after: z.string().date().optional(),
  created_before: z.string().date().optional(),
});

// Accepts omitted, null, or 0 as "not set" (normalized to null); rejects
// negative values outright. A positive number passes through as-is.
const flexibleAmountSchema = z
  .number()
  .nullable()
  .optional()
  .transform((value) => (value == null || value === 0 ? null : value))
  .refine((value) => value === null || value > 0, {
    message: "amount cannot be negative",
  });

export const createLineDraftBodySchema = z
  .object({
    account_id: z.string().trim().min(1, "account_id is required"),
    description: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    debit_amount: flexibleAmountSchema,
    credit_amount: flexibleAmountSchema,
  })
  .refine(
    (data) => {
      const hasDebit = data.debit_amount !== null;
      const hasCredit = data.credit_amount !== null;
      return hasDebit !== hasCredit; // exactly one, XOR
    },
    {
      message: "Exactly one of debit_amount or credit_amount must be a positive nonzero value",
    }
  );

export const lineDraftIdParamSchema = z.object({
  id: z.coerce.number().int().positive().max(2147483647),
  lineId: z.coerce.number().int().positive().max(2147483647),
});

// PATCH semantics: debit_amount/credit_amount are validated together at the
// route layer (see update-line-draft route handler) because whether a key
// was present in the raw body — not just its parsed value — determines
// whether the amount pair is being replaced. This schema only shapes/bounds
// individual fields; the "were amounts touched at all" check happens on
// req.body directly before this schema strips that information.
export const updateLineDraftBodySchema = z.object({
  account_id: z.string().trim().min(1, "account_id cannot be empty").optional(),
  description: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value ?? null)),
  debit_amount: flexibleAmountSchema,
  credit_amount: flexibleAmountSchema,
});

// PATCH semantics: field may be omitted (untouched), explicit null (clear
// back to unset — only valid while the transaction is still a draft, the DB
// CHECK constraint enforces that a posted transaction can't have any of
// these three go null), or a real value (set/replace).
export const updateTransactionBodySchema = z.object({
  journal_id: z.coerce.number().int().positive().max(2147483647).nullable().optional(),
  date: dayMonthDateSchema.nullable().optional(),
  name: z.string().trim().min(1, "name cannot be empty").nullable().optional(),
});

export const transactionIdParamSchema = z.object({
  id: z.coerce.number().int().positive().max(2147483647),
});

// All fields optional at creation time — a draft can start out completely
// bare (no journal, date, or name) and be filled in later via PATCH. The DB
// CHECK constraint is what actually enforces these are required once the
// transaction is posted, not this schema.
export const createTransactionBodySchema = z.object({
  journal_id: z.coerce.number().int().positive().max(2147483647).optional(),
  date: dayMonthDateSchema.optional(),
  name: z.string().trim().min(1, "name cannot be empty").optional(),
});
