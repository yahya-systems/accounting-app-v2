import { Router } from "express";

import { listJournals } from "@journals/service/list-journals";
import { createJournal } from "./service/create-journals";
import { updateJournal } from "./service/update-journal";
import { getJournal } from "./service/get-journal";
import { getJournalJournalLines } from "./service/get-journal-journal-lines";
import { getJournalBalance } from "./service/get-journal-balance";
import { listJournalsQuerySchema, createJournalBodySchema, updateJournalSchema, getJournalJournalLinesQuerySchema, getJournalBalanceQuerySchema, journalIdParamSchema } from "@journals/schema";

export const journalsRouter = Router();

journalsRouter.get("/", async (req, res, next) => {
  try {
    const filters = listJournalsQuerySchema.parse(req.query);
    const journals = await listJournals(filters);
    res.json(journals);
  } catch (err) {
    next(err);
  }
});

journalsRouter.post("/", async (req, res, next) => {
  try {
    const body = createJournalBodySchema.parse(req.body);
    const journal = await createJournal(body);
    res.status(201).json(journal);
  } catch (err) {
    next(err);
  }
});

journalsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { id } = journalIdParamSchema.parse(req.params);
    const body = updateJournalSchema.parse(req.body);
    const journal = await updateJournal(id, body);
    res.json(journal);
  } catch (err) {
    next(err);
  }
});

journalsRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = journalIdParamSchema.parse(req.params);
    const journal = await getJournal(id);
    res.json(journal);
  } catch (err) {
    next(err);
  }
});

journalsRouter.get("/:id/journal-lines", async (req, res, next) => {
  try {

    const { id } = journalIdParamSchema.parse(req.params);
    const filters = getJournalJournalLinesQuerySchema.parse(req.query);
    const lines = await getJournalJournalLines(id, filters);
    res.json(lines);
  } catch (err) {
    next(err);
  }
});

journalsRouter.get("/:id/balance", async (req, res, next) => {
  try {
    const { id } = journalIdParamSchema.parse(req.params);
    const filters = getJournalBalanceQuerySchema.parse(req.query);
    const result = await getJournalBalance(id, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
