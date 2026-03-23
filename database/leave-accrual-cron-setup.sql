-- ============================================================================
-- LEAVE ACCRUAL CRON JOB SETUP
-- ============================================================================
-- This SQL script sets up a pg_cron job to automatically trigger the
-- leave-accruals Edge Function on the 1st of every month.
-- ============================================================================
-- 
-- Prerequisites:
-- 1. pg_cron extension must be enabled in Supabase
-- 2. Edge Function must be deployed: supabase/functions/leave-accruals
-- 3. Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual values
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule monthly leave accruals (1st of every month at 00:00 UTC)
-- Note: This requires the pg_net extension for HTTP requests
SELECT cron.schedule(
  'monthly-leave-accruals',
  '0 0 1 * *', -- Cron expression: 1st of every month at midnight UTC
  $$
  SELECT net.http_post(
    url := 'https://exzxmdsrfnsnqzzddcip.supabase.co/functions/v1/leave-accruals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4enhtZHNyZm5zbnF6emRkY2lwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUxNzYyMiwiZXhwIjoyMDc2MDkzNjIyfQ.TtxIEFoPdDc9uGrQDo7X_KA3HbvDI2QZnq5yjKtPtMw'
    ),
    body := jsonb_build_object(
      'accrualType', 'monthly'
    )
  ) AS request_id;
  $$
);

-- Optional: Schedule eligibility checks (run daily to catch employees who reach 4 months)
SELECT cron.schedule(
  'daily-eligibility-checks',
  '0 1 * * *', -- Daily at 01:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://exzxmdsrfnsnqzzddcip.supabase.co/functions/v1/leave-accruals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4enhtZHNyZm5zbnF6emRkY2lwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDUxNzYyMiwiZXhwIjoyMDc2MDkzNjIyfQ.TtxIEFoPdDc9uGrQDo7X_KA3HbvDI2QZnq5yjKtPtMw'
    ),
    body := jsonb_build_object(
      'accrualType', 'eligibility'
    )
  ) AS request_id;
  $$
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Unschedule a job (if needed)
-- SELECT cron.unschedule('monthly-leave-accruals');
-- SELECT cron.unschedule('daily-eligibility-checks');

-- ============================================================================
-- ALTERNATIVE: Using Supabase Dashboard
-- ============================================================================
-- If pg_cron is not available, you can set up cron jobs in:
-- Supabase Dashboard -> Database -> Cron Jobs
-- 
-- Or use external services:
-- - GitHub Actions (scheduled workflows)
-- - Vercel Cron Jobs
-- - AWS EventBridge / Lambda
-- - Google Cloud Scheduler
-- ============================================================================

