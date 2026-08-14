export type Journal = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type ListJournalsFilters = {
  name?: string | undefined;
  description?: string | undefined;
  is_active?: boolean | undefined;
  created_after?: string | undefined;
  created_before?: string | undefined;
};

export interface UpdateJournalInput {
  name?: string | undefined;
  description?: string | null | undefined;
  is_active?: boolean | undefined;
}


