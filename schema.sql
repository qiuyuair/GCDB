CREATE TABLE IF NOT EXISTS sent_offers (
  offer_id     INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  link         TEXT NOT NULL,
  offer_type   TEXT,
  validity     TEXT,
  sent_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
