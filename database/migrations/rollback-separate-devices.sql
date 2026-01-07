-- ============================================================================
-- ROLLBACK: Separate Devices from Resources Table
-- ============================================================================
-- Purpose: Rollback the migration that separated devices from resources
--          This will move devices back to resources table if needed
--
-- WARNING: This script will:
--   1. Remove the constraint preventing devices in resources table
--   2. Move devices back to resources table (if needed)
--   3. Remove the helpful views
--
-- Use this only if you need to revert the migration
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Remove constraint preventing devices in resources table
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_constraint 
        WHERE conname = 'chk_resources_no_devices'
    ) THEN
        ALTER TABLE resources 
        DROP CONSTRAINT chk_resources_no_devices;
        
        RAISE NOTICE 'Removed constraint preventing devices in resources table';
    ELSE
        RAISE NOTICE 'Constraint does not exist';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Move devices back to resources table (optional)
-- ============================================================================
-- Uncomment this section if you want to move devices back to resources table
-- This is typically not needed unless you want to completely revert

/*
DO $$
DECLARE
    migrated_count INTEGER := 0;
    device_record RECORD;
BEGIN
    FOR device_record IN 
        SELECT * FROM devices 
        WHERE deleted_at IS NULL
    LOOP
        INSERT INTO resources (
            resource_id,
            resource_name,
            resource_type,
            description,
            location,
            condition,
            is_available,
            notes,
            created_at,
            updated_at,
            deleted_at
        ) VALUES (
            COALESCE(device_record.device_id, device_record.asset_tag, device_record.id::TEXT),
            COALESCE(device_record.model, device_record.brand, 'Device'),
            'Device',
            device_record.notes,
            device_record.location,
            device_record.condition,
            CASE WHEN device_record.status = 'available' THEN TRUE ELSE FALSE END,
            device_record.notes,
            device_record.created_at,
            device_record.updated_at,
            device_record.deleted_at
        )
        ON CONFLICT DO NOTHING;
        
        migrated_count := migrated_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Moved % device(s) back to resources table', migrated_count;
END $$;
*/

-- ============================================================================
-- STEP 3: Remove helpful views
-- ============================================================================

DROP VIEW IF EXISTS resources_count_excluding_devices;
DROP VIEW IF EXISTS devices_count;

RAISE NOTICE 'Removed helper views';

COMMIT;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

