# Reset All Devices to Available Status

## Overview

After deleting all data from the `borrows` table, you need to update all devices to have `status = "available"`. This document provides multiple methods to accomplish this.

---

## Method 1: SQL Query (Recommended for Immediate Update)

### Direct SQL Execution

Run this SQL query in your Supabase SQL Editor or database client:

```sql
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
```

### Location
The SQL script is also available at: `database/update-all-devices-to-available.sql`

---

## Method 2: API Endpoint (Recommended for Programmatic Update)

### Endpoint
`PATCH /api/devices/bulk-status`

### Request Body
```json
{
  "status": "available",
  "clearAssignments": true,
  "updateAll": true
}
```

### Example Usage

#### Using cURL
```bash
curl -X PATCH http://localhost:3000/api/devices/bulk-status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "available",
    "clearAssignments": true,
    "updateAll": true
  }'
```

#### Using JavaScript/Fetch
```javascript
const response = await fetch('/api/devices/bulk-status', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'available',
    clearAssignments: true,
    updateAll: true,
  }),
})

const result = await response.json()
console.log(`Updated ${result.data.updatedCount} devices`)
```

#### Using Postman
1. Method: `PATCH`
2. URL: `http://localhost:3000/api/devices/bulk-status`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "status": "available",
  "clearAssignments": true,
  "updateAll": true
}
```

### Response
```json
{
  "success": true,
  "message": "Successfully updated 150 devices to status: available",
  "data": {
    "status": "available",
    "updatedCount": 150
  }
}
```

### Parameters
- `status` (required): Must be one of: `'available'`, `'assigned'`, `'borrowed'`, `'maintenance'`, `'retired'`, `'lost'`
- `clearAssignments` (optional, default: `false`): If `true`, clears the `assigned_to` field for all devices
- `updateAll` (optional, default: `true`): If `true`, updates ALL devices regardless of current status

---

## Method 3: Using the Sync Function

The system has a built-in sync function that automatically updates device statuses based on their actual state (borrows, maintenance, etc.). Since the borrows table is empty, this will set all devices to available.

### Endpoint
`GET /api/devices?syncStatus=true`

### Example
```bash
curl "http://localhost:3000/api/devices?syncStatus=true&limit=1000"
```

This will:
1. Check all devices for active borrows (will find none since table is empty)
2. Update device statuses in the database to match their actual state
3. Return the updated device list

---

## Backend Logic Adjustments

### ✅ No Changes Required

The backend logic already handles empty borrow tables correctly:

1. **Active Borrow Checks**: The `getActiveBorrowsByDeviceIds()` method queries for `is_borrowed = true`. Since the borrows table is empty, this will always return an empty Map, meaning no devices are considered borrowed.

2. **Device Status Calculation**: In `/api/devices/route.ts`, the logic checks:
   ```typescript
   if (activeBorrow) {
     actualStatus = 'borrowed'
   } else {
     // No active borrow - device is available (or maintenance if condition indicates)
     actualStatus = 'available'
   }
   ```
   Since `activeBorrow` will always be `undefined` (no borrows exist), all devices will be treated as available.

3. **Sync Function**: The `syncDeviceStatuses()` method will:
   - Find no active borrows (empty table)
   - Set all devices without maintenance conditions to `'available'`
   - Update the database accordingly

### Logic Flow

```
Device Status Determination:
├── Has active borrow? (is_borrowed = true)
│   └── NO (borrows table is empty)
│       ├── Device condition indicates maintenance?
│       │   └── YES → status = 'maintenance'
│       │   └── NO → status = 'available'
│       └── Device has assigned_to?
│           └── YES → status = 'assigned' (but can still be borrowed)
│           └── NO → status = 'available'
```

---

## Ensuring UI Reflects Changes Immediately

### 1. Clear Browser Cache
After updating devices, clear your browser cache or do a hard refresh:
- **Chrome/Edge**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Firefox**: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

### 2. API Cache Headers
The API already includes no-cache headers:
```typescript
headers: {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}
```

### 3. Refresh Device Lists
After running the update, refresh any device lists in the UI:
- **Dashboard**: Click "Check device availability" to refresh
- **Devices Page**: Reload the page or click refresh
- **Supervisor Dashboard**: Refresh the page

### 4. Programmatic Refresh
If you're updating via API, you can trigger a refresh:

```javascript
// After bulk update
await fetch('/api/devices/bulk-status', { ... })

// Then refresh the device list
const devices = await fetch('/api/devices?limit=1000', {
  cache: 'no-store',
  headers: { 'Cache-Control': 'no-cache' }
})
```

---

## Verification Steps

### 1. Check Database
```sql
-- Should return all devices with status = 'available'
SELECT COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'available') as available_count
FROM devices;

-- Should return 0 for non-available devices
SELECT COUNT(*) as non_available_count
FROM devices
WHERE status != 'available';
```

### 2. Check API Response
```bash
curl "http://localhost:3000/api/devices?limit=10" | jq '.data[] | {device_id, status}'
```

All devices should show `"status": "available"` (or `"borrowed"` if there are active borrows, but since the table is empty, all should be `"available"`).

### 3. Check UI
- Open the dashboard
- Click "Check device availability"
- All devices should show as "Available"

---

## Summary

### Quick SQL Solution
```sql
UPDATE devices SET status = 'available', updated_at = NOW() WHERE status IS DISTINCT FROM 'available';
```

### Quick API Solution
```bash
curl -X PATCH http://localhost:3000/api/devices/bulk-status \
  -H "Content-Type: application/json" \
  -d '{"status":"available","clearAssignments":true,"updateAll":true}'
```

### Backend Logic
✅ **No changes needed** - The system already handles empty borrow tables correctly.

### UI Updates
✅ **Automatic** - The API includes no-cache headers. Just refresh the page or trigger a device list refresh.

---

## Files Modified/Created

1. ✅ `database/update-all-devices-to-available.sql` - SQL script for direct database update
2. ✅ `lib/services/devices-service.ts` - Enhanced `bulkUpdateAllDevicesStatus()` method
3. ✅ `app/api/devices/bulk-status/route.ts` - API endpoint for bulk status updates
4. ✅ `lib/services/devices-service.ts` - `syncDeviceStatuses()` method (already handles empty borrows)

---

## Notes

- The `syncDeviceStatuses()` method will automatically set devices to `'available'` when there are no active borrows
- Devices with maintenance conditions will be set to `'maintenance'` status
- The API endpoint `/api/devices` already calculates correct statuses based on borrow state
- All changes are immediately reflected in the database
- UI will show updated statuses after refresh (cache headers ensure fresh data)
