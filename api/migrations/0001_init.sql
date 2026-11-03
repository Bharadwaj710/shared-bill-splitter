CREATE TABLE homes (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_homes PRIMARY KEY (id),
  CONSTRAINT ck_homes_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE members (
  id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  member_order INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_members PRIMARY KEY (id),
  CONSTRAINT fk_members_home FOREIGN KEY (home_id) REFERENCES homes (id),
  CONSTRAINT ck_members_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT ck_members_order_positive CHECK (
    typeof(member_order) = 'integer' AND member_order > 0
  ),
  CONSTRAINT uq_members_home_order UNIQUE (home_id, member_order),
  CONSTRAINT uq_members_id_home UNIQUE (id, home_id)
);

CREATE TABLE bills (
  id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_bills PRIMARY KEY (id),
  CONSTRAINT fk_bills_home FOREIGN KEY (home_id) REFERENCES homes (id),
  CONSTRAINT ck_bills_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT ck_bills_total_positive_integer CHECK (
    typeof(total_cents) = 'integer' AND total_cents > 0
  ),
  CONSTRAINT uq_bills_id_home UNIQUE (id, home_id)
);

CREATE TABLE shares (
  id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_shares PRIMARY KEY (id),
  CONSTRAINT fk_shares_bill_home FOREIGN KEY (bill_id, home_id)
    REFERENCES bills (id, home_id),
  CONSTRAINT fk_shares_member_home FOREIGN KEY (member_id, home_id)
    REFERENCES members (id, home_id),
  CONSTRAINT uq_shares_bill_member UNIQUE (bill_id, member_id),
  CONSTRAINT ck_shares_amount_nonnegative_integer CHECK (
    typeof(amount_cents) = 'integer' AND amount_cents >= 0
  ),
  CONSTRAINT ck_shares_payment_pair CHECK (
    (paid_at IS NULL AND idempotency_key IS NULL)
    OR (paid_at IS NOT NULL AND idempotency_key IS NOT NULL)
  )
);

CREATE INDEX idx_members_home_order
  ON members (home_id, member_order);

CREATE INDEX idx_bills_home
  ON bills (home_id);

CREATE INDEX idx_shares_bill
  ON shares (bill_id);

CREATE INDEX idx_shares_unpaid_home_member
  ON shares (home_id, member_id)
  WHERE paid_at IS NULL;
