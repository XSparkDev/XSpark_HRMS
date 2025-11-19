-- ============================================================================
-- ASSIGNED DEVICES DATABASE SCHEMA
-- ============================================================================
-- This script creates the database schema for tracking device assignments
-- in the Asset Management System (AMS).
-- ============================================================================
-- Created: 2025
-- Database: PostgreSQL 15+ (Supabase compatible)
-- ============================================================================

BEGIN;

-- ============================================================================
-- ENUMS FOR ASSIGNED DEVICES
-- ============================================================================

-- Assignment status enum
CREATE TYPE assignment_status_enum AS ENUM (
    'pending',        -- Assignment request pending approval
    'approved',       -- Assignment approved and active
    'active',         -- Device currently assigned
    'returned',       -- Device returned
    'overdue',        -- Device not returned by expected date
    'cancelled',      -- Assignment cancelled
    'rejected'        -- Assignment request rejected
);

-- Assignment type enum
CREATE TYPE assignment_type_enum AS ENUM (
    'permanent',      -- Permanent assignment to employee
    'temporary',      -- Temporary assignment (borrowing)
    'loan',           -- Short-term loan
    'repair'          -- Device sent for repair
);

-- Device condition enum
CREATE TYPE device_condition_enum AS ENUM (
    'excellent',      -- Like new
    'good',           -- Minor wear
    'fair',           -- Visible wear but functional
    'poor',           -- Significant wear/damage
    'damaged',        -- Damaged, needs repair
    'unusable'        -- Not usable
);

-- ============================================================================
-- TABLE: assigned_devices
-- ============================================================================
-- Purpose: Tracks all device assignments to employees
-- Relationships:
--   - device_id -> devices(id)
--   - employee_id -> employees(id)
--   - assigned_by -> employees(id) (supervisor/admin who made assignment)
--   - approved_by -> employees(id) (supervisor/admin who approved)
-- ============================================================================

CREATE TABLE assigned_devices (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Foreign Keys
    device_id UUID NOT NULL,                    -- References devices(id)
    employee_id UUID NOT NULL,                  -- References employees(id) - who the device is assigned to
    assigned_by UUID,                           -- References employees(id) - who created the assignment
    approved_by UUID,                           -- References employees(id) - who approved the assignment
    
    -- Assignment Details
    assignment_type assignment_type_enum NOT NULL DEFAULT 'temporary',
    status assignment_status_enum NOT NULL DEFAULT 'pending',
    
    -- Dates
    assigned_date TIMESTAMPTZ DEFAULT NOW(),    -- When assignment was created/approved
    expected_return_date DATE,                  -- When device should be returned (NULL for permanent)
    actual_return_date TIMESTAMPTZ,             -- When device was actually returned
    
    -- Condition Tracking
    assigned_condition device_condition_enum DEFAULT 'good',  -- Condition when assigned
    returned_condition device_condition_enum,                 -- Condition when returned
    
    -- Purpose and Notes
    purpose TEXT,                               -- Reason for assignment (e.g., "Work from home", "Project needs")
    assignment_notes TEXT,                      -- Additional notes during assignment
    return_notes TEXT,                          -- Notes when device was returned
    
    -- Approval Workflow
    approval_required BOOLEAN DEFAULT TRUE,     -- Whether approval is required
    approval_requested_at TIMESTAMPTZ,          -- When approval was requested
    approval_status assignment_status_enum,     -- Status of approval
    approved_at TIMESTAMPTZ,                    -- When assignment was approved
    rejection_reason TEXT,                      -- Reason if rejected
    
    -- Return Tracking
    return_requested_at TIMESTAMPTZ,            -- When return was requested
    return_verified_by UUID,                    -- References employees(id) - who verified return
    return_verified_at TIMESTAMPTZ,             -- When return was verified
    
    -- Issue Tracking
    has_issues BOOLEAN DEFAULT FALSE,           -- Whether there are issues with the assignment
    issue_description TEXT,                     -- Description of issues
    reported_at TIMESTAMPTZ,                    -- When issue was reported
    
    -- Soft Delete
    deleted_at TIMESTAMPTZ,                     -- Soft delete timestamp
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_assigned_devices_device 
        FOREIGN KEY (device_id) 
        REFERENCES devices(id) 
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_assigned_devices_employee 
        FOREIGN KEY (employee_id) 
        REFERENCES employees(id) 
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_assigned_devices_assigned_by 
        FOREIGN KEY (assigned_by) 
        REFERENCES employees(id) 
        ON DELETE SET NULL,
    
    CONSTRAINT fk_assigned_devices_approved_by 
        FOREIGN KEY (approved_by) 
        REFERENCES employees(id) 
        ON DELETE SET NULL,
    
    CONSTRAINT fk_assigned_devices_return_verified_by 
        FOREIGN KEY (return_verified_by) 
        REFERENCES employees(id) 
        ON DELETE SET NULL,
    
    -- Business Logic Constraints
    CONSTRAINT chk_assigned_dates 
        CHECK (assigned_date IS NULL OR assigned_date <= COALESCE(actual_return_date, NOW())),
    
    CONSTRAINT chk_return_dates 
        CHECK (
            expected_return_date IS NULL OR 
            actual_return_date IS NULL OR 
            actual_return_date >= assigned_date
        ),
    
    CONSTRAINT chk_permanent_assignment 
        CHECK (
            assignment_type != 'permanent' OR 
            (expected_return_date IS NULL AND actual_return_date IS NULL)
        ),
    
    CONSTRAINT chk_return_condition 
        CHECK (
            actual_return_date IS NULL OR 
            returned_condition IS NOT NULL
        )
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX idx_assigned_devices_device_id ON assigned_devices(device_id);
CREATE INDEX idx_assigned_devices_employee_id ON assigned_devices(employee_id);
CREATE INDEX idx_assigned_devices_status ON assigned_devices(status);
CREATE INDEX idx_assigned_devices_assignment_type ON assigned_devices(assignment_type);

-- Composite indexes for common queries
CREATE INDEX idx_assigned_devices_employee_status ON assigned_devices(employee_id, status);
CREATE INDEX idx_assigned_devices_device_status ON assigned_devices(device_id, status);
CREATE INDEX idx_assigned_devices_assigned_date ON assigned_devices(assigned_date DESC);

-- Date-based queries
CREATE INDEX idx_assigned_devices_expected_return ON assigned_devices(expected_return_date) 
    WHERE expected_return_date IS NOT NULL;
CREATE INDEX idx_assigned_devices_actual_return ON assigned_devices(actual_return_date) 
    WHERE actual_return_date IS NOT NULL;

-- Active assignments lookup
CREATE INDEX idx_assigned_devices_active ON assigned_devices(device_id, employee_id) 
    WHERE status IN ('approved', 'active') AND deleted_at IS NULL;

-- Overdue assignments
CREATE INDEX idx_assigned_devices_overdue ON assigned_devices(expected_return_date, status) 
    WHERE expected_return_date < CURRENT_DATE 
    AND status IN ('approved', 'active') 
    AND deleted_at IS NULL;

-- Approval workflow
CREATE INDEX idx_assigned_devices_pending_approval ON assigned_devices(status, approval_required) 
    WHERE status = 'pending' AND approval_required = TRUE;

-- Soft delete
CREATE INDEX idx_assigned_devices_deleted ON assigned_devices(deleted_at) 
    WHERE deleted_at IS NOT NULL;

-- Full-text search on notes
CREATE INDEX idx_assigned_devices_notes_search ON assigned_devices 
    USING gin(to_tsvector('english', COALESCE(purpose, '') || ' ' || COALESCE(assignment_notes, '') || ' ' || COALESCE(return_notes, '')));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_assigned_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_assigned_devices_updated_at
    BEFORE UPDATE ON assigned_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_assigned_devices_updated_at();

-- Auto-update device status when assignment is created/updated
CREATE OR REPLACE FUNCTION update_device_status_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- When assignment is approved/active, update device status to 'assigned'
    IF NEW.status IN ('approved', 'active') AND (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'active')) THEN
        UPDATE devices 
        SET status = 'assigned', 
            assigned_to = NEW.employee_id,
            updated_at = NOW()
        WHERE id = NEW.device_id;
    END IF;
    
    -- When assignment is returned, update device status to 'available'
    IF NEW.status = 'returned' AND OLD.status != 'returned' THEN
        UPDATE devices 
        SET status = CASE 
            WHEN NEW.returned_condition IN ('damaged', 'unusable') THEN 'maintenance'
            ELSE 'available'
        END,
        assigned_to = NULL,
        condition = NEW.returned_condition::text,
        updated_at = NOW()
        WHERE id = NEW.device_id;
    END IF;
    
    -- When assignment is cancelled/rejected, free up the device
    IF NEW.status IN ('cancelled', 'rejected') AND OLD.status = 'pending' THEN
        UPDATE devices 
        SET status = 'available',
            updated_at = NOW()
        WHERE id = NEW.device_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_device_status_on_assignment
    AFTER INSERT OR UPDATE ON assigned_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_device_status_on_assignment();

-- Prevent duplicate active assignments for the same device
CREATE OR REPLACE FUNCTION prevent_duplicate_active_assignments()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
BEGIN
    -- Check if device already has an active assignment
    IF NEW.status IN ('approved', 'active') THEN
        SELECT COUNT(*) INTO active_count
        FROM assigned_devices
        WHERE device_id = NEW.device_id
        AND status IN ('approved', 'active')
        AND deleted_at IS NULL
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
        
        IF active_count > 0 THEN
            RAISE EXCEPTION 'Device already has an active assignment. Please return the device before assigning it to another employee.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_duplicate_active_assignments
    BEFORE INSERT OR UPDATE ON assigned_devices
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_active_assignments();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Active Device Assignments
-- Shows all currently active device assignments with employee and device details
CREATE OR REPLACE VIEW active_device_assignments AS
SELECT 
    ad.id AS assignment_id,
    ad.device_id,
    d.asset_tag,
    d.serial_number,
    d.device_type,
    d.brand,
    d.model,
    ad.employee_id,
    e.employee_id AS employee_number,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.email AS employee_email,
    ad.assigned_by,
    assigned_by_emp.first_name || ' ' || assigned_by_emp.last_name AS assigned_by_name,
    ad.assignment_type,
    ad.status,
    ad.assigned_date,
    ad.expected_return_date,
    ad.assigned_condition,
    ad.purpose,
    ad.assignment_notes,
    CASE 
        WHEN ad.expected_return_date IS NOT NULL 
        THEN ad.expected_return_date - CURRENT_DATE
        ELSE NULL
    END AS days_until_return,
    CASE 
        WHEN ad.expected_return_date IS NOT NULL 
        AND ad.expected_return_date < CURRENT_DATE 
        AND ad.status IN ('approved', 'active')
        THEN TRUE
        ELSE FALSE
    END AS is_overdue
FROM assigned_devices ad
INNER JOIN devices d ON ad.device_id = d.id
INNER JOIN employees e ON ad.employee_id = e.id
LEFT JOIN employees assigned_by_emp ON ad.assigned_by = assigned_by_emp.id
WHERE ad.status IN ('approved', 'active')
AND ad.deleted_at IS NULL
ORDER BY ad.assigned_date DESC;

-- View: Device Assignment History
-- Complete history of all assignments for a device
CREATE OR REPLACE VIEW device_assignment_history AS
SELECT 
    ad.id AS assignment_id,
    ad.device_id,
    d.asset_tag,
    d.device_type,
    d.brand || ' ' || d.model AS device_name,
    ad.employee_id,
    e.employee_id AS employee_number,
    e.first_name || ' ' || e.last_name AS employee_name,
    ad.assignment_type,
    ad.status,
    ad.assigned_date,
    ad.expected_return_date,
    ad.actual_return_date,
    ad.assigned_condition,
    ad.returned_condition,
    ad.purpose,
    CASE 
        WHEN ad.actual_return_date IS NOT NULL 
        THEN ad.actual_return_date - ad.assigned_date
        WHEN ad.expected_return_date IS NOT NULL
        THEN CURRENT_DATE - ad.assigned_date
        ELSE CURRENT_DATE - ad.assigned_date
    END AS assignment_duration_days,
    ad.created_at,
    ad.updated_at
FROM assigned_devices ad
INNER JOIN devices d ON ad.device_id = d.id
INNER JOIN employees e ON ad.employee_id = e.id
WHERE ad.deleted_at IS NULL
ORDER BY ad.assigned_date DESC;

-- View: Employee Device Assignments
-- All devices assigned to a specific employee
CREATE OR REPLACE VIEW employee_device_assignments AS
SELECT 
    ad.id AS assignment_id,
    ad.employee_id,
    e.employee_id AS employee_number,
    e.first_name || ' ' || e.last_name AS employee_name,
    ad.device_id,
    d.asset_tag,
    d.serial_number,
    d.device_type,
    d.brand,
    d.model,
    d.location,
    ad.assignment_type,
    ad.status,
    ad.assigned_date,
    ad.expected_return_date,
    ad.actual_return_date,
    ad.assigned_condition,
    ad.returned_condition,
    ad.purpose,
    ad.assignment_notes,
    ad.has_issues,
    ad.issue_description
FROM assigned_devices ad
INNER JOIN employees e ON ad.employee_id = e.id
INNER JOIN devices d ON ad.device_id = d.id
WHERE ad.deleted_at IS NULL
ORDER BY 
    CASE 
        WHEN ad.status IN ('approved', 'active') THEN 0
        ELSE 1
    END,
    ad.assigned_date DESC;

-- View: Pending Approvals
-- All assignments waiting for approval
CREATE OR REPLACE VIEW pending_device_assignments AS
SELECT 
    ad.id AS assignment_id,
    ad.device_id,
    d.asset_tag,
    d.device_type,
    d.brand || ' ' || d.model AS device_name,
    ad.employee_id,
    e.employee_id AS employee_number,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.email AS employee_email,
    ad.assigned_by,
    assigned_by_emp.first_name || ' ' || assigned_by_emp.last_name AS assigned_by_name,
    ad.assignment_type,
    ad.status,
    ad.assigned_date,
    ad.expected_return_date,
    ad.purpose,
    ad.assignment_notes,
    ad.approval_requested_at,
    ad.created_at
FROM assigned_devices ad
INNER JOIN devices d ON ad.device_id = d.id
INNER JOIN employees e ON ad.employee_id = e.id
LEFT JOIN employees assigned_by_emp ON ad.assigned_by = assigned_by_emp.id
WHERE ad.status = 'pending'
AND ad.approval_required = TRUE
AND ad.deleted_at IS NULL
ORDER BY ad.approval_requested_at DESC NULLS LAST;

-- View: Overdue Assignments
-- All assignments that are past their expected return date
CREATE OR REPLACE VIEW overdue_device_assignments AS
SELECT 
    ad.id AS assignment_id,
    ad.device_id,
    d.asset_tag,
    d.serial_number,
    d.device_type,
    d.brand || ' ' || d.model AS device_name,
    ad.employee_id,
    e.employee_id AS employee_number,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.email AS employee_email,
    e.phone AS employee_phone,
    ad.assignment_type,
    ad.assigned_date,
    ad.expected_return_date,
    CURRENT_DATE - ad.expected_return_date AS days_overdue,
    ad.purpose,
    ad.assignment_notes
FROM assigned_devices ad
INNER JOIN devices d ON ad.device_id = d.id
INNER JOIN employees e ON ad.employee_id = e.id
WHERE ad.status IN ('approved', 'active')
AND ad.expected_return_date IS NOT NULL
AND ad.expected_return_date < CURRENT_DATE
AND ad.deleted_at IS NULL
ORDER BY ad.expected_return_date ASC;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get devices available for assignment
CREATE OR REPLACE FUNCTION get_available_devices(
    p_device_type VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    device_id UUID,
    asset_tag VARCHAR,
    serial_number VARCHAR,
    device_type VARCHAR,
    brand VARCHAR,
    model VARCHAR,
    condition VARCHAR,
    location VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.asset_tag,
        d.serial_number,
        d.device_type,
        d.brand,
        d.model,
        d.condition,
        d.location
    FROM devices d
    WHERE d.status = 'available'
    AND d.deleted_at IS NULL
    AND (p_device_type IS NULL OR d.device_type = p_device_type)
    AND NOT EXISTS (
        SELECT 1 
        FROM assigned_devices ad 
        WHERE ad.device_id = d.id 
        AND ad.status IN ('approved', 'active')
        AND ad.deleted_at IS NULL
    )
    ORDER BY d.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function: Get employee's assigned devices
CREATE OR REPLACE FUNCTION get_employee_assigned_devices(
    p_employee_id UUID
)
RETURNS TABLE (
    assignment_id UUID,
    device_id UUID,
    asset_tag VARCHAR,
    device_type VARCHAR,
    brand VARCHAR,
    model VARCHAR,
    status assignment_status_enum,
    assigned_date TIMESTAMPTZ,
    expected_return_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ad.id,
        ad.device_id,
        d.asset_tag,
        d.device_type,
        d.brand,
        d.model,
        ad.status,
        ad.assigned_date,
        ad.expected_return_date
    FROM assigned_devices ad
    INNER JOIN devices d ON ad.device_id = d.id
    WHERE ad.employee_id = p_employee_id
    AND ad.status IN ('approved', 'active')
    AND ad.deleted_at IS NULL
    ORDER BY ad.assigned_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Create device assignment
CREATE OR REPLACE FUNCTION create_device_assignment(
    p_device_id UUID,
    p_employee_id UUID,
    p_assigned_by UUID,
    p_assignment_type assignment_type_enum DEFAULT 'temporary',
    p_expected_return_date DATE DEFAULT NULL,
    p_purpose TEXT DEFAULT NULL,
    p_assignment_notes TEXT DEFAULT NULL,
    p_approval_required BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
    v_assignment_id UUID;
    v_device_status VARCHAR;
BEGIN
    -- Check if device exists and is available
    SELECT status INTO v_device_status
    FROM devices
    WHERE id = p_device_id
    AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found';
    END IF;
    
    IF v_device_status != 'available' THEN
        RAISE EXCEPTION 'Device is not available for assignment. Current status: %', v_device_status;
    END IF;
    
    -- Create assignment
    INSERT INTO assigned_devices (
        device_id,
        employee_id,
        assigned_by,
        assignment_type,
        status,
        expected_return_date,
        purpose,
        assignment_notes,
        approval_required,
        approval_requested_at
    ) VALUES (
        p_device_id,
        p_employee_id,
        p_assigned_by,
        p_assignment_type,
        CASE WHEN p_approval_required THEN 'pending' ELSE 'approved' END,
        p_expected_return_date,
        p_purpose,
        p_assignment_notes,
        p_approval_required,
        CASE WHEN p_approval_required THEN NOW() ELSE NULL END
    )
    RETURNING id INTO v_assignment_id;
    
    RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Approve device assignment
CREATE OR REPLACE FUNCTION approve_device_assignment(
    p_assignment_id UUID,
    p_approved_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_status assignment_status_enum;
BEGIN
    -- Get current status
    SELECT status INTO v_status
    FROM assigned_devices
    WHERE id = p_assignment_id
    AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment not found';
    END IF;
    
    IF v_status != 'pending' THEN
        RAISE EXCEPTION 'Assignment is not pending approval. Current status: %', v_status;
    END IF;
    
    -- Update assignment
    UPDATE assigned_devices
    SET status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        assigned_date = NOW()
    WHERE id = p_assignment_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Return device
CREATE OR REPLACE FUNCTION return_device_assignment(
    p_assignment_id UUID,
    p_returned_condition device_condition_enum,
    p_return_notes TEXT DEFAULT NULL,
    p_verified_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_status assignment_status_enum;
BEGIN
    -- Get current status
    SELECT status INTO v_status
    FROM assigned_devices
    WHERE id = p_assignment_id
    AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment not found';
    END IF;
    
    IF v_status NOT IN ('approved', 'active', 'overdue') THEN
        RAISE EXCEPTION 'Assignment cannot be returned. Current status: %', v_status;
    END IF;
    
    -- Update assignment
    UPDATE assigned_devices
    SET status = 'returned',
        actual_return_date = NOW(),
        returned_condition = p_returned_condition,
        return_notes = p_return_notes,
        return_verified_by = p_verified_by,
        return_verified_at = CASE WHEN p_verified_by IS NOT NULL THEN NOW() ELSE NULL END
    WHERE id = p_assignment_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE assigned_devices IS 'Tracks all device assignments to employees, including temporary loans and permanent assignments';
COMMENT ON COLUMN assigned_devices.assignment_type IS 'Type of assignment: permanent, temporary, loan, or repair';
COMMENT ON COLUMN assigned_devices.status IS 'Current status of the assignment: pending, approved, active, returned, overdue, cancelled, rejected';
COMMENT ON COLUMN assigned_devices.expected_return_date IS 'Expected return date for temporary assignments. NULL for permanent assignments';
COMMENT ON COLUMN assigned_devices.assigned_condition IS 'Condition of device when assigned';
COMMENT ON COLUMN assigned_devices.returned_condition IS 'Condition of device when returned';
COMMENT ON COLUMN assigned_devices.approval_required IS 'Whether supervisor approval is required for this assignment';

COMMENT ON VIEW active_device_assignments IS 'Shows all currently active device assignments with employee and device details';
COMMENT ON VIEW device_assignment_history IS 'Complete history of all assignments for devices';
COMMENT ON VIEW employee_device_assignments IS 'All devices assigned to employees';
COMMENT ON VIEW pending_device_assignments IS 'All assignments waiting for supervisor approval';
COMMENT ON VIEW overdue_device_assignments IS 'All assignments that are past their expected return date';

-- ============================================================================
-- GRANT PERMISSIONS (Adjust based on your RLS policies)
-- ============================================================================

-- Grant SELECT to authenticated users
-- GRANT SELECT ON assigned_devices TO authenticated;
-- GRANT SELECT ON active_device_assignments TO authenticated;
-- GRANT SELECT ON device_assignment_history TO authenticated;
-- GRANT SELECT ON employee_device_assignments TO authenticated;
-- GRANT SELECT ON pending_device_assignments TO authenticated;
-- GRANT SELECT ON overdue_device_assignments TO authenticated;

-- Grant EXECUTE on functions to authenticated users
-- GRANT EXECUTE ON FUNCTION get_available_devices TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_employee_assigned_devices TO authenticated;
-- GRANT EXECUTE ON FUNCTION create_device_assignment TO authenticated;
-- GRANT EXECUTE ON FUNCTION approve_device_assignment TO authenticated;
-- GRANT EXECUTE ON FUNCTION return_device_assignment TO authenticated;

COMMIT;

-- ============================================================================
-- SCHEMA CREATION COMPLETE
-- ============================================================================
-- 
-- ✅ assigned_devices table created
-- ✅ 3 ENUMs created (assignment_status_enum, assignment_type_enum, device_condition_enum)
-- ✅ 12+ indexes created for optimal query performance
-- ✅ 3 triggers created (updated_at, device status update, duplicate prevention)
-- ✅ 5 views created for common queries
-- ✅ 5 helper functions created
-- ✅ Comprehensive constraints and validations
-- 
-- NEXT STEPS:
-- 1. Ensure devices table exists before running this script
-- 2. Configure RLS policies in Supabase dashboard
-- 3. Test the functions and triggers
-- 4. Create API endpoints to use these functions
-- ============================================================================







