# Leave Accrual Cron Jobs - Status

## ✅ Configured Cron Jobs

### 1. Monthly Accruals
- **Schedule**: `0 0 1 * *` (1st of every month at 00:00 UTC)
- **Job Name**: `monthly-leave-accruals`
- **Function**: Calls Edge Function with `accrualType: 'monthly'`
- **What it does**:
  - Accrues 1 day of annual leave for all active employees
  - Accrues sick leave based on employee phase:
    - Phase 1 (0-6 months): +1 day/month (max 6)
    - Phase 2 (at 6 months): Activates 30-day grant
    - Phase 3 (6-42 months): No accrual (already have 30 days)
    - Phase 4 (after 36 months): Resets cycle, grants fresh 30 days

### 2. Daily Eligibility Checks
- **Schedule**: `0 1 * * *` (Daily at 01:00 UTC)
- **Job Name**: `daily-eligibility-checks`
- **Function**: Calls Edge Function with `accrualType: 'eligibility'`
- **What it does**:
  - Checks for employees who reached eligibility thresholds:
    - Family Responsibility Leave (3 months of service)
    - Sick Leave Phase 2 activation (6 months of service)
  - Processes instant accruals for eligible employees

## 📋 Current Configuration

Both cron jobs are configured to call:
```
https://exzxmdsrfnsnqzzddcip.supabase.co/functions/v1/leave-accruals
```

## 🔒 Security Note

**IMPORTANT**: The service role key is embedded in the cron job SQL. 

**Best Practices**:
1. ✅ The key is stored in the database (not exposed in code)
2. ⚠️ Consider rotating the key periodically
3. ⚠️ Monitor cron job logs for unauthorized access
4. ✅ Only the database has access to this key (not exposed to clients)

## 🧪 Testing Cron Jobs

### Test Monthly Accrual Manually
```sql
SELECT net.http_post(
  url := 'https://exzxmdsrfnsnqzzddcip.supabase.co/functions/v1/leave-accruals',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
  ),
  body := jsonb_build_object(
    'accrualType', 'monthly'
  )
) AS request_id;
```

### Test Eligibility Check Manually
```sql
SELECT net.http_post(
  url := 'https://exzxmdsrfnsnqzzddcip.supabase.co/functions/v1/leave-accruals',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
  ),
  body := jsonb_build_object(
    'accrualType', 'eligibility'
  )
) AS request_id;
```

## 📊 Monitoring

### View Cron Job Status
```sql
SELECT * FROM cron.job WHERE jobname IN ('monthly-leave-accruals', 'daily-eligibility-checks');
```

### View Cron Job Run History
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname IN ('monthly-leave-accruals', 'daily-eligibility-checks')
)
ORDER BY start_time DESC
LIMIT 20;
```

### Check Edge Function Logs
- Go to Supabase Dashboard → Edge Functions → `leave-accruals` → Logs
- Filter by date/time to see cron-triggered executions

## 🔄 Next Steps

1. ✅ **Cron jobs configured** - Monthly and daily checks are set up
2. ⏭️ **Monitor first run** - Check logs after the first scheduled execution
3. ⏭️ **Verify accruals** - Confirm balances are updated correctly
4. ⏭️ **Set up alerts** - Consider adding notifications for failed cron jobs

## 🛠️ Maintenance

### Update Cron Schedule
```sql
-- Update monthly schedule (example: change to 2nd of month at 2 AM)
SELECT cron.unschedule('monthly-leave-accruals');
SELECT cron.schedule(
  'monthly-leave-accruals',
  '0 2 2 * *', -- New schedule
  $$...$$ -- Same SQL body
);
```

### Disable Cron Jobs (if needed)
```sql
SELECT cron.unschedule('monthly-leave-accruals');
SELECT cron.unschedule('daily-eligibility-checks');
```

### Re-enable Cron Jobs
Just re-run the `cron.schedule()` statements from `leave-accrual-cron-setup.sql`

