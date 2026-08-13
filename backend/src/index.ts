import "dotenv/config";
import express from "express";
import cors from "cors";

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
app.get("/api/pcg-reference/:code", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (${NODE_ENV})`);
});
