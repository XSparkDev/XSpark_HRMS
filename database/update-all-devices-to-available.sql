-- ============================================================================
-- BULK UPDATE ALL DEVICES TO 'available' STATUS
-- ============================================================================
-- This script updates ALL devices in the devices table to have status = 'available'
-- Use this after deleting all borrow records to reset all device statuses
-- ============================================================================

BEGIN;

-- Update ALL devices to 'available' status
-- This ensures every device is marked as available since there are no active borrows
UPDATE devices
SET 
  status = 'available',
  assigned_to = NULL,  -- Clear any assignments (optional - remove if you want to keep assignments)
  updated_at = NOW()
WHERE 
  status IS DISTINCT FROM 'available';  -- Updates all devices regardless of current status

-- Show the results
SELECT 
  COUNT(*) as total_devices,
  COUNT(*) FILTER (WHERE status = 'available') as available_devices,
  COUNT(*) FILTER (WHERE status != 'available') as other_status_devices
FROM devices;

COMMIT;

-- ============================================================================
-- Verification Queries (run after the update)
-- ============================================================================

-- Check status distribution
SELECT status, COUNT(*) as count 
FROM devices 
GROUP BY status 
ORDER BY count DESC;

-- Verify all devices are available
SELECT 
  CASE 
    WHEN COUNT(*) FILTER (WHERE status = 'available') = COUNT(*) 
    THEN '✅ All devices are available'
    ELSE '❌ Some devices are not available'
  END as verification_status,
  COUNT(*) as total_devices,
  COUNT(*) FILTER (WHERE status = 'available') as available_count,
  COUNT(*) FILTER (WHERE status != 'available') as non_available_count
FROM devices;
