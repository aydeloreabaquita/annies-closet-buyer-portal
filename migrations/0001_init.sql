PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS buyers (
  id TEXT PRIMARY KEY,
  buyer_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  messenger_psid TEXT UNIQUE,
  link_status TEXT NOT NULL DEFAULT 'unlinked' CHECK (link_status IN ('unlinked','pending','linked','blocked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_buyers_normalized_name ON buyers(normalized_name);

CREATE TABLE IF NOT EXISTS buyer_items (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  amount_centavos INTEGER NOT NULL DEFAULT 0,
  initial_payment_centavos INTEGER NOT NULL DEFAULT 0,
  source_row TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_buyer_items_buyer ON buyer_items(buyer_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  amount_centavos INTEGER NOT NULL,
  receipt_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_buyer ON payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE TABLE IF NOT EXISTS addresses (
  buyer_id TEXT PRIMARY KEY REFERENCES buyers(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  address_line TEXT NOT NULL,
  barangay TEXT,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal_code TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_links (
  token_hash TEXT PRIMARY KEY,
  messenger_psid TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_links_expiry ON login_links(expires_at);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  messenger_psid TEXT NOT NULL,
  buyer_id TEXT,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otp_psid ON otp_challenges(messenger_psid);

CREATE TABLE IF NOT EXISTS buyer_claims (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  messenger_psid TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_claims_status ON buyer_claims(status);

CREATE TABLE IF NOT EXISTS sessions (
  session_hash TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  messenger_psid TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
