-- Migration: add visibility support to notes2
ALTER TABLE notes2
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'public'));

-- Backfill legacy rows
UPDATE notes2
SET visibility = 'private'
WHERE visibility IS NULL;

-- Helpful indexes for the new queries
CREATE INDEX IF NOT EXISTS idx_notes2_visibility ON notes2(visibility);
CREATE INDEX IF NOT EXISTS idx_notes2_visibility_alert ON notes2(visibility, alert_level, created_at DESC);






