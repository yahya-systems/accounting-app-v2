export const JOURNAL_TYPES = [
  "Caisse",
  "Banque",
  "Achats",
  "Ventes",
  "Opérations Diverses",
  "Autre",
] as const;

export type JournalType = (typeof JOURNAL_TYPES)[number];

export type Journal = {
  id: number;
  name: string;
  description: string | null;
  type: JournalType;
  is_active: boolean;
  created_at: string;
};

export type ListJournalsFilters = {
  name?: string | undefined;
  description?: string | undefined;
  type?: JournalType | undefined;
  is_active?: boolean | undefined;
  created_after?: string | undefined;
  created_before?: string | undefined;
};

export interface UpdateJournalInput {
  name?: string | undefined;
  description?: string | null | undefined;
  type?: JournalType | undefined;
  is_active?: boolean | undefined;
}


