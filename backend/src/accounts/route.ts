import { Router } from "express";

import { listAccounts } from "@accounts/service/list-accounts";
import { createAccount } from "./service/create-account";
import { updateAccount } from "./service/update-accounts";
import { getAccount } from "./service/get-account";
import { getAccountJournalLines } from "./service/get-account-journal-lines";
import { getAccountBalance } from "./service/get-account-balance";
import { listAccountsQuerySchema, createAccountBodySchema, updateAccountBodySchema, getAccountJournalLinesQuerySchema, getAccountBalanceQuerySchema } from "@accounts/schema";

export const accountsRouter = Router();

accountsRouter.get("/", async (req, res, next) => {
  try {
    const filters = listAccountsQuerySchema.parse(req.query);
    const accounts = await listAccounts(filters);
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

accountsRouter.post("/", async (req, res, next) => {
  try {
    const body = createAccountBodySchema.parse(req.body);
    const account = await createAccount(body);
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
});

accountsRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = updateAccountBodySchema.parse(req.body);
    const account = await updateAccount(id, body);
    res.json(account);
  } catch (err) {
    next(err);
  }
});

accountsRouter.get("/:id", async (req, res, next) => {
  try {
    const account = await getAccount(req.params.id);
    res.json(account);
  } catch (err) {
    next(err);
  }
});

accountsRouter.get("/:id/journal-lines", async (req, res, next) => {
  try {
    const id = req.params.id;
    const filters = getAccountJournalLinesQuerySchema.parse(req.query);
    const lines = await getAccountJournalLines(id, filters);
    res.json(lines);
  } catch (err) {
    next(err);
  }
});

accountsRouter.get("/:id/balance", async (req, res, next) => {
  try {
    const id = req.params.id;
    const filters = getAccountBalanceQuerySchema.parse(req.query);
    const result = await getAccountBalance(id, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
