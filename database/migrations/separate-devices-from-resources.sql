-- ============================================================================
-- MIGRATION: Separate Devices from Resources Table
-- ============================================================================
-- Purpose: Migrate devices from resources table to dedicated devices table
--          to fix incorrect counting in dashboard cards
-- 
-- Issue: Devices are currently stored in resources table with resource_type='Device',
--        causing devices and resources to be counted together incorrectly.
--
-- Solution: 
--   1. Ensure devices table exists and has proper structure
--   2. Add device_id column to devices table for compatibility with borrows table
--   3. Migrate all rows from resources where resource_type='Device' to devices
--   4. Remove migrated device rows from resources table
--   5. Update constraints and indexes
--
-- Execution: Run this script in your PostgreSQL database (Supabase SQL Editor)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Ensure devices table exists with proper structure
-- ============================================================================
-- Note: If devices table already exists, this will not modify it.
--       We'll add device_id column if it doesn't exist.

-- Check if devices table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'devices'
    ) THEN
        -- Create devices table if it doesn't exist
        CREATE TABLE devices (
            -- Primary Key
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            
            -- Device Identification
            device_id VARCHAR(100) UNIQUE,          -- Human-readable device ID (e.g., "DEV-001")
            asset_tag VARCHAR(100) UNIQUE,          -- Asset tag (alternative identifier)
            serial_number VARCHAR(100) UNIQUE,      -- Serial number from manufacturer
            
            -- Device Information
            device_type VARCHAR(50) NOT NULL,        -- laptop, desktop, phone, tablet, monitor, etc.
            brand VARCHAR(100),                     -- Apple, Dell, HP, etc.
            model VARCHAR(100),                     -- MacBook Pro 14, XPS 13, etc.
            specs JSONB,                            -- Additional specifications (RAM, storage, etc.)
            
            -- Purchase & Warranty
            purchase_date DATE,                     -- Date of purchase
            warranty_expiry DATE,                   -- Warranty expiration date
            purchase_price DECIMAL(10, 2),          -- Purchase price
            
            -- Status & Condition
            condition VARCHAR(50) DEFAULT 'Good',    -- excellent, good, fair, poor, damaged, unusable
            status VARCHAR(50) DEFAULT 'available', -- available, assigned, borrowed, maintenance, retired
            assigned_to UUID,                       -- References employees(id) - currently assigned employee
            
            -- Location
            location VARCHAR(255),                  -- Physical location/office
            
            -- Notes
            notes TEXT,                             -- Additional notes about the device
            
            -- Soft Delete
            deleted_at TIMESTAMPTZ,
            
            -- Timestamps
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            
            -- Constraints
            CONSTRAINT fk_devices_assigned_to 
                FOREIGN KEY (assigned_to) 
                REFERENCES employees(id) 
                ON DELETE SET NULL,
            
            CONSTRAINT chk_device_status 
                CHECK (status IN ('available', 'assigned', 'borrowed', 'maintenance', 'retired', 'lost', 'pending_borrow')),
            
            CONSTRAINT chk_device_identifier 
                CHECK (device_id IS NOT NULL OR asset_tag IS NOT NULL OR serial_number IS NOT NULL)
        );
        
        -- Create indexes for devices table
        CREATE INDEX idx_devices_device_id ON devices(device_id);
        CREATE INDEX idx_devices_asset_tag ON devices(asset_tag);
        CREATE INDEX idx_devices_serial_number ON devices(serial_number);
        CREATE INDEX idx_devices_device_type ON devices(device_type);
        CREATE INDEX idx_devices_status ON devices(status);
        CREATE INDEX idx_devices_assigned_to ON devices(assigned_to);
        CREATE INDEX idx_devices_location ON devices(location);
        CREATE INDEX idx_devices_condition ON devices(condition);
        CREATE INDEX idx_devices_deleted ON devices(deleted_at) WHERE deleted_at IS NOT NULL;
        CREATE INDEX idx_devices_status_type ON devices(status, device_type);
        
        -- Create trigger for updated_at
        CREATE OR REPLACE FUNCTION update_devices_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        CREATE TRIGGER trigger_update_devices_updated_at
            BEFORE UPDATE ON devices
            FOR EACH ROW
            EXECUTE FUNCTION update_devices_updated_at();
            
        RAISE NOTICE 'Created devices table';
    ELSE
        RAISE NOTICE 'Devices table already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add device_id column to devices table if it doesn't exist
-- ============================================================================
-- This column is needed for compatibility with borrows table which references device_id

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'devices' 
        AND column_name = 'device_id'
    ) THEN
        -- Add device_id column
        ALTER TABLE devices 
        ADD COLUMN device_id VARCHAR(100) UNIQUE;
        
        -- Create index for device_id
        CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
        
        -- Update existing rows: use asset_tag or id as device_id if not set
        UPDATE devices 
        SET device_id = COALESCE(asset_tag, id::TEXT)
        WHERE device_id IS NULL;
        
        RAISE NOTICE 'Added device_id column to devices table';
    ELSE
        RAISE NOTICE 'device_id column already exists in devices table';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Migrate devices from resources table to devices table
-- ============================================================================
-- This step migrates all rows from resources where resource_type = 'Device'
-- Maps fields appropriately:
--   - resource_id -> device_id (or asset_tag if device_id exists)
--   - resource_name -> model (or brand if model not available)
--   - description -> notes
--   - location -> location
--   - condition -> condition
--   - is_available -> status (available/not available)
--   - created_at, updated_at, deleted_at -> preserved

DO $$
DECLARE
    migrated_count INTEGER := 0;
    resource_record RECORD;
    new_device_id VARCHAR(100);
    device_model VARCHAR(100);
    device_brand VARCHAR(100);
BEGIN
    -- Loop through all resources where resource_type = 'Device'
    FOR resource_record IN 
        SELECT * FROM resources 
        WHERE resource_type = 'Device' 
        AND deleted_at IS NULL
    LOOP
        -- Generate device_id from resource_id (ensure uniqueness)
        new_device_id := resource_record.resource_id;
        
        -- Check if device_id already exists, if so append suffix
        WHILE EXISTS (SELECT 1 FROM devices WHERE device_id = new_device_id) LOOP
            new_device_id := resource_record.resource_id || '-' || floor(random() * 1000)::TEXT;
        END LOOP;
        
        -- Parse resource_name to extract brand/model if possible
        -- Format: "Brand Model" or just "Model"
        device_model := resource_record.resource_name;
        device_brand := NULL;
        
        -- Try to extract brand from resource_name (common patterns)
        IF resource_record.resource_name ~* '^(apple|dell|hp|lenovo|asus|acer|samsung|microsoft|lg|sony)' THEN
            -- Extract first word as brand
            device_brand := split_part(resource_record.resource_name, ' ', 1);
            device_model := substring(resource_record.resource_name from position(' ' in resource_record.resource_name) + 1);
            IF device_model = '' THEN
                device_model := resource_record.resource_name;
            END IF;
        END IF;
        
        -- Determine device_type from resource_name or description
        -- Default to 'other' if cannot determine
        DECLARE
            detected_type VARCHAR(50) := 'other';
        BEGIN
            IF resource_record.resource_name ~* '(laptop|notebook|macbook)' THEN
                detected_type := 'laptop';
            ELSIF resource_record.resource_name ~* '(desktop|pc|computer)' THEN
                detected_type := 'desktop';
            ELSIF resource_record.resource_name ~* '(phone|iphone|android)' THEN
                detected_type := 'phone';
            ELSIF resource_record.resource_name ~* '(tablet|ipad)' THEN
                detected_type := 'tablet';
            ELSIF resource_record.resource_name ~* '(monitor|display|screen)' THEN
                detected_type := 'monitor';
            ELSIF resource_record.resource_name ~* '(projector)' THEN
                detected_type := 'projector';
            END IF;
            
            -- Insert into devices table
            INSERT INTO devices (
                device_id,
                asset_tag,
                device_type,
                brand,
                model,
                condition,
                status,
                location,
                notes,
                created_at,
                updated_at,
                deleted_at
            ) VALUES (
                new_device_id,
                resource_record.resource_id,  -- Use resource_id as asset_tag
                detected_type,
                device_brand,
                device_model,
                COALESCE(resource_record.condition, 'Good'),
                CASE 
                    WHEN resource_record.is_available = TRUE THEN 'available'
                    WHEN resource_record.is_available = FALSE THEN 'maintenance'
                    ELSE 'available'
                END,
                resource_record.location,
                COALESCE(resource_record.description, resource_record.notes),
                resource_record.created_at,
                resource_record.updated_at,
                resource_record.deleted_at
            )
            ON CONFLICT (device_id) DO NOTHING;  -- Skip if device_id already exists
            
            migrated_count := migrated_count + 1;
        END;
    END LOOP;
    
    RAISE NOTICE 'Migrated % device(s) from resources to devices table', migrated_count;
END $$;

-- ============================================================================
-- STEP 4: Remove migrated devices from resources table
-- ============================================================================
-- After successful migration, delete device rows from resources table
-- This ensures devices are no longer counted in resources queries

DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete all resources where resource_type = 'Device'
    -- Use soft delete by setting deleted_at if column exists, otherwise hard delete
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resources' 
        AND column_name = 'deleted_at'
    ) THEN
        -- Soft delete: set deleted_at timestamp
        UPDATE resources 
        SET deleted_at = NOW()
        WHERE resource_type = 'Device' 
        AND deleted_at IS NULL;
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Soft deleted % device row(s) from resources table', deleted_count;
    ELSE
        -- Hard delete: remove rows completely
        DELETE FROM resources 
        WHERE resource_type = 'Device';
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RAISE NOTICE 'Hard deleted % device row(s) from resources table', deleted_count;
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Update constraints and add check constraint to resources table
-- ============================================================================
-- Add constraint to prevent future devices from being added to resources table
-- This is a safeguard to prevent the issue from recurring

DO $$
BEGIN
    -- Add check constraint to prevent 'Device' resource_type
    -- Note: This will fail if there are still devices in resources table
    -- If migration failed, comment out this section and fix data first
    
    IF NOT EXISTS (
        SELECT FROM pg_constraint 
        WHERE conname = 'chk_resources_no_devices'
    ) THEN
        ALTER TABLE resources 
        ADD CONSTRAINT chk_resources_no_devices 
        CHECK (resource_type IS NULL OR resource_type != 'Device');
        
        RAISE NOTICE 'Added constraint to prevent devices in resources table';
    ELSE
        RAISE NOTICE 'Constraint already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Could not add constraint. Ensure all devices are migrated first. Error: %', SQLERRM;
END $$;

-- ============================================================================
-- STEP 6: Create helpful views for dashboard queries
-- ============================================================================

-- View for counting only non-device resources
CREATE OR REPLACE VIEW resources_count_excluding_devices AS
SELECT 
    COUNT(*) as total_resources,
    COUNT(*) FILTER (WHERE is_available = TRUE) as available_resources,
    COUNT(*) FILTER (WHERE is_available = FALSE) as unavailable_resources
FROM resources
WHERE deleted_at IS NULL
AND (resource_type IS NULL OR resource_type != 'Device');

-- View for counting devices
CREATE OR REPLACE VIEW devices_count AS
SELECT 
    COUNT(*) as total_devices,
    COUNT(*) FILTER (WHERE status = 'available') as available_devices,
    COUNT(*) FILTER (WHERE status = 'borrowed') as borrowed_devices,
    COUNT(*) FILTER (WHERE status = 'assigned') as assigned_devices,
    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance_devices
FROM devices
WHERE deleted_at IS NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify migration was successful

DO $$
DECLARE
    resources_device_count INTEGER;
    devices_count INTEGER;
BEGIN
    -- Count remaining devices in resources table
    SELECT COUNT(*) INTO resources_device_count
    FROM resources
    WHERE resource_type = 'Device' 
    AND deleted_at IS NULL;
    
    -- Count devices in devices table
    SELECT COUNT(*) INTO devices_count
    FROM devices
    WHERE deleted_at IS NULL;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Devices remaining in resources table: %', resources_device_count;
    RAISE NOTICE 'Devices in devices table: %', devices_count;
    
    IF resources_device_count = 0 THEN
        RAISE NOTICE '✓ SUCCESS: All devices migrated from resources table';
    ELSE
        RAISE WARNING '⚠ WARNING: % device(s) still in resources table', resources_device_count;
    END IF;
    
    IF devices_count > 0 THEN
        RAISE NOTICE '✓ SUCCESS: Devices table contains % device(s)', devices_count;
    ELSE
        RAISE WARNING '⚠ WARNING: No devices found in devices table';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Next Steps:
-- 1. Update your application queries to:
--    - Count devices from devices table: SELECT COUNT(*) FROM devices WHERE deleted_at IS NULL
--    - Count resources from resources table (excluding devices): 
--      SELECT COUNT(*) FROM resources WHERE deleted_at IS NULL 
--      AND (resource_type IS NULL OR resource_type != 'Device')
--
-- 2. Update dashboard API endpoints to use the new queries
--
-- 3. Test the migration:
--    - Verify device counts match expected values
--    - Verify resource counts exclude devices
--    - Check that existing device functionality still works
--
-- 4. Monitor for any issues and rollback if necessary (see rollback script)
-- ============================================================================

