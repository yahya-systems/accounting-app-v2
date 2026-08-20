CREATE TABLE accounts (
  id           varchar(10) PRIMARY KEY,
  name         text NOT NULL UNIQUE,
  description  text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TYPE journal_type AS ENUM (
  'Caisse',
  'Banque',
  'Achats',
  'Ventes',
  'Opérations Diverses',
  'Autre'
);

CREATE TABLE journals (
  id           serial PRIMARY KEY,
  name         text NOT NULL UNIQUE,
  description  text,
  type         journal_type NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE transaction_status AS ENUM ('draft', 'posted');

CREATE TABLE transactions (
  id           serial PRIMARY KEY,
  journal_id   int REFERENCES journals(id),
  date         date,
  name         text UNIQUE,
  status       transaction_status NOT NULL DEFAULT 'draft',
  created_at   timestamptz NOT NULL DEFAULT now(),
  posted_at    timestamptz,
  CONSTRAINT posted_requires_complete_fields CHECK (
    status = 'draft'
    OR
    (journal_id IS NOT NULL AND date IS NOT NULL AND name IS NOT NULL)
  )
);

CREATE TABLE journal_line_drafts (
  id              serial PRIMARY KEY,
  transaction_id  int NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id      varchar(10) NOT NULL REFERENCES accounts(id),
  description     text,
  debit_amount    numeric,
  credit_amount   numeric,
  CONSTRAINT one_side_only_draft CHECK (
    (debit_amount IS NOT NULL AND credit_amount IS NULL)
    OR
    (debit_amount IS NULL AND credit_amount IS NOT NULL)
  )
);

CREATE INDEX idx_journal_line_drafts_transaction ON journal_line_drafts (transaction_id);

CREATE TABLE journal_lines (
  id             serial PRIMARY KEY,
  transaction_id int NOT NULL REFERENCES transactions(id),
  account_id     varchar(10) NOT NULL REFERENCES accounts(id),
  description    text,
  debit_amount   numeric,
  credit_amount  numeric,
  CONSTRAINT one_side_only CHECK (
    (debit_amount IS NOT NULL AND credit_amount IS NULL)
    OR
    (debit_amount IS NULL AND credit_amount IS NOT NULL)
  )
);

CREATE INDEX idx_journal_lines_account ON journal_lines (account_id);
CREATE INDEX idx_journal_lines_transaction ON journal_lines (transaction_id);
