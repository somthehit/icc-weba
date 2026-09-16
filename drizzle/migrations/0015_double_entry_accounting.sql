CREATE TABLE IF NOT EXISTS accounts (
  id serial PRIMARY KEY,
  code varchar(20) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  type varchar(20) NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  parent_id integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_type_idx ON accounts(type);

CREATE TABLE IF NOT EXISTS journal_entries (
  id serial PRIMARY KEY,
  entry_number varchar(40) NOT NULL UNIQUE,
  entry_date date NOT NULL,
  description varchar(300) NOT NULL,
  source_type varchar(40),
  source_id integer,
  posted_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS journal_entries_date_idx ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS journal_entries_source_idx ON journal_entries(source_type, source_id);

CREATE TABLE IF NOT EXISTS journal_lines (
  id serial PRIMARY KEY,
  journal_entry_id integer NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id integer NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  description varchar(300),
  debit numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK ((debit = 0 AND credit > 0) OR (credit = 0 AND debit > 0))
);
CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx ON journal_lines(account_id);

INSERT INTO accounts (code, name, type) VALUES
 ('1000','Cash on Hand','asset'), ('1010','Bank Account','asset'), ('1100','Accounts Receivable','asset'),
 ('1200','Inventory','asset'), ('2000','Accounts Payable','liability'), ('2100','VAT Payable','liability'),
 ('3000','Owner Equity','equity'), ('4000','Product Sales Revenue','revenue'), ('4100','Shipping Revenue','revenue'),
 ('5000','Cost of Goods Sold','expense'), ('6000','Operating Expenses','expense')
ON CONFLICT (code) DO NOTHING;
