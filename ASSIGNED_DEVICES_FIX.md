# Assigned Devices Dashboard Fix

## Overview

Fixed the "Assigned Devices" card and details view to correctly show only devices assigned to the currently logged-in user, using the `assigned_to` field from the `devices` table.

## Problem

- The dashboard was showing incorrect counts and devices for assigned devices
- It was using borrow history instead of the `assigned_to` field
- Devices assigned to other users were being shown
- Unassigned devices (where `assigned_to IS NULL`) were being counted

## Solution

### 1. New API Endpoint

**Created:** `/app/api/devices/assigned/route.ts`

- **Endpoint:** `GET /api/devices/assigned?employee_id={uuid}`
- **Purpose:** Returns devices assigned to a specific employee UUID
- **Filters:**
  - `assigned_to = employee_id` (only devices assigned to this user)
  - `deleted_at IS NULL` (excludes soft-deleted devices)
- **Returns:** Only essential fields: `asset_tag`, `device_type`, `brand`, `model`, `status`, `condition`, `location`
- **Ordering:** `updated_at DESC` (most recently updated first)
- **Performance:** Uses indexed `assigned_to` column

### 2. Updated Devices API

**Modified:** `/app/api/devices/route.ts`

- Added `assigned_to` filter support to the main GET endpoint
- Allows filtering devices by employee UUID via query parameter

### 3. Updated Devices Service

**Modified:** `/lib/services/devices-service.ts`

- Added comment explaining `assigned_to` filter usage
- Added explicit `deleted_at IS NULL` filter to exclude soft-deleted devices
- Ensures all device queries exclude deleted devices

### 4. Updated Dashboard

**Modified:** `/app/ams-dashboard/page.tsx`

#### Changes Made:

1. **Added State Variables:**
   - `assignedDevicesCount`: Stores count of devices assigned to current user
   - `assignedDevicesCountLoading`: Loading state for count fetch

2. **Added Employee Record Fetching:**
   - Fetches employee record from `/api/auth/me` if not in localStorage
   - Ensures we have the employee UUID (`employeeRecord.id`) for queries

3. **Added Assigned Devices Count Fetch:**
   - New `useEffect` that fetches count when `employeeRecord.id` is available
   - Uses `/api/devices/assigned?employee_id={uuid}` endpoint
   - Updates count dynamically based on logged-in user

4. **Replaced `fetchAssignedDevicesFromBorrows`:**
   - Old function used borrow history (incorrect)
   - New `fetchAssignedDevices()` function uses `/api/devices/assigned` endpoint
   - Fetches devices where `assigned_to = employee UUID`

5. **Updated Card Count:**
   - Changed from `borrowHistoryCount` to `assignedDevicesCount`
   - Shows count of devices assigned to current user only
   - Excludes devices assigned to others or unassigned devices

6. **Updated Details View:**
   - Shows only devices assigned to current user
   - Displays required fields: `asset_tag`, `device_type`, `brand`, `model`, `status`, `condition`, `location`
   - Removed borrow history references
   - Updated empty state message: "No devices currently assigned to you"

## Database Query Logic

### Count Query
```sql
SELECT COUNT(*) 
FROM devices 
WHERE assigned_to = current_user_employee_uuid 
  AND deleted_at IS NULL;
```

### List Query
```sql
SELECT 
  device_id,
  asset_tag,
  device_type,
  brand,
  model,
  status,
  condition,
  location,
  updated_at
FROM devices 
WHERE assigned_to = current_user_employee_uuid 
  AND deleted_at IS NULL
ORDER BY updated_at DESC;
```

## Key Features

✅ **User-Specific:** Only shows devices assigned to the logged-in user  
✅ **Excludes NULL:** Devices where `assigned_to IS NULL` are not counted/shown  
✅ **Excludes Others:** Devices assigned to other employees are not shown  
✅ **Performance:** Uses indexed `assigned_to` column  
✅ **Ordering:** Most recently updated devices first  
✅ **Empty State:** Clear message when user has no assigned devices  
✅ **Error Handling:** Graceful error handling with fallbacks  

## Files Modified

1. `/app/api/devices/route.ts` - Added `assigned_to` filter support
2. `/app/api/devices/assigned/route.ts` - **NEW** - Assigned devices endpoint
3. `/lib/services/devices-service.ts` - Added `deleted_at` filter and comments
4. `/app/ams-dashboard/page.tsx` - Updated card count, fetch logic, and details view

## Testing Checklist

- [ ] Assigned Devices card shows correct count for logged-in user
- [ ] Card count updates when devices are assigned/unassigned
- [ ] Clicking card shows only devices assigned to current user
- [ ] Devices assigned to other users are not shown
- [ ] Unassigned devices (assigned_to IS NULL) are not counted/shown
- [ ] Empty state shows when user has no assigned devices
- [ ] All required fields are displayed in details view
- [ ] Devices are ordered by most recently updated first
- [ ] Soft-deleted devices are excluded

## API Usage

### Get Assigned Devices Count
```javascript
const response = await fetch(`/api/devices/assigned?employee_id=${employeeUuid}`)
const { data, meta } = await response.json()
const count = meta.count // Number of devices assigned to user
```

### Get Assigned Devices List
```javascript
const response = await fetch(`/api/devices/assigned?employee_id=${employeeUuid}`)
const { data } = await response.json()
// data is array of devices with: asset_tag, device_type, brand, model, status, condition, location
```

## Notes

- The employee UUID (`employeeRecord.id`) is required for queries
- If employee record is not available, the count will be 0 and no devices will be shown
- The endpoint validates that `employee_id` is a valid UUID
- All queries use the indexed `assigned_to` column for optimal performance


