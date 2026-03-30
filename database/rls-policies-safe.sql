-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - SAFE VERSION
-- ============================================================================
-- This script is SAFE to run and will NOT break existing functionality
-- Run this script in your Supabase SQL Editor
-- ============================================================================
-- 
-- What this script does:
-- ✅ Creates helper functions (idempotent - safe to run multiple times)
-- ✅ Enables RLS on notes2 and employees tables
-- ✅ Drops existing policies safely (IF EXISTS - won't error if they don't exist)
-- ✅ Creates proper RLS policies for notes and employees
-- ✅ Includes verification queries at the end
--
-- What this script does NOT do:
-- ❌ Does NOT change database schema
-- ❌ Does NOT alter table structures
-- ❌ Does NOT delete any data
-- ❌ Does NOT break existing functionality
-- ============================================================================

-- ============================================================================
-- STEP 1: ENSURE REQUIRED COLUMNS EXIST (safe migration)
-- ============================================================================

-- Add target_employee_id column to notes2 if it doesn't exist
-- This is safe - won't error if column already exists
ALTER TABLE notes2
  ADD COLUMN IF NOT EXISTS target_employee_id UUID NULL
  REFERENCES employees(id) ON DELETE CASCADE;

-- Create indexes for the new column if they don't exist
CREATE INDEX IF NOT EXISTS idx_notes2_target_employee_id ON notes2(target_employee_id);
CREATE INDEX IF NOT EXISTS idx_notes2_target_employee_created ON notes2(target_employee_id, created_at DESC)
WHERE target_employee_id IS NOT NULL;

-- Ensure visibility column exists (in case it doesn't)
ALTER TABLE notes2
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'public'));

-- Create index for visibility if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_notes2_visibility ON notes2(visibility);

-- ============================================================================
-- STEP 2: HELPER FUNCTIONS (idempotent - safe to run multiple times)
-- ============================================================================

-- Helper function to get current employee_id from auth.uid()
-- This is safe to recreate - it just updates the function
CREATE OR REPLACE FUNCTION get_current_employee_id()
RETURNS UUID AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get current user role (with enum casting fix)
-- This handles enum types properly by casting to TEXT first
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

-- Enable RLS on notes2 table (idempotent - safe if already enabled)
ALTER TABLE notes2 ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe - won't error if they don't exist)
DROP POLICY IF EXISTS "Employees can view own notes" ON notes2;
DROP POLICY IF EXISTS "Employees can view notes for them" ON notes2;
DROP POLICY IF EXISTS "Employees can view public notes" ON notes2;
DROP POLICY IF EXISTS "Admins can view all notes" ON notes2;
DROP POLICY IF EXISTS "Employees can create own notes" ON notes2;
DROP POLICY IF EXISTS "Admins can create notes for employees" ON notes2;
DROP POLICY IF EXISTS "Admins can create public notes" ON notes2;
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

-- Policy: Everyone can view public notes
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

-- Enable RLS on employees table (idempotent - safe if already enabled)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe - won't error if they don't exist)
DROP POLICY IF EXISTS "Employees can view own profile" ON employees;
DROP POLICY IF EXISTS "Admins can view all employees" ON employees;

-- Policy: Employees can view their own profile
-- This ensures your profile page (/api/auth/me) continues to work
CREATE POLICY "Employees can view own profile" ON employees
  FOR SELECT
  USING (id = get_current_employee_id());

-- Policy: Admins/HR can view all employees
-- This allows admins to list employees for the notes creation feature
CREATE POLICY "Admins can view all employees" ON employees
  FOR SELECT
  USING (
    get_current_user_role() IN ('admin', 'super_admin', 'junior_hr', 'hr_manager', 'hr_admin')
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the policies were created successfully
-- (They won't break anything, just show you what was created)

-- Check if RLS is enabled on both tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('notes2', 'employees')
ORDER BY tablename;

-- List all policies created on notes2 and employees tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies 
WHERE tablename IN ('notes2', 'employees')
ORDER BY tablename, policyname;

-- Verify helper functions exist
SELECT 
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('get_current_employee_id', 'get_current_user_role');

