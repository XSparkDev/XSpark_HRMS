-- ============================================================================
-- UPDATED DASHBOARD QUERIES
-- ============================================================================
-- Purpose: Provides correct SELECT queries for dashboard counts after migration
--          These queries ensure devices and resources are counted separately
--
-- Usage: Reference these queries when updating your dashboard API endpoints
-- ============================================================================

-- ============================================================================
-- QUERY 1: Count Total Devices
-- ============================================================================
-- Returns the total number of devices (excluding soft-deleted)
-- Use this for the "Devices" card on the dashboard

SELECT COUNT(*) as total_devices
FROM devices
WHERE deleted_at IS NULL;

-- ============================================================================
-- QUERY 2: Count Devices by Status
-- ============================================================================
-- Returns device counts grouped by status
-- Useful for detailed device statistics

SELECT 
    status,
    COUNT(*) as count
FROM devices
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY count DESC;

-- ============================================================================
-- QUERY 3: Count Total Resources (Excluding Devices)
-- ============================================================================
-- Returns the total number of resources, EXCLUDING devices
-- This is the correct query for the "Resources" card
-- Devices are now stored separately in the devices table

SELECT COUNT(*) as total_resources
FROM resources
WHERE deleted_at IS NULL
AND (resource_type IS NULL OR resource_type != 'Device');

-- ============================================================================
-- QUERY 4: Count Resources by Type (Excluding Devices)
-- ============================================================================
-- Returns resource counts grouped by type, excluding devices
-- Useful for resource breakdown

SELECT 
    COALESCE(resource_type, 'Other') as resource_type,
    COUNT(*) as count
FROM resources
WHERE deleted_at IS NULL
AND (resource_type IS NULL OR resource_type != 'Device')
GROUP BY resource_type
ORDER BY count DESC;

-- ============================================================================
-- QUERY 5: Count Available vs Unavailable Resources (Excluding Devices)
-- ============================================================================
-- Returns availability counts for resources only

SELECT 
    COUNT(*) FILTER (WHERE is_available = TRUE) as available_resources,
    COUNT(*) FILTER (WHERE is_available = FALSE) as unavailable_resources,
    COUNT(*) as total_resources
FROM resources
WHERE deleted_at IS NULL
AND (resource_type IS NULL OR resource_type != 'Device');

-- ============================================================================
-- QUERY 6: Combined Dashboard Summary
-- ============================================================================
-- Returns a complete summary for dashboard cards
-- This query combines devices and resources counts correctly

SELECT 
    -- Device counts
    (SELECT COUNT(*) FROM devices WHERE deleted_at IS NULL) as total_devices,
    (SELECT COUNT(*) FROM devices WHERE deleted_at IS NULL AND status = 'available') as available_devices,
    (SELECT COUNT(*) FROM devices WHERE deleted_at IS NULL AND status = 'borrowed') as borrowed_devices,
    (SELECT COUNT(*) FROM devices WHERE deleted_at IS NULL AND status = 'maintenance') as maintenance_devices,
    
    -- Resource counts (excluding devices)
    (SELECT COUNT(*) FROM resources WHERE deleted_at IS NULL AND (resource_type IS NULL OR resource_type != 'Device')) as total_resources,
    (SELECT COUNT(*) FROM resources WHERE deleted_at IS NULL AND (resource_type IS NULL OR resource_type != 'Device') AND is_available = TRUE) as available_resources,
    (SELECT COUNT(*) FROM resources WHERE deleted_at IS NULL AND (resource_type IS NULL OR resource_type != 'Device') AND is_available = FALSE) as unavailable_resources;

-- ============================================================================
-- QUERY 7: Using Views (Recommended)
-- ============================================================================
-- If you created the views from the migration script, use these simpler queries

-- Count devices
SELECT * FROM devices_count;

-- Count resources (excluding devices)
SELECT * FROM resources_count_excluding_devices;

-- ============================================================================
-- QUERY 8: Supabase/PostgREST Compatible Queries
-- ============================================================================
-- These queries work well with Supabase client libraries

-- For devices count (using Supabase client):
-- supabase.from('devices').select('*', { count: 'exact', head: true }).is('deleted_at', null)

-- For resources count (excluding devices):
-- supabase.from('resources')
--   .select('*', { count: 'exact', head: true })
--   .is('deleted_at', null)
--   .or('resource_type.is.null,resource_type.neq.Device')

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
-- 
-- 1. Indexes: Ensure these indexes exist for optimal performance:
--    - idx_devices_deleted ON devices(deleted_at) WHERE deleted_at IS NOT NULL
--    - idx_resources_deleted ON resources(deleted_at) WHERE deleted_at IS NOT NULL
--    - idx_resources_type ON resources(resource_type)
--
-- 2. Caching: Consider caching these counts in your application if they don't
--    need to be real-time, as COUNT(*) queries can be slow on large tables.
--
-- 3. Materialized Views: For very large datasets, consider creating materialized
--    views that refresh periodically instead of counting on every request.
--
-- ============================================================================

