CREATE TABLE accounts (
  id           varchar(10) PRIMARY KEY,
  name         text NOT NULL UNIQUE,
  description  text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE journals (
  id           serial PRIMARY KEY,
  name         text NOT NULL UNIQUE,
  description  text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE journal_lines (
  id             serial PRIMARY KEY,
  journal_id     int NOT NULL REFERENCES journals(id),
  account_id     varchar(10) NOT NULL REFERENCES accounts(id),
  date           date NOT NULL,
  description    text,
  debit_amount   numeric,
  credit_amount  numeric,
  CONSTRAINT one_side_only CHECK (
    (debit_amount IS NOT NULL AND credit_amount IS NULL)
    OR
    (debit_amount IS NULL AND credit_amount IS NOT NULL)
  )
);

CREATE INDEX idx_journal_lines_account_date ON journal_lines (account_id, date);
CREATE INDEX idx_journal_lines_journal_date ON journal_lines (journal_id, date);
