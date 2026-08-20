import { Router } from "express";

import { createTransaction } from "./service/create-transaction";
import { listTransactions } from "./service/list-transactions";
import { getTransaction } from "./service/get-transaction";
import { updateTransaction } from "./service/update-transaction";
import { deleteTransaction } from "./service/delete-transaction";
import { createLineDraft } from "./service/create-line-draft";
import { updateLineDraft } from "./service/update-line-draft";
import { deleteLineDraft } from "./service/delete-line-draft";
import { getTransactionBalance } from "./service/get-transaction-balance";
import { postTransaction } from "./service/post-transaction";
import { AppError } from "@middleware/error/app-error";
import {
  createTransactionBodySchema,
  listTransactionsQuerySchema,
  transactionIdParamSchema,
  updateTransactionBodySchema,
  createLineDraftBodySchema,
  updateLineDraftBodySchema,
  lineDraftIdParamSchema,
} from "@transactions/schema";

export const transactionsRouter = Router();

transactionsRouter.get("/", async (req, res, next) => {
  try {
    const filters = listTransactionsQuerySchema.parse(req.query);
    const transactions = await listTransactions(filters);
    res.json(transactions);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.post("/", async (req, res, next) => {
  try {
    const body = createTransactionBodySchema.parse(req.body);
    const transaction = await createTransaction(body);
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = transactionIdParamSchema.parse(req.params);
    const transaction = await getTransaction(id);
    res.json(transaction);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.get("/:id/balance", async (req, res, next) => {
  try {
    const { id } = transactionIdParamSchema.parse(req.params);
    const balance = await getTransactionBalance(id);
    res.json(balance);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { id } = transactionIdParamSchema.parse(req.params);
    const body = updateTransactionBodySchema.parse(req.body);
    const transaction = await updateTransaction(id, body);
    res.json(transaction);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { id } = transactionIdParamSchema.parse(req.params);
    await deleteTransaction(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

transactionsRouter.post("/:id/lines", async (req, res, next) => {
  try {
    const { id } = transactionIdParamSchema.parse(req.params);
    const body = createLineDraftBodySchema.parse(req.body);
    const line = await createLineDraft(id, body);
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.patch("/:id/lines/:lineId", async (req, res, next) => {
  try {
    const { id, lineId } = lineDraftIdParamSchema.parse(req.params);
    const parsed = updateLineDraftBodySchema.parse(req.body);

    // Presence of the raw keys (not their parsed value) decides whether
    // amounts are being replaced at all, per the "touch either, replace
    // both" PATCH semantics: this must be checked against req.body before
    // Zod's .optional() collapses "omitted" and "undefined" together.
    const amountsTouched =
      Object.prototype.hasOwnProperty.call(req.body, "debit_amount") ||
      Object.prototype.hasOwnProperty.call(req.body, "credit_amount");

    if (amountsTouched) {
      const hasDebit = parsed.debit_amount !== null;
      const hasCredit = parsed.credit_amount !== null;
      if (hasDebit === hasCredit) {
        throw new AppError(
          400,
          "Exactly one of debit_amount or credit_amount must be a positive nonzero value when either is provided"
        );
      }
    }

    const line = await updateLineDraft(id, lineId, {
      account_id: parsed.account_id,
      description: parsed.description,
      amountsTouched,
      debit_amount: amountsTouched ? parsed.debit_amount ?? null : null,
      credit_amount: amountsTouched ? parsed.credit_amount ?? null : null,
    });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.post("/:id/post", async (req, res, next) => {
  try {
    const { id } = transactionIdParamSchema.parse(req.params);
    const transaction = await postTransaction(id);
    res.json(transaction);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.delete("/:id/lines/:lineId", async (req, res, next) => {
  try {
    const { id, lineId } = lineDraftIdParamSchema.parse(req.params);
    await deleteLineDraft(id, lineId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
