-- ============================================================================
-- UPDATE ACCRUAL REASON CONSTRAINT
-- ============================================================================
-- This updates the check constraint on leave_accrual_history.accrual_reason
-- to allow the new values we're using: 'eligibility_grant' and 'cycle_reset'
-- ============================================================================

-- First, drop the existing constraint (if it exists)
-- You'll need to find the constraint name first:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'leave_accrual_history'::regclass AND contype = 'c';

-- Example (replace 'leave_accrual_history_accrual_reason_check' with actual constraint name):
-- ALTER TABLE leave_accrual_history DROP CONSTRAINT IF EXISTS leave_accrual_history_accrual_reason_check;

-- Then add new constraint with all allowed values:
ALTER TABLE leave_accrual_history 
DROP CONSTRAINT IF EXISTS leave_accrual_history_accrual_reason_check;

ALTER TABLE leave_accrual_history 
ADD CONSTRAINT leave_accrual_history_accrual_reason_check 
CHECK (accrual_reason IN ('monthly', 'instant', 'special', 'eligibility_grant', 'cycle_reset'));

-- Verify the constraint:
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'leave_accrual_history'::regclass
  AND contype = 'c'
  AND conname LIKE '%accrual_reason%';

