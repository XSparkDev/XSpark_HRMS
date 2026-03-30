-- Migration: add target_employee_id support to notes2
-- This allows admins/HR to create notes specifically for certain employees

ALTER TABLE notes2
  ADD COLUMN IF NOT EXISTS target_employee_id UUID NULL
  REFERENCES employees(id) ON DELETE CASCADE;

-- Create index for efficient queries on notes for specific employees
CREATE INDEX IF NOT EXISTS idx_notes2_target_employee_id ON notes2(target_employee_id);

-- Create composite index for "For You" notes queries
CREATE INDEX IF NOT EXISTS idx_notes2_target_employee_created ON notes2(target_employee_id, created_at DESC)
WHERE target_employee_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR NOTES2
-- ============================================================================
-- Enable RLS if not already enabled
ALTER TABLE notes2 ENABLE ROW LEVEL SECURITY;

-- Helper function to get current employee_id from auth.uid()
CREATE OR REPLACE FUNCTION get_current_employee_id()
RETURNS UUID AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
  SELECT r.role_name 
  FROM employees e
  JOIN roles r ON e.role_id = r.id
  WHERE e.auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

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
    AND target_employee_id IS NOT NULL
    AND target_employee_id != get_current_employee_id()
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

