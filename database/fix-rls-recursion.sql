-- ============================================================================
-- FIX RLS POLICY RECURSION - For Existing AMS Databases
-- ============================================================================
-- Run this if you already ran ams-migration.sql and are getting 
-- "infinite recursion detected in policy" errors
-- ============================================================================

-- Drop problematic policies that cause recursion
DROP POLICY IF EXISTS "Admins can do anything with users" ON public.users;
DROP POLICY IF EXISTS "Supervisors can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Supervisors can update any booking" ON public.bookings;
DROP POLICY IF EXISTS "Admins and Supervisors can manage resources" ON public.resources;
DROP POLICY IF EXISTS "Admins can view all scan logs" ON public.scan_logs;

-- Create the security definer function to check user roles
-- This bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION check_user_role(user_id UUID, required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id
    AND role = ANY(required_roles)
  );
END;
$$;

-- Recreate users policies with the function
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL USING (check_user_role(auth.uid(), ARRAY['Admin']::TEXT[]));

-- Recreate resources policies with the function
-- DROP first if exists
DROP POLICY IF EXISTS "Admins and Supervisors can manage resources" ON public.resources;

-- Create separate policies for different operations
CREATE POLICY "Admins and Supervisors can insert resources" ON public.resources
  FOR INSERT WITH CHECK (check_user_role(auth.uid(), ARRAY['Admin', 'Supervisor']::TEXT[]));

CREATE POLICY "Admins and Supervisors can update resources" ON public.resources
  FOR UPDATE USING (check_user_role(auth.uid(), ARRAY['Admin', 'Supervisor']::TEXT[]));

CREATE POLICY "Admins and Supervisors can delete resources" ON public.resources
  FOR DELETE USING (check_user_role(auth.uid(), ARRAY['Admin', 'Supervisor']::TEXT[]));

-- Recreate bookings policies with the function
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;

CREATE POLICY "Users can view their own bookings" ON public.bookings
  FOR SELECT USING (
    booked_by = auth.uid() 
    OR check_user_role(auth.uid(), ARRAY['Admin', 'Supervisor']::TEXT[])
  );

CREATE POLICY "Users can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (booked_by = auth.uid());

CREATE POLICY "Users can update their own bookings" ON public.bookings
  FOR UPDATE USING (
    booked_by = auth.uid()
    OR check_user_role(auth.uid(), ARRAY['Admin', 'Supervisor']::TEXT[])
  );

-- Recreate scan_logs policies with the function
DROP POLICY IF EXISTS "Users can view their own scan logs" ON public.scan_logs;

CREATE POLICY "Users can view their own scan logs" ON public.scan_logs
  FOR SELECT USING (
    scanned_by = auth.uid()
    OR check_user_role(auth.uid(), ARRAY['Admin', 'Supervisor']::TEXT[])
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies updated successfully!';
    RAISE NOTICE '   The check_user_role function now prevents infinite recursion.';
    RAISE NOTICE '   Test your API requests to verify they work correctly.';
END $$;

-- ============================================================================
-- DONE
-- ============================================================================
-- Your policies are now fixed. The check_user_role function uses 
-- SECURITY DEFINER to bypass RLS when checking user roles, preventing
-- the infinite recursion error.
-- ============================================================================

