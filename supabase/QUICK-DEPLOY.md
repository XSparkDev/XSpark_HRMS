# Quick Deploy Reference

## One-Time Setup

```bash
# 1. Install Supabase CLI (if not installed)
npm install -g supabase
# or
brew install supabase/tap/supabase

# 2. Login to Supabase
supabase login

# 3. Link your project
supabase link --project-ref your-project-ref
```

## Deploy Function

```bash
# Option 1: Use the deployment script
./supabase/deploy-function.sh

# Option 2: Manual deployment
supabase functions deploy leave-accruals
```

## Environment Variables (Automatic - No Setup Needed!)

✅ **Supabase automatically provides these to Edge Functions:**
- `SUPABASE_URL` - Your project URL (auto-injected)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (auto-injected)

**No secrets to set!** The function code already uses these automatically.

## Test Function

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/leave-accruals \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json" \
  -d '{"accrualType": "monthly"}'
```

## Set Up Monthly Cron

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create new cron job with SQL from `database/leave-accrual-cron-setup.sql`
3. Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` in the SQL

## Function URL

```
https://your-project-ref.supabase.co/functions/v1/leave-accruals
```

## View Logs

```bash
# Via CLI
supabase functions logs leave-accruals

# Via Dashboard
# Supabase Dashboard → Edge Functions → leave-accruals → Logs
```

