import type { z } from "zod";
import type { listAccountsQuerySchema } from "./schema";

export type Account = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type ListAccountsFilters = z.infer<typeof listAccountsQuerySchema>;
