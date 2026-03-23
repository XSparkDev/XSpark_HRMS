-- Check what constraint exists on accrual_reason
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'leave_accrual_history'::regclass
  AND contype = 'c';

-- If you need to see the actual allowed values, check the constraint definition
-- Common patterns:
-- CHECK (accrual_reason IN ('monthly', 'instant', 'special'))
-- or
-- CHECK (accrual_reason ~ '^(monthly|instant|special)$')

