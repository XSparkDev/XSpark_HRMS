# South African Sick Leave Implementation Plan

## Current Problem
The current implementation accrues sick leave monthly (1 day per 26 working days), which is incorrect for South African labor law.

## Correct SA Sick Leave Rules (BCEA Section 22)

### Phase 1: First 6 Months (0-6 months)
- **Accrual**: 1 day per month (maximum 6 days total)
- **Usage**: Days can be used during this period
- **Tracking**: Must track `total_used` separately from accrual

### Phase 2: At 6 Months (6 months + 1 day)
- **Grant**: Full 30 days are granted (not accrued incrementally)
- **Deduction**: Any days used in first 6 months are deducted from the 30
- **Formula**: `total_accrued = 30`, `total_used = days_used_in_first_6_months`
- **Balance**: `30 - total_used`

### Phase 3: 36-Month Cycle (6 months to 42 months)
- **Duration**: 36 months from when employee hit 6 months
- **No Carryover**: Unused days are lost at cycle end
- **No Additional Accrual**: No monthly accrual during this period

### Phase 4: Cycle Reset (After 36 months)
- **Reset**: Grant another 30 days
- **Deduction**: Any remaining days from previous cycle are NOT carried over
- **New Cycle**: Starts fresh 36-month period

## Examples

### Example 1: No Early Usage
- **0-6 months**: Accrues 6 days, uses 0 → Balance: 6 days
- **At 6 months**: Gets 30 days → Balance: 30 days (6 days from first phase are replaced)
- **After 6 months**: Can use up to 30 days over 36 months

### Example 2: Early Usage
- **0-6 months**: Accrues 6 days, uses 3 → Balance: 3 days
- **At 6 months**: Gets 30 days, but 3 already used → Balance: 27 days (30 - 3)
- **After 6 months**: Can use remaining 27 days over 36 months

### Example 3: Cycle Reset
- **Month 0-6**: 6 days accrued, 0 used
- **Month 6**: 30 days granted, balance = 30
- **Month 42 (36 months later)**: Cycle resets
  - Old balance: 5 days remaining → **Lost** (no carryover)
  - New grant: 30 days → Balance: 30 days (fresh start)

## Implementation Strategy

### 1. Database Schema Updates

#### Option A: Use Existing `leave_balances` Table
- `cycle_start_date`: When employee hit 6 months (or hire date if already eligible)
- `cycle_end_date`: cycle_start_date + 36 months
- `total_accrued`: 
  - 0-6 months: Monthly accrual (1 day/month, max 6)
  - At 6 months: Set to 30
  - After 6 months: Remains 30 until cycle reset
- `total_used`: Tracks all sick days used (including during first 6 months)
- `total_pending`: Pending requests

#### Option B: Add New Fields (if needed)
- `six_month_eligibility_date`: Date when employee becomes eligible for 30 days
- `cycle_activated`: Boolean flag to track if 30-day grant has been activated
- `pre_eligibility_used`: Days used before 6 months (for audit)

**Recommendation**: Use Option A with existing fields, add `six_month_eligibility_date` for clarity.

### 2. Accrual Logic Flow

```
Function: accrueSickLeave(employeeId, accrualDate, dateHired)

1. Calculate months of service
   months = (accrualDate - dateHired) in months

2. Get current balance record
   balance = getLeaveBalance(employeeId, 'sick')

3. If months < 6:
   a. Calculate monthly accrual (1 day for this month)
   b. Check if already accrued this month (prevent double accrual)
   c. If not accrued: total_accrued += 1 (max 6)
   d. Record in accrual_history

4. If months >= 6 AND cycle not activated:
   a. Set total_accrued = 30
   b. Keep existing total_used (days used in first 6 months)
   c. Set cycle_start_date = date when they hit 6 months
   d. Set cycle_end_date = cycle_start_date + 36 months
   e. Set six_month_eligibility_date = date when they hit 6 months
   f. Record in accrual_history as 'eligibility_grant'
   g. Mark cycle as activated

5. If months >= 6 AND cycle activated:
   a. Check if cycle_end_date has passed
   b. If cycle ended:
      - Reset: total_accrued = 30, total_used = 0
      - Set new cycle_start_date = today
      - Set new cycle_end_date = today + 36 months
      - Record in accrual_history as 'cycle_reset'
   c. If cycle not ended:
      - No accrual (already have 30 days)

6. Return success/error
```

### 3. Edge Function Updates

#### New Function: `accrueSickLeaveSA`
Replace the current `accrueSickLeave` function with SA-compliant logic:

```typescript
async function accrueSickLeaveSA(
  supabase: any,
  employeeId: string,
  accrualDate: string,
  dateHired: string,
): Promise<{ success: boolean; amount: number; error?: string }> {
  // 1. Calculate months of service
  const hired = new Date(dateHired)
  const accrual = new Date(accrualDate)
  const monthsDiff = (accrual.getFullYear() - hired.getFullYear()) * 12 + 
                     (accrual.getMonth() - hired.getMonth())
  
  // 2. Get current balance
  const balance = await getSickLeaveBalance(supabase, employeeId)
  
  // 3. Handle < 6 months case
  if (monthsDiff < 6) {
    return await accrueSickLeavePreEligibility(supabase, employeeId, accrualDate, balance)
  }
  
  // 4. Handle >= 6 months case
  if (monthsDiff >= 6) {
    // Check if 30-day grant has been activated
    if (!balance.cycle_activated || balance.six_month_eligibility_date === null) {
      return await activateSickLeaveCycle(supabase, employeeId, accrualDate, dateHired, balance)
    }
    
    // Check if cycle needs reset (36 months passed)
    const cycleEnd = new Date(balance.cycle_end_date)
    if (accrual > cycleEnd) {
      return await resetSickLeaveCycle(supabase, employeeId, accrualDate, balance)
    }
    
    // Cycle active, no accrual needed
    return { success: true, amount: 0, error: 'Cycle active, no accrual needed' }
  }
}
```

#### Helper Functions Needed:
1. `accrueSickLeavePreEligibility`: Handles 0-6 months accrual (1 day/month)
2. `activateSickLeaveCycle`: Grants 30 days at 6 months, deducts early usage
3. `resetSickLeaveCycle`: Resets cycle after 36 months
4. `getSickLeaveBalance`: Gets current sick leave balance with all fields

### 4. Service Method Updates

Update `lib/services/leave-service.ts`:
- Replace `accrueSickLeave` method with SA-compliant version
- Add helper methods for each phase
- Update initialization to set correct cycle dates

### 5. Database Migration (if needed)

If we need to add `six_month_eligibility_date` or `cycle_activated`:

```sql
ALTER TABLE leave_balances 
ADD COLUMN IF NOT EXISTS six_month_eligibility_date DATE,
ADD COLUMN IF NOT EXISTS cycle_activated BOOLEAN DEFAULT FALSE;
```

### 6. Testing Scenarios

#### Test Case 1: New Employee (No Early Usage)
- Hire date: 2026-01-01
- Month 1 accrual: +1 day → Balance: 1
- Month 2 accrual: +1 day → Balance: 2
- ...
- Month 6 accrual: +1 day → Balance: 6
- Month 6 + 1 day: Activate cycle → Balance: 30 (6 replaced with 30)

#### Test Case 2: Early Usage
- Hire date: 2026-01-01
- Month 1-3: Accrues 3 days, uses 2 → Balance: 1
- Month 4-6: Accrues 3 more days → Balance: 4
- Month 6 + 1 day: Activate cycle → Balance: 28 (30 - 2 used)

#### Test Case 3: Cycle Reset
- Cycle started: 2026-07-01
- Cycle ends: 2029-07-01 (36 months later)
- At reset: Old balance 5 days → Lost, New balance: 30 days

## Implementation Steps

1. ✅ **Update Edge Function** (`supabase/functions/leave-accruals/index.ts`)
   - Replace `accrueSickLeave` with `accrueSickLeaveSA`
   - Add helper functions for each phase
   - Update main handler to pass `dateHired` to sick leave accrual

2. ✅ **Update Service Method** (`lib/services/leave-service.ts`)
   - Replace `accrueSickLeave` with SA-compliant version
   - Add helper methods

3. ✅ **Database Migration** (if needed)
   - Add `six_month_eligibility_date` and `cycle_activated` columns
   - Update existing records if necessary

4. ✅ **Update Initialization** (`initializeCoreLeaveBalancesForNewEmployee`)
   - Set correct initial values for sick leave
   - Set cycle dates appropriately

5. ✅ **Testing**
   - Test all scenarios above
   - Test edge cases (exactly 6 months, exactly 36 months, etc.)

## Key Considerations

1. **Prevent Double Accrual**: Check if month already accrued before adding
2. **Track Early Usage**: Must track `total_used` during first 6 months
3. **Cycle Dates**: `cycle_start_date` should be when they hit 6 months, not hire date
4. **No Carryover**: When cycle resets, old balance is lost (set to 0)
5. **Audit Trail**: All changes should be logged in `leave_accrual_history`

## Questions to Resolve

1. **Cycle Start Date**: Should `cycle_start_date` be:
   - Option A: Date when employee hit 6 months (recommended)
   - Option B: Employee hire date
   - **Recommendation**: Option A (when they become eligible for 30 days)

2. **Existing Employees**: How to handle employees already past 6 months?
   - Set `cycle_activated = true`
   - Set `total_accrued = 30`
   - Calculate `cycle_start_date` and `cycle_end_date` based on their hire date

3. **Monthly Accrual Check**: How to prevent double accrual in same month?
   - Check `leave_accrual_history` for existing accrual in current month
   - Or track last accrual date in balance record

