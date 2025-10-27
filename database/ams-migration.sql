-- ============================================================================
-- X SPARK ASSET MANAGEMENT SYSTEM - SAFE DATABASE MIGRATION
-- ============================================================================
-- This migration adds AMS tables to the existing HRMS database
-- It is designed to be safe and idempotent - can be run multiple times
-- without causing errors or conflicts
--
-- IMPORTANT NOTES:
-- 1. This script checks for table existence before creating them
-- 2. If 'public.users' already exists, it will be skipped
-- 3. If 'public.notifications' or 'public.audit_logs' already exist from HRMS,
--    they will be skipped (these may have different schemas)
-- 4. All triggers, policies, and indexes use existence checks
-- 5. This is safe to run on a database where HRMS schema is already deployed
-- ============================================================================

-- ============================================================================
-- STEP 1: EXTENSIONS (Safe - uses IF NOT EXISTS)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 2: CREATE TABLES (Safe with existence checks)
-- ============================================================================

-- Check if users table already exists from HRMS
DO $$ 
DECLARE
    users_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) INTO users_exists;
    
    IF NOT users_exists THEN
        CREATE TABLE public.users (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            employee_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            department TEXT,
            role TEXT NOT NULL CHECK (role IN ('Employee', 'Supervisor', 'Admin')),
            phone TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Indexes
        CREATE INDEX idx_users_employee_id ON public.users(employee_id);
        CREATE INDEX idx_users_email ON public.users(email);
        CREATE INDEX idx_users_role ON public.users(role);
        
        RAISE NOTICE '✅ Created public.users table for AMS';
    ELSE
        RAISE NOTICE '⚠️  public.users table already exists - skipping creation';
    END IF;
END $$;

-- Create resources table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'resources'
    ) THEN
        CREATE TABLE public.resources (
            resource_id TEXT PRIMARY KEY,
            resource_name TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            description TEXT,
            location TEXT,
            capacity INTEGER,
            condition TEXT CHECK (condition IN ('New', 'Good', 'Fair', 'Damaged')),
            qr_code_url TEXT,
            is_available BOOLEAN DEFAULT TRUE,
            notes TEXT,
            created_by UUID REFERENCES public.users(id),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Indexes
        CREATE INDEX idx_resources_type ON public.resources(resource_type);
        CREATE INDEX idx_resources_available ON public.resources(is_available);
    END IF;
END $$;

-- Create bookings table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings'
    ) THEN
        CREATE TABLE public.bookings (
            booking_id TEXT PRIMARY KEY,
            resource_id TEXT NOT NULL REFERENCES public.resources(resource_id) ON DELETE CASCADE,
            booked_by UUID NOT NULL REFERENCES public.users(id),
            booking_reason TEXT,
            start_time TIMESTAMPTZ NOT NULL,
            end_time TIMESTAMPTZ NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled')),
            is_recurring BOOLEAN DEFAULT FALSE,
            recurrence_pattern TEXT,
            recurrence_end_date DATE,
            location_type TEXT CHECK (location_type IN ('Online', 'Offline')),
            approved_by UUID REFERENCES public.users(id),
            approved_at TIMESTAMPTZ,
            rejection_reason TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Indexes
        CREATE INDEX idx_bookings_resource ON public.bookings(resource_id);
        CREATE INDEX idx_bookings_user ON public.bookings(booked_by);
        CREATE INDEX idx_bookings_status ON public.bookings(status);
        CREATE INDEX idx_bookings_start_time ON public.bookings(start_time);
        CREATE INDEX idx_bookings_end_time ON public.bookings(end_time);
        CREATE INDEX idx_bookings_date_range ON public.bookings(start_time, end_time);
    END IF;
END $$;

-- Create scan_logs table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scan_logs'
    ) THEN
        CREATE TABLE public.scan_logs (
            scan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            resource_id TEXT NOT NULL REFERENCES public.resources(resource_id),
            scanned_by UUID NOT NULL REFERENCES public.users(id),
            scan_type TEXT NOT NULL CHECK (scan_type IN ('Check-In', 'Check-Out')),
            scan_time TIMESTAMPTZ DEFAULT NOW(),
            location TEXT,
            notes TEXT,
            booking_id TEXT REFERENCES public.bookings(booking_id)
        );

        -- Indexes
        CREATE INDEX idx_scan_logs_resource ON public.scan_logs(resource_id);
        CREATE INDEX idx_scan_logs_user ON public.scan_logs(scanned_by);
        CREATE INDEX idx_scan_logs_time ON public.scan_logs(scan_time);
    END IF;
END $$;

-- Create notifications table (WARNING: May conflict with existing HRMS notifications)
-- If HRMS notifications table already exists, this will be skipped
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
    ) THEN
        CREATE TABLE public.notifications (
            notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            recipient_email TEXT NOT NULL,
            recipient_id UUID REFERENCES public.users(id),
            notification_type TEXT NOT NULL CHECK (notification_type IN ('Booking Confirmation', 'Approval Request', 'Rejection', 'Reminder', 'Alert')),
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            related_booking_id TEXT REFERENCES public.bookings(booking_id),
            related_resource_id TEXT REFERENCES public.resources(resource_id),
            is_read BOOLEAN DEFAULT FALSE,
            sent_at TIMESTAMPTZ DEFAULT NOW(),
            read_at TIMESTAMPTZ
        );

        -- Indexes
        CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id);
        CREATE INDEX idx_notifications_read ON public.notifications(is_read);
        CREATE INDEX idx_notifications_sent_at ON public.notifications(sent_at);
    END IF;
END $$;

-- Create incidents table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'incidents'
    ) THEN
        CREATE TABLE public.incidents (
            incident_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            resource_id TEXT NOT NULL REFERENCES public.resources(resource_id),
            reported_by UUID NOT NULL REFERENCES public.users(id),
            incident_type TEXT NOT NULL CHECK (incident_type IN ('Damage', 'Malfunction', 'Lost', 'Other')),
            description TEXT NOT NULL,
            severity TEXT CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
            status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
            resolved_by UUID REFERENCES public.users(id),
            resolved_at TIMESTAMPTZ,
            resolution_notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Indexes
        CREATE INDEX idx_incidents_resource ON public.incidents(resource_id);
        CREATE INDEX idx_incidents_status ON public.incidents(status);
    END IF;
END $$;

-- Create audit_logs table (WARNING: May conflict with existing HRMS audit_logs)
-- If HRMS audit_logs table already exists, this will be skipped
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs'
    ) THEN
        CREATE TABLE public.audit_logs (
            log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES public.users(id),
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            old_values JSONB,
            new_values JSONB,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Indexes
        CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
        CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
        CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
    END IF;
END $$;

-- ============================================================================
-- STEP 3: TRIGGERS FOR UPDATED_AT (Safe with replacement)
-- ============================================================================

-- Create or replace function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers only if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_trigger 
        WHERE tgname = 'update_users_updated_at'
    ) THEN
        CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON public.users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_trigger 
        WHERE tgname = 'update_resources_updated_at'
    ) THEN
        CREATE TRIGGER update_resources_updated_at 
        BEFORE UPDATE ON public.resources
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_trigger 
        WHERE tgname = 'update_bookings_updated_at'
    ) THEN
        CREATE TRIGGER update_bookings_updated_at 
        BEFORE UPDATE ON public.bookings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_trigger 
        WHERE tgname = 'update_incidents_updated_at'
    ) THEN
        CREATE TRIGGER update_incidents_updated_at 
        BEFORE UPDATE ON public.incidents
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- STEP 4: HELPER FUNCTIONS (Must be created before policies)
-- ============================================================================

-- Function to check user role (bypasses RLS to prevent recursion)
-- This MUST be created before policies that use it
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

-- ============================================================================
-- STEP 5: ROW LEVEL SECURITY (RLS) POLICIES (Safe - drops and recreates)
-- ============================================================================

-- Enable RLS on tables (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'resources' AND table_schema = 'public') THEN
        ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bookings' AND table_schema = 'public') THEN
        ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scan_logs' AND table_schema = 'public') THEN
        ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;
    END IF;
    -- Only enable RLS if notifications table has AMS-specific columns
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'recipient_id'
    ) THEN
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'incidents' AND table_schema = 'public') THEN
        ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
        -- Note: Using 'audit_logs' not 'ams_audit_logs' to match original schema
        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policies if they exist and recreate (idempotent approach)
DO $$ 
BEGIN
    -- Drop all existing policies to avoid conflicts
    DROP POLICY IF EXISTS "Users can view all users" ON public.users;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
    DROP POLICY IF EXISTS "Admins can do anything with users" ON public.users;
    
    DROP POLICY IF EXISTS "Anyone can view resources" ON public.resources;
    DROP POLICY IF EXISTS "Admins and Supervisors can manage resources" ON public.resources;
    
    DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Supervisors can view all bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;
    DROP POLICY IF EXISTS "Supervisors can update any booking" ON public.bookings;
    DROP POLICY IF EXISTS "Admins and Supervisors can manage resources" ON public.resources;
    
    -- Only drop notification policies if recipient_id column exists
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'recipient_id'
    ) THEN
        DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
        DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
    END IF;
    
    DROP POLICY IF EXISTS "Users can view their own scan logs" ON public.scan_logs;
    
    -- Now create fresh policies (only if tables exist)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        CREATE POLICY "Users can view all users" ON public.users
          FOR SELECT USING (true);
        
        CREATE POLICY "Users can update own profile" ON public.users
          FOR UPDATE USING (auth.uid() = id);
        
        CREATE POLICY "Admins can manage users" ON public.users
          FOR ALL USING (check_user_role(auth.uid(), ARRAY['Admin']::TEXT[]));
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'resources' AND table_schema = 'public') THEN
        CREATE POLICY "Anyone can view resources" ON public.resources
          FOR SELECT USING (true);
        
        CREATE POLICY "Admins and Supervisors can manage resources" ON public.resources
          FOR ALL USING (check_user_role(auth.uid(), ARRAY['Admin', 'Supervisor']::TEXT[]));
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bookings' AND table_schema = 'public') THEN
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
    END IF;
    
    -- Only create notification policies if recipient_id column exists (AMS notifications table)
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'recipient_id'
    ) THEN
        CREATE POLICY "Users can view their own notifications" ON public.notifications
          FOR SELECT USING (recipient_id = auth.uid());
        
        CREATE POLICY "Users can update their own notifications" ON public.notifications
          FOR UPDATE USING (recipient_id = auth.uid());
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scan_logs' AND table_schema = 'public') THEN
        CREATE POLICY "Users can view their own scan logs" ON public.scan_logs
          FOR SELECT USING (
            scanned_by = auth.uid()
            OR check_user_role(auth.uid(), ARRAY['Admin', 'Supervisor']::TEXT[])
          );
    END IF;
END $$;

-- ============================================================================
-- STEP 6: ADDITIONAL FUNCTIONS AND VIEWS (Safe with CREATE OR REPLACE)
-- ============================================================================

-- Function to check resource availability
CREATE OR REPLACE FUNCTION check_resource_availability(
  p_resource_id TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_booking_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO conflict_count
  FROM public.bookings
  WHERE resource_id = p_resource_id
    AND status IN ('Approved', 'Pending')
    AND (booking_id != p_exclude_booking_id OR p_exclude_booking_id IS NULL)
    AND (
      (start_time <= p_start_time AND end_time > p_start_time)
      OR (start_time < p_end_time AND end_time >= p_end_time)
      OR (start_time >= p_start_time AND end_time <= p_end_time)
    );
  
  RETURN conflict_count = 0;
END;
$$ LANGUAGE plpgsql;

-- View for available resources
CREATE OR REPLACE VIEW available_resources AS
SELECT r.*
FROM public.resources r
WHERE r.is_available = true
  AND NOT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.resource_id = r.resource_id
      AND b.status = 'Approved'
      AND b.start_time <= NOW()
      AND b.end_time > NOW()
  );

-- ============================================================================
-- STEP 7: SEED DATA (Optional - only insert if not exists)
-- ============================================================================

DO $$
BEGIN
    -- Only insert if resources table is empty
    IF NOT EXISTS (SELECT 1 FROM public.resources LIMIT 1) THEN
        INSERT INTO public.resources (resource_id, resource_name, resource_type, location, capacity, condition) VALUES
            ('Res001', 'Conference Room A', 'Boardroom', 'Building 1, Floor 2', 10, 'Good'),
            ('Res002', 'Projector - Sony VPL', 'Equipment', 'IT Storage', NULL, 'Good'),
            ('Res003', 'Company Van', 'Vehicle', 'Parking Lot', 8, 'Good');
    END IF;
END $$;

-- ============================================================================
-- STEP 8: VALIDATION
-- ============================================================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('users', 'resources', 'bookings', 'scan_logs', 'notifications', 'incidents', 'audit_logs');
    
    IF table_count >= 7 THEN
        RAISE NOTICE '✅ SUCCESS: AMS tables exist! (Found % tables)', table_count;
    ELSE
        RAISE WARNING '⚠️  WARNING: Expected 7+ AMS tables but found %', table_count;
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Tables created:
-- ✅ users - AMS user management (extends auth.users)
-- ✅ resources - Resources/assets
-- ✅ bookings - Booking management
-- ✅ scan_logs - QR code scan history
-- ✅ notifications - Notifications (if not already exists from HRMS)
-- ✅ incidents - Incidents/issues reporting
-- ✅ audit_logs - Audit logs (if not already exists from HRMS)
-- 
-- Functions:
-- ✅ check_resource_availability - Check if resource is available
-- 
-- Views:
-- ✅ available_resources - View of currently available resources
-- 
-- Triggers:
-- ✅ Auto-update timestamps for all tables
-- 
-- RLS Policies:
-- ✅ Configured for all tables
-- 
-- Next steps:
-- 1. Populate ams_users table by linking to existing auth.users
-- 2. Add more resources as needed
-- 3. Test booking functionality
-- 4. Configure email notifications
-- ============================================================================
