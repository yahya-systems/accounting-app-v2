import "dotenv/config";
import express from "express";
import cors from "cors";
import { query } from "./db/pool";

import { accountsRouter } from "@accounts/route";
import { journalsRouter } from "@journals/route";
import { journalLinesRouter } from "@journal-lines/route";
import { errorHandler } from "@middleware/error/error-handler";

const app = express();

const PORT = process.env['PORT'] ? Number(process.env['PORT']) : 3000;
const NODE_ENV = process.env['NODE_ENV'] ?? "development";

app.use(express.json());

// CORS wide open in dev; production should have no CORS layer here at all
// (same-origin via nginx/reverse proxy handles that instead).
if (NODE_ENV !== "production") {
  app.use(cors());
}

app.use("/api/accounts", accountsRouter);
app.use("/api/journals", journalsRouter);
app.use("/api/journal-lines", journalLinesRouter);

// pcg-reference is a single, standalone lookup — not a full CRUD resource,
// so it's handled inline here rather than given its own feature folder.
app.get("/api/pcg-reference/:code", async (req, res, next) => {
  try {
    const code = req.params.code;

    const rows = await query<{ id: string; name: string }>(
      `SELECT id, name FROM pcg_reference WHERE id = $1`,
      [code]
    );

    const match = rows[0];

    if (!match) {
      res.status(404).json({ error: `No PCGE reference entry found for code "${code}"` });
      return;
    }

    res.json(match);
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (${NODE_ENV})`);
});
