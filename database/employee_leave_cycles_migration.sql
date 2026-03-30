-- ============================================================================
-- EMPLOYEE LEAVE CYCLES MIGRATION
-- ============================================================================
-- This script assumes:
--   - Existing leave_balances table populated with data
--   - New employee_leave_cycles table already created
--   - leave_types table exists with (id, key) where key matches leave_type_enum
-- Run this in Supabase SQL editor (or psql) during a controlled maintenance window.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Step 1: Backfill employee_leave_cycles from existing leave_balances
-- --------------------------------------------------------------------------

INSERT INTO employee_leave_cycles (
    employee_id,
    leave_type_id,
    cycle_start_date,
    cycle_end_date,
    cycle_number,
    days_worked_count,
    total_entitled,
    current_balance,
    created_at,
    updated_at
)
SELECT
    lb.employee_id,
    lt.id AS leave_type_id,
    lb.cycle_start_date,
    lb.cycle_end_date,
    1 AS cycle_number,
    0 AS days_worked_count,
    lb.total_entitled,
    lb.balance AS current_balance,
    lb.created_at,
    lb.updated_at
FROM leave_balances lb
JOIN leave_types lt
  ON lt.key::leave_type_enum = lb.leave_type
ON CONFLICT (employee_id, leave_type_id, cycle_start_date) DO NOTHING;

-- Optional: basic validation samples (uncomment to inspect)
-- SELECT e.employee_id AS emp_no, lb.leave_type, lb.balance AS old_balance,
--        elc.current_balance AS new_balance
-- FROM leave_balances lb
-- JOIN employees e ON e.id = lb.employee_id
-- JOIN leave_types lt ON lt.key::leave_type_enum = lb.leave_type
-- JOIN employee_leave_cycles elc
--   ON elc.employee_id = lb.employee_id
--  AND elc.leave_type_id = lt.id
--  AND elc.cycle_start_date = lb.cycle_start_date
-- LIMIT 50;

-- --------------------------------------------------------------------------
-- Step 2: Replace physical leave_balances table with a VIEW
-- --------------------------------------------------------------------------

-- 2.1. Rename existing leave_balances table to keep a backup
ALTER TABLE leave_balances RENAME TO leave_balances_legacy;

-- 2.2. Create a compatibility VIEW named leave_balances
CREATE VIEW leave_balances AS
SELECT
    elc.id,
    elc.employee_id,
    lt.key::leave_type_enum AS leave_type,
    elc.total_entitled,
    (elc.total_entitled - elc.current_balance) AS total_taken,
    elc.current_balance AS balance,
    elc.cycle_start_date,
    elc.cycle_end_date,
    FALSE AS cap_warning_sent,
    elc.created_at,
    elc.updated_at
FROM employee_leave_cycles elc
JOIN leave_types lt ON lt.id = elc.leave_type_id;

COMMIT;


