### Leave Management Testing SQL

Below are the SQL statements used during leave management testing.  
They are preserved here for reference and can be reused or adapted as needed.

```sql
-- New employee joins on 2026-01-15

INSERT INTO employees (
    id,
    auth_user_id,
    employee_id,
    first_name,
    middle_name,
    last_name,
    preferred_name,
    email,
    dob,
    sex,
    nationality,
    id_number,  -- Added: SA ID number (dummy for test)
    date_hired,
    employment_status,
    is_active,
    role_id,
    documents
) VALUES (
    gen_random_uuid(),
    gen_random_uuid(),
    'XSP27/01/001',
    'Thami',
    null,
    'Mabaso',
    null,
    'thami.mabaso@company.com',
    '1994-02-21',
    'female',
    'South Africa',
    '9402210123084',  -- Valid SA ID format: YYMMDDGGGGSAAZ
    '2026-01-14',
    'probation',
    true,
    '903cc455-488f-4be7-81f4-c8024373a5cd',
    '[]'
);

-----------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------

-- Annual Leave Balance (monthly accrual: 1 day/month, max 12/year)
INSERT INTO leave_balances (
    employee_id,
    leave_type_id,
    cycle_start_date,
    cycle_end_date,
    total_accrued,
    total_used,
    total_pending,
    carried_over
) VALUES (
    (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001'),
    (SELECT id FROM leave_types WHERE key = 'annual'),
    '2026-01-14',  -- Start from hire date
    '2027-01-13',  -- 12-month cycle
    0.00,          -- No accrual yet (happens monthly)
    0.00,
    0.00,
    0.00
);

-- Sick Leave Balance (special accrual: 1 day per 26 days worked, 36-month cycle)
INSERT INTO leave_balances (
    employee_id,
    leave_type_id,
    cycle_start_date,
    cycle_end_date,
    total_accrued,
    total_used,
    total_pending,
    carried_over
) VALUES (
    (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001'),
    (SELECT id FROM leave_types WHERE key = 'sick'),
    '2026-01-14',
    '2029-01-13',  -- 36-month cycle
    0.00,
    0.00,
    0.00,
    0.00
);

-- Unpaid Leave (no accrual, unlimited)
INSERT INTO leave_balances (
    employee_id,
    leave_type_id,
    cycle_start_date,
    cycle_end_date,
    total_accrued,
    total_used,
    total_pending,
    carried_over
) VALUES (
    (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001'),
    (SELECT id FROM leave_types WHERE key = 'unpaid'),
    '2026-01-14',
    '2027-01-13',
    999.00,  -- Effectively unlimited
    0.00,
    0.00,
    0.00
);

-----------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------

-- Accrue 1 day of annual leave
INSERT INTO leave_accrual_history (
    employee_id,
    leave_type_id,
    balance_id,
    accrual_date,
    amount,
    accrual_reason,
    notes
) VALUES (
    (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001'),
    (SELECT id FROM leave_types WHERE key = 'annual'),
    (SELECT id FROM leave_balances 
     WHERE employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
     AND leave_type_id = (SELECT id FROM leave_types WHERE key = 'annual')),
    '2026-02-15',
    1.00,
    'monthly',
    'Monthly accrual for January 2026'
);

-- Update balance
UPDATE leave_balances
SET total_accrued = total_accrued + 1.00
WHERE employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
AND leave_type_id = (SELECT id FROM leave_types WHERE key = 'annual');

-- Sick leave accrual (1 day per 26 working days)
-- Assuming ~22 working days in Jan = 0.85 days
INSERT INTO leave_accrual_history (
    employee_id,
    leave_type_id,
    balance_id,
    accrual_date,
    amount,
    accrual_reason,
    notes
) VALUES (
    (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001'),
    (SELECT id FROM leave_types WHERE key = 'sick'),
    (SELECT id FROM leave_balances 
     WHERE employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
     AND leave_type_id = (SELECT id FROM leave_types WHERE key = 'sick')),
    '2026-02-15',
    0.85,
    'monthly',
    'Sick leave accrual: 22 working days / 26'
);

UPDATE leave_balances
SET total_accrued = total_accrued + 0.85
WHERE employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
AND leave_type_id = (SELECT id FROM leave_types WHERE key = 'sick');

-----------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------

-- Family Responsibility: instant accrual of 3 days
INSERT INTO leave_balances (
    employee_id,
    leave_type_id,
    cycle_start_date,
    cycle_end_date,
    total_accrued,
    total_used,
    total_pending,
    carried_over
) VALUES (
    (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001'),
    (SELECT id FROM leave_types WHERE key = 'family_responsibility'),
    '2026-05-15',
    '2027-05-14',  -- 12-month cycle
    3.00,          -- Instant accrual
    0.00,
    0.00,
    0.00
);

-- Record accrual history
INSERT INTO leave_accrual_history (
    employee_id,
    leave_type_id,
    balance_id,
    accrual_date,
    amount,
    accrual_reason,
    notes
) VALUES (
    (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001'),
    (SELECT id FROM leave_types WHERE key = 'family_responsibility'),
    (SELECT id FROM leave_balances 
     WHERE employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
     AND leave_type_id = (SELECT id FROM leave_types WHERE key = 'family_responsibility')),
    '2026-05-15',
    3.00,
    'instant',
    'Eligibility reached: 4 months of service'
);

-----------------------------------------------------------------------------------------------------
-----------------------------------------------------------------------------------------------------

-- Submit leave request
WITH new_leave AS (
    INSERT INTO leave_requests (
        id,
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        total_days,
        reason,
        status,
        submitted_by,
        document_required
    )
    SELECT
        gen_random_uuid(),
        e.id,
        lt.id,
        '2026-08-07',
        '2026-08-14',
        calculate_working_days('2026-08-07', '2026-08-14'),
        'Family vacation',
        'pending',
        e.id,
        false
    FROM employees e
    JOIN leave_types lt ON lt.key = 'annual'
    WHERE e.employee_id = 'XSP27/01/001'
    RETURNING id, employee_id, leave_type_id, start_date, end_date, total_days
),
calendar_rows AS (
    INSERT INTO leave_calendar (leave_request_id, employee_id, leave_date, is_half_day)
    SELECT
        nl.id,
        nl.employee_id,
        d::date,
        false
    FROM new_leave nl
    CROSS JOIN generate_series(nl.start_date, nl.end_date, interval '1 day') d
    WHERE calculate_working_days(d::date, d::date) = 1
    RETURNING 1
)
UPDATE leave_balances lb
SET total_pending = lb.total_pending + nl.total_days
FROM new_leave nl
WHERE lb.employee_id = nl.employee_id
  AND lb.leave_type_id = nl.leave_type_id;

-------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------

-- Approve the request
UPDATE leave_requests
SET 
    status = 'approved',
    reviewed_by = (SELECT id FROM employees WHERE employee_id = 'XSP25/11/005'),
    reviewed_at = '2026-06-02 10:30:00',
    review_notes = 'Approved - team coverage arranged'
WHERE employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
AND start_date = '2026-06-16';

-- Move from pending to used
UPDATE leave_balances
SET 
    total_pending = total_pending - calculate_working_days('2026-06-16', '2026-06-18'),
    total_used = total_used + calculate_working_days('2026-06-16', '2026-06-18')
WHERE employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
AND leave_type_id = (SELECT id FROM leave_types WHERE key = 'annual');

-- Reject the request
BEGIN;

-- 1️⃣ Mark request as rejected
UPDATE leave_requests
SET 
    status = 'rejected',
    reviewed_by = (SELECT id FROM employees WHERE employee_id = 'XSP25/11/005'),
    reviewed_at = '2026-06-02 10:30:00',
    review_notes = 'Rejected - business needs'
WHERE employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
  AND start_date = '2026-12-20'
  AND status = 'pending';

-- 2️⃣ Release pending balance
UPDATE leave_balances
SET 
    total_pending = total_pending - calculate_working_days('2026-12-20', '2027-01-30')
WHERE employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
  AND leave_type_id = (SELECT id FROM leave_types WHERE key = 'family_responsibility');

-- 3️⃣ Remove calendar rows for this request
DELETE FROM leave_calendar lc
USING leave_requests lr
WHERE lc.leave_request_id = lr.id
  AND lr.employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
  AND lr.start_date = '2026-12-20';

COMMIT;

-------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------

-- Submit sick leave request
BEGIN;

WITH params AS (
    SELECT
        DATE '2026-12-20' AS v_start_date,
        DATE '2026-12-30' AS v_end_date,
        'XSP27/01/001'::varchar AS emp_code,
        calculate_working_days(DATE '2026-12-20', DATE '2027-01-30')::numeric AS v_working_days,
        e.id AS employee_id,
        lt.id AS leave_type_id
    FROM employees e
    JOIN leave_types lt ON lt.key = 'family_responsibility'
    WHERE e.employee_id = 'XSP27/01/001'
),

new_request AS (
    INSERT INTO leave_requests (
        id,
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        total_days,
        reason,
        status,
        submitted_by,
        document_required
    )
    SELECT
        gen_random_uuid(),
        p.employee_id,
        p.leave_type_id,
        p.v_start_date,
        p.v_end_date,
        p.v_working_days,
        'Funeral',
        'pending',
        p.employee_id,
        true
    FROM params p
    RETURNING id, employee_id
),

calendar_insert AS (
    INSERT INTO leave_calendar (leave_request_id, employee_id, leave_date, is_half_day)
    SELECT
        nr.id,
        nr.employee_id,
        d::date,
        false
    FROM new_request nr
    JOIN params p ON p.employee_id = nr.employee_id
    JOIN generate_series(p.v_start_date, p.v_end_date, interval '1 day') d
        ON EXTRACT(ISODOW FROM d) < 6
    RETURNING 1
),

balance_update AS (
    UPDATE leave_balances lb
    SET total_pending = total_pending + p.v_working_days
    FROM params p
    WHERE lb.employee_id = p.employee_id
      AND lb.leave_type_id = p.leave_type_id
    RETURNING 1
)

SELECT 
    nr.id        AS leave_request_id,
    p.v_working_days,
    p.v_start_date,
    p.v_end_date
FROM new_request nr
JOIN params p ON true;

COMMIT;

-------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------

-- Check current balances
SELECT * FROM v_current_leave_balances 
WHERE employee_number = 'XSP27/01/001';

-- Check all requests
SELECT 
    lt.display_name,
    lr.start_date,
    lr.end_date,
    lr.total_days,
    lr.status,
    lr.submitted_at
FROM leave_requests lr
JOIN leave_types lt ON lr.leave_type_id = lt.id
WHERE lr.employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
ORDER BY lr.start_date;

-------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------

SELECT 
    lt.display_name,
    lah.accrual_date,
    lah.amount,
    lah.accrual_reason,
    lah.notes
FROM leave_accrual_history lah
JOIN leave_types lt ON lah.leave_type_id = lt.id
WHERE lah.employee_id = (SELECT id FROM employees WHERE employee_id = 'XSP27/01/001')
ORDER BY lah.accrual_date;

-------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------

-- -----------------------------------HELPER TESTS--------------------------------------------------------

-- SELECT 
--   count_non_working_days('2026-09-01', '2027-03-01') AS non_working_days,
--   calculate_working_days('2026-09-01', '2027-03-01') AS working_days;

-- select * from employees where first_name='Thami' role_id='f871fedb-a6eb-4e60-9672-0dd7ad859dbd'

-- -----------------------------------HELPER TESTS--------------------------------------------------------

-------------------------------------------------------------------------------------------------------
```


