-- ============================================================================
-- TEMPORARY: Disable RLS for Testing (RUN IN SUPABASE SQL EDITOR)
-- ============================================================================
-- WARNING: This disables security. Only use for local development testing!
-- Re-enable RLS before deploying to production
-- ============================================================================

ALTER TABLE resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs DISABLE ROW LEVEL SECURITY;

-- If you want to disable ALL RLS (most permissive):
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TO RE-ENABLE RLS LATER (Run this when done testing)
-- ============================================================================
-- ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ============================================================================

