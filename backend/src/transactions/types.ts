export const TRANSACTION_STATUSES = ["draft", "posted"] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export type Transaction = {
  id: number;
  journal_id: number | null;
  date: string | null;
  name: string | null;
  status: TransactionStatus;
  created_at: string;
  posted_at: string | null;
};

export type TransactionListItem = {
  id: number;
  date: string | null;
  name: string | null;
  status: TransactionStatus;
  created_at: string;
  posted_at: string | null;
  journal: { id: number; name: string } | null;
};

export type TransactionLine = {
  id: number;
  account: { id: string; name: string };
  description: string | null;
  debit_amount: string | null;
  credit_amount: string | null;
};

export type TransactionDetail = Transaction & {
  lines: TransactionLine[];
};

export type UpdateTransactionInput = {
  journal_id?: number | null | undefined;
  date?: string | null | undefined;
  name?: string | null | undefined;
};

export type CreateLineDraftInput = {
  account_id: string;
  description: string | null;
  debit_amount: number | null;
  credit_amount: number | null;
};

export type UpdateLineDraftInput = {
  account_id?: string | undefined;
  description?: string | null | undefined;
  amountsTouched: boolean;
  debit_amount: number | null;
  credit_amount: number | null;
};

export type ListTransactionsFilters = {
  journal_id?: number | undefined;
  status?: TransactionStatus | undefined;
  name?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  created_after?: string | undefined;
  created_before?: string | undefined;
};
