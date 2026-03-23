# Supabase Edge Function Deployment Guide

## Prerequisites

1. **Supabase CLI** - Install if you haven't already:
   ```bash
   npm install -g supabase
   # or
   brew install supabase/tap/supabase
   ```

2. **Supabase Project** - You need:
   - Your Supabase project URL
   - Your Supabase project reference ID
   - Your Supabase service role key (for Edge Function secrets)

3. **Environment Variables** - The Edge Function needs:
   - `SUPABASE_URL` - Your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin access)

## Step 1: Initialize Supabase Project (if not already done)

If you haven't linked your project yet:

```bash
# Login to Supabase
supabase login

# Link to your project (you'll be prompted to select from your projects)
supabase link --project-ref your-project-ref
```

Or manually create a `supabase/config.toml` file:

```toml
project_id = "your-project-ref"
```

## Step 2: Environment Variables (Automatic)

**Good news!** Supabase automatically provides these environment variables to Edge Functions:
- `SUPABASE_URL` - Automatically set to your project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically set to your service role key

**You don't need to set these manually!** The Edge Function runtime automatically injects them.

The function code already uses these via `Deno.env.get('SUPABASE_URL')` and `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`, so no additional configuration is needed.

## Step 3: Deploy the Edge Function

Deploy the `leave-accruals` function:

```bash
# From the project root directory
supabase functions deploy leave-accruals
```

This will:
- Upload the function code
- Set up the Deno runtime environment
- Make it available at: `https://your-project-ref.supabase.co/functions/v1/leave-accruals`

## Step 4: Verify Deployment

Test the function manually:

```bash
# Get your function URL
curl -X POST https://your-project-ref.supabase.co/functions/v1/leave-accruals \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json" \
  -d '{"accrualType": "monthly"}'
```

Or test with a specific employee:

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/leave-accruals \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json" \
  -d '{
    "accrualType": "monthly",
    "employeeId": "employee-uuid-here"
  }'
```

## Step 5: Set Up Cron Schedule (Optional)

### Option A: Using Supabase Dashboard

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create a new cron job:
   - **Name**: `monthly-leave-accruals`
   - **Schedule**: `0 0 1 * *` (1st of every month at midnight UTC)
   - **SQL**:
   ```sql
   SELECT net.http_post(
     url := 'https://your-project-ref.supabase.co/functions/v1/leave-accruals',
     headers := jsonb_build_object(
       'Content-Type', 'application/json',
       'Authorization', 'Bearer your-service-role-key'
     ),
     body := jsonb_build_object(
       'accrualType', 'monthly'
     )
   ) AS request_id;
   ```

### Option B: Using SQL Script

Run the SQL script in `database/leave-accrual-cron-setup.sql`:

```bash
# Connect to your Supabase database and run:
psql -h db.your-project-ref.supabase.co -U postgres -d postgres -f database/leave-accrual-cron-setup.sql
```

**Note**: Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` in the SQL file first!

### Option C: External Cron (GitHub Actions, Vercel, etc.)

Set up a scheduled job that calls the function URL monthly. See the README in `supabase/functions/leave-accruals/README.md` for examples.

## Step 6: Monitor Function Logs

View function logs in Supabase Dashboard:

1. Go to Supabase Dashboard → Edge Functions → `leave-accruals`
2. Click on "Logs" tab
3. Monitor for errors or successful executions

Or via CLI:

```bash
supabase functions logs leave-accruals
```

## Troubleshooting

### Function Not Found
- Make sure you've deployed: `supabase functions deploy leave-accruals`
- Check the function name matches exactly

### Authentication Errors
- Edge Functions automatically get `SUPABASE_SERVICE_ROLE_KEY` - no manual setup needed
- If you see auth errors, check that the function is deployed correctly
- Verify the function has access to your database tables

### Database Errors
- Ensure `leave_accrual_history` table exists (run `database/leave-accrual-history-table.sql`)
- Check that `leave_balances` table has the correct schema
- Verify RLS policies allow service role access

### Date/Time Issues
- Edge Functions run in UTC timezone
- Adjust cron schedule if you need a different timezone

## Function URL Structure

Once deployed, your function will be available at:

```
https://your-project-ref.supabase.co/functions/v1/leave-accruals
```

## Environment Variables Reference

The function uses these environment variables (automatically provided by Supabase):

- `SUPABASE_URL` - Your Supabase project URL (auto-injected)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access (auto-injected)

**No manual configuration needed!** Supabase Edge Functions automatically provide these when the function runs.

## Updating the Function

To update the function after making changes:

```bash
# Make your changes to supabase/functions/leave-accruals/index.ts
# Then redeploy:
supabase functions deploy leave-accruals
```

## Testing Locally (Optional)

You can test the function locally before deploying:

```bash
# Start local Supabase (requires Docker)
supabase start

# Serve the function locally
supabase functions serve leave-accruals

# Test locally
curl -X POST http://localhost:54321/functions/v1/leave-accruals \
  -H "Authorization: Bearer your-local-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"accrualType": "monthly"}'
```

## Next Steps

1. ✅ Deploy the function
2. ✅ Set up cron schedule
3. ✅ Test with a single employee
4. ✅ Monitor first monthly run
5. ✅ Verify accrual history records are created
6. ✅ Check leave balances are updated correctly

## Support

For issues or questions:
- Check Supabase Edge Functions docs: https://supabase.com/docs/guides/functions
- Review function logs in Supabase Dashboard
- Check the README in `supabase/functions/leave-accruals/README.md`

