export type JournalLine = {
  id: number;
  date: string;
  description: string | null;
  debit_amount: string | null;
  credit_amount: string | null;
  account: { id: string; name: string };
  journal: { id: number; name: string };
  transaction: { id: number; name: string };
};

export type ListJournalLinesFilters = {
  from?: string | undefined;
  to?: string | undefined;
  account_id?: string | undefined;
  journal_id?: number | undefined;
  type?: "debit" | "credit" | undefined;
  description?: string | undefined;
};
