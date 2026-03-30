-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Run this script in your Supabase SQL Editor to enable proper RLS policies
-- for the notes and employees tables
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS (if they don't exist)
-- ============================================================================

-- Helper function to get current employee_id from auth.uid()
CREATE OR REPLACE FUNCTION get_current_employee_id()
RETURNS UUID AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
  SELECT LOWER(r.role_name::TEXT) 
  FROM employees e
  JOIN roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES FOR NOTES2 TABLE
-- ============================================================================

-- Enable RLS on notes2 table
ALTER TABLE notes2 ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Employees can view own notes" ON notes2;
DROP POLICY IF EXISTS "Employees can view notes for them" ON notes2;
DROP POLICY IF EXISTS "Employees can view public notes" ON notes2;
DROP POLICY IF EXISTS "Admins can view all notes" ON notes2;
DROP POLICY IF EXISTS "Employees can create own notes" ON notes2;
DROP POLICY IF EXISTS "Admins can create notes for employees" ON notes2;
DROP POLICY IF EXISTS "Employees can update own notes" ON notes2;
DROP POLICY IF EXISTS "Admins can update any notes" ON notes2;
DROP POLICY IF EXISTS "Employees can delete own notes" ON notes2;
DROP POLICY IF EXISTS "Admins can delete any notes" ON notes2;

-- Policy: Employees can view their own notes (where employee_id = their id)
CREATE POLICY "Employees can view own notes" ON notes2
  FOR SELECT
  USING (
    employee_id = get_current_employee_id()
    AND (target_employee_id IS NULL OR target_employee_id = get_current_employee_id())
  );

-- Policy: Employees can view notes created for them (where target_employee_id = their id)
CREATE POLICY "Employees can view notes for them" ON notes2
  FOR SELECT
  USING (target_employee_id = get_current_employee_id());

-- Policy: Employees can view public notes
CREATE POLICY "Employees can view public notes" ON notes2
  FOR SELECT
  USING (visibility = 'public');

-- Policy: Admins/HR can view all notes
CREATE POLICY "Admins can view all notes" ON notes2
  FOR SELECT
  USING (
    get_current_user_role() IN ('admin', 'super_admin', 'junior_hr', 'hr_manager', 'hr_admin')
  );

-- Policy: Employees can create their own notes
CREATE POLICY "Employees can create own notes" ON notes2
  FOR INSERT
  WITH CHECK (employee_id = get_current_employee_id());

-- Policy: Admins/HR can create notes for employees (with target_employee_id)
CREATE POLICY "Admins can create notes for employees" ON notes2
  FOR INSERT
  WITH CHECK (
    get_current_user_role() IN ('admin', 'super_admin', 'junior_hr')
    AND (
      target_employee_id IS NULL 
      OR target_employee_id != get_current_employee_id()
    )
  );

-- Policy: Admins/HR can create public notes
CREATE POLICY "Admins can create public notes" ON notes2
  FOR INSERT
  WITH CHECK (
    get_current_user_role() IN ('admin', 'super_admin', 'junior_hr', 'hr_manager', 'hr_admin')
    AND visibility = 'public'
  );

-- Policy: Employees can update their own notes
CREATE POLICY "Employees can update own notes" ON notes2
  FOR UPDATE
  USING (employee_id = get_current_employee_id())
  WITH CHECK (employee_id = get_current_employee_id());

-- Policy: Admins/HR can update any notes
CREATE POLICY "Admins can update any notes" ON notes2
  FOR UPDATE
  USING (
    get_current_user_role() IN ('admin', 'super_admin', 'junior_hr', 'hr_manager', 'hr_admin')
  )
  WITH CHECK (
    get_current_user_role() IN ('admin', 'super_admin', 'junior_hr', 'hr_manager', 'hr_admin')
  );

-- Policy: Employees can delete their own notes
CREATE POLICY "Employees can delete own notes" ON notes2
  FOR DELETE
  USING (employee_id = get_current_employee_id());

-- Policy: Admins/HR can delete any notes
CREATE POLICY "Admins can delete any notes" ON notes2
  FOR DELETE
  USING (
    get_current_user_role() IN ('admin', 'super_admin', 'junior_hr', 'hr_manager', 'hr_admin')
  );

-- ============================================================================
-- RLS POLICIES FOR EMPLOYEES TABLE
-- ============================================================================

-- Enable RLS on employees table
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Employees can view own profile" ON employees;
DROP POLICY IF EXISTS "Admins can view all employees" ON employees;
DROP POLICY IF EXISTS "Admins can list employees" ON employees;

-- Policy: Employees can view their own profile
CREATE POLICY "Employees can view own profile" ON employees
  FOR SELECT
  USING (id = get_current_employee_id());

-- Policy: Admins/HR can view all employees (needed for employee list in notes creation)
CREATE POLICY "Admins can view all employees" ON employees
  FOR SELECT
  USING (
    get_current_user_role() IN ('admin', 'super_admin', 'junior_hr', 'hr_manager', 'hr_admin')
  );

-- Policy: Admins/HR can list active employees (specific policy for employee listing)
CREATE POLICY "Admins can list employees" ON employees
  FOR SELECT
  USING (
    is_active = TRUE
    AND get_current_user_role() IN ('admin', 'super_admin', 'junior_hr')
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('notes2', 'employees')
ORDER BY tablename;

-- Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('notes2', 'employees')
ORDER BY tablename, policyname;

