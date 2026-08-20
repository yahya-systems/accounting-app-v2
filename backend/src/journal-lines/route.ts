import { Router } from "express";
import { listJournalLines } from "./service/list-journal-lines";
import { getJournalLine } from "./service/get-journal-line";
import { listJournalLinesQuerySchema, journalLineIdParamSchema } from "@journal-lines/schema";

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

