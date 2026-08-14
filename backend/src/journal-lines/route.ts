import { Router } from "express";
import { listJournalLines } from "./service/list-journal-lines";
import { getJournalLine } from "./service/get-journal-line";
import { createJournalLine } from "./service/create-journal-line";
import { updateJournalLine } from "./service/update-journal-line";
import { listJournalLinesQuerySchema, journalLineIdParamSchema, createJournalLineBodySchema, updateJournalLineBodySchema } from "@journal-lines/schema";

export const journalLinesRouter = Router();

journalLinesRouter.get("/", async (req, res, next) => {
  try {
    const filters = listJournalLinesQuerySchema.parse(req.query);
    const lines = await listJournalLines(filters);
    res.json(lines);
  } catch (err) {
    next(err);
  }
});

journalLinesRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = journalLineIdParamSchema.parse(req.params);
    const line = await getJournalLine(id);
    res.json(line);
  } catch (err) {
    next(err);
  }
});

journalLinesRouter.post("/", async (req, res, next) => {
  try {
    const body = createJournalLineBodySchema.parse(req.body);
    const line = await createJournalLine(body);
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

journalLinesRouter.patch("/:id", async (req, res, next) => {
  try {
    const { id } = journalLineIdParamSchema.parse(req.params);
    const body = updateJournalLineBodySchema.parse(req.body);
    const line = await updateJournalLine(id, body);
    res.json(line);
  } catch (err) {
    next(err);
  }
});
