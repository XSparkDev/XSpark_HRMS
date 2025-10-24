-- Temporarily disable encryption trigger for testing
-- Run this in Supabase SQL Editor

DROP TRIGGER IF EXISTS encrypt_employee_sensitive_data ON employees;

-- Test data insertion
INSERT INTO employees (
    first_name, 
    last_name, 
    email, 
    dob, 
    sex, 
    nationality, 
    id_number, 
    employee_id, 
    employment_status, 
    date_hired, 
    is_active
) VALUES (
    'Test', 
    'User', 
    'test@example.com', 
    '1990-01-01', 
    'male', 
    'South Africa', 
    '9001011234567', 
    'TEST001', 
    'active', 
    '2023-01-01', 
    true
);

-- Re-enable the trigger (optional)
-- CREATE TRIGGER encrypt_employee_sensitive_data
-- BEFORE INSERT OR UPDATE ON employees
-- FOR EACH ROW EXECUTE FUNCTION encrypt_sensitive_data();
