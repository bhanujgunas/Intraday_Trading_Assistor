-- ═══════════════════════════════════════════════════════════════
-- IntraRadar v3 — Supabase Schema with RLS + Google Auth
-- Run this ENTIRE file in Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ── TRADES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  date        DATE NOT NULL,
  symbol      TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'Intraday MIS',
  qty         NUMERIC NOT NULL,
  buy_price   NUMERIC NOT NULL,
  sell_price  NUMERIC,
  notes       TEXT DEFAULT '',
  gross_pnl   NUMERIC,
  charges     NUMERIC NOT NULL DEFAULT 0,
  net_pnl     NUMERIC,
  status      TEXT NOT NULL DEFAULT 'OPEN'
);
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trades_rls" ON trades;
CREATE POLICY "trades_rls" ON trades FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── USER SETTINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  capital      NUMERIC NOT NULL DEFAULT 50000,
  risk_pct     NUMERIC NOT NULL DEFAULT 1.5,
  watchlist    TEXT NOT NULL DEFAULT 'default',
  theme        TEXT NOT NULL DEFAULT 'dark',
  extras       JSONB DEFAULT '{}'
);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_rls" ON user_settings;
CREATE POLICY "settings_rls" ON user_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── SCAN HISTORY ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_history (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scanned_at  TIMESTAMPTZ DEFAULT NOW(),
  watchlist   TEXT NOT NULL,
  capital     NUMERIC NOT NULL,
  results     JSONB NOT NULL
);
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scan_rls" ON scan_history;
CREATE POLICY "scan_rls" ON scan_history FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── INDEXES ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trades_user_date   ON trades (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user_status ON trades (user_id, status);
CREATE INDEX IF NOT EXISTS idx_scan_user_at       ON scan_history (user_id, scanned_at DESC);

-- Verify
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
