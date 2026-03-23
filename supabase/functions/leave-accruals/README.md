# Leave Accruals Edge Function

This Supabase Edge Function handles automated leave accruals for all active employees.

## Features

### Monthly Accruals
- **Annual Leave**: 1 day per month (accrued on the 1st of each month)
- **Sick Leave**: 1 day per 26 working days (calculated based on working days in previous month)

### Eligibility-Based Accruals
- **Family Responsibility Leave**: 3 days when employee reaches 4 months of service

## Deployment

### 1. Deploy the Function

```bash
# Make sure you have Supabase CLI installed
supabase functions deploy leave-accruals

# Or if using Deno Deploy directly
deno deploy --project=your-project leave-accruals/index.ts
```

### 2. Set Environment Variables

In Supabase Dashboard -> Edge Functions -> Settings, ensure these are set:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (for admin access)

### 3. Set Up Cron Schedule

#### Option A: Supabase Cron (Recommended)
In Supabase Dashboard -> Database -> Cron Jobs, create a new cron job:

```sql
-- Run on the 1st of every month at 00:00 UTC
SELECT cron.schedule(
  'monthly-leave-accruals',
  '0 0 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/leave-accruals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object(
      'accrualType', 'monthly'
    )
  ) AS request_id;
  $$
);
```

#### Option B: External Cron (e.g., GitHub Actions, Vercel Cron)
Set up a scheduled job that calls the function URL:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/leave-accruals \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"accrualType": "monthly"}'
```

## Manual Invocation

### Process All Accruals (Monthly + Eligibility)
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/leave-accruals \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Process Only Monthly Accruals
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/leave-accruals \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"accrualType": "monthly"}'
```

### Process Only Eligibility-Based Accruals
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/leave-accruals \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"accrualType": "eligibility"}'
```

### Process Specific Employee
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/leave-accruals \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "employee-uuid-here"}'
```

### Process with Custom Date
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/leave-accruals \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"accrualDate": "2026-02-15"}'
```

## Response Format

```json
{
  "success": true,
  "message": "Leave accruals processed",
  "date": "2026-02-15",
  "workingDays": 22,
  "summary": {
    "totalEmployees": 10,
    "totalAccruals": 20,
    "successfulAccruals": 18,
    "failedAccruals": 2
  },
  "results": [
    {
      "employeeId": "uuid",
      "employeeNumber": "XSP27/01/001",
      "accruals": [
        {
          "type": "annual",
          "amount": 1.0,
          "success": true
        },
        {
          "type": "sick",
          "amount": 0.85,
          "success": true
        },
        {
          "type": "family_responsibility",
          "amount": 3.0,
          "success": false,
          "error": "Family responsibility leave already accrued"
        }
      ]
    }
  ]
}
```

## How It Works

1. **Fetches Active Employees**: Gets all employees with `employment_status = 'active'`
2. **Calculates Working Days**: For sick leave, calculates working days in the previous month
3. **Processes Accruals**:
   - Annual leave: +1 day per employee
   - Sick leave: + (workingDays / 26) days per employee
   - Family responsibility: +3 days if employee has 4+ months of service and hasn't received it yet
4. **Records History**: All accruals are logged in `leave_accrual_history` table
5. **Updates Balances**: Updates `leave_balances.total_accrued` for each leave type

## Error Handling

- If a leave type is not found, that accrual is skipped (logged in results)
- If a balance doesn't exist, that accrual fails (logged in results)
- The function continues processing other employees even if one fails
- All errors are logged in the response for debugging

## Testing

Test locally with Deno:

```bash
deno run --allow-net --allow-env supabase/functions/leave-accruals/index.ts
```

Or test the deployed function:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/leave-accruals \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"accrualType": "monthly", "employeeId": "test-employee-uuid"}'
```

