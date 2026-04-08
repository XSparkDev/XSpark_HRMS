-- ============================================================================
-- LEAVE EARLY RETURN MIGRATION
-- ============================================================================
-- Adds early-return request/approval fields to the current leave_requests table
-- used by the app (/api/leave/requests).
--
-- Fields:
-- - early_return_requested_at (timestamptz, nullable)
-- - early_return_date (date, nullable)
-- - early_return_status (enum: pending/approved/rejected, nullable)
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'early_return_status_enum') THEN
    CREATE TYPE early_return_status_enum AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END$$;

ALTER TABLE IF EXISTS leave_requests
  ADD COLUMN IF NOT EXISTS early_return_requested_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS early_return_date DATE NULL,
  ADD COLUMN IF NOT EXISTS early_return_status early_return_status_enum NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_early_return_status ON leave_requests(early_return_status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_early_return_requested_at ON leave_requests(early_return_requested_at DESC);

COMMIT;

