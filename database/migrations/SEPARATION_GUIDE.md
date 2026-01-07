# Devices and Resources Separation Guide

## Overview

This guide explains the separation of devices from resources in the Asset Management System, why it was necessary, and best practices for maintaining this separation going forward.

## Problem Statement

### Original Issue

- **Both devices and resources were stored in the same `resources` table**
- Devices were identified by `resource_type = 'Device'`
- This caused **incorrect counting** in dashboard cards:
  - Resources card: Counted both resources AND devices (e.g., 4 resources + 24 devices = 28)
  - Devices card: Also counted devices from resources table
  - Result: Devices were being counted twice, inflating numbers

### Root Cause

The original design treated devices as a type of resource, which made sense conceptually but caused practical issues:
1. **Double counting**: Devices appeared in both resources and devices counts
2. **Mixed concerns**: Devices have different attributes (asset_tag, serial_number, device_type) than resources
3. **Query complexity**: Every resources query needed to filter out devices
4. **Scalability**: As device management features grew, the shared table became a bottleneck

## Solution

### Architecture Changes

1. **Separate Tables**:
   - `devices` table: Dedicated table for all devices/assets
   - `resources` table: Only for non-device resources (rooms, equipment, etc.)

2. **Data Migration**:
   - All rows with `resource_type = 'Device'` migrated from `resources` to `devices`
   - Field mapping handled automatically
   - Original data preserved (soft-deleted in resources, active in devices)

3. **Query Updates**:
   - Resources queries automatically exclude devices
   - Devices queries use dedicated `devices` table
   - Dashboard counts now accurate

## Database Schema

### Devices Table Structure

```sql
CREATE TABLE devices (
    id UUID PRIMARY KEY,
    device_id VARCHAR(100) UNIQUE,      -- Human-readable ID (e.g., "DEV-001")
    asset_tag VARCHAR(100) UNIQUE,       -- Asset tag
    serial_number VARCHAR(100) UNIQUE,  -- Serial number
    device_type VARCHAR(50) NOT NULL,   -- laptop, desktop, phone, etc.
    brand VARCHAR(100),                  -- Apple, Dell, HP, etc.
    model VARCHAR(100),                   -- MacBook Pro 14, etc.
    status VARCHAR(50),                  -- available, assigned, borrowed, etc.
    condition VARCHAR(50),               -- excellent, good, fair, poor, etc.
    assigned_to UUID,                   -- References employees(id)
    location VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);
```

### Resources Table Structure (Updated)

```sql
CREATE TABLE resources (
    resource_id VARCHAR(100) PRIMARY KEY,
    resource_name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50),          -- Room, Equipment, etc. (NOT 'Device')
    description TEXT,
    location VARCHAR(255),
    capacity INTEGER,                    -- For rooms/venues
    condition VARCHAR(50),
    is_available BOOLEAN,
    notes TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    -- Constraint prevents devices from being added
    CONSTRAINT chk_resources_no_devices 
        CHECK (resource_type IS NULL OR resource_type != 'Device')
);
```

## Best Practices

### 1. Creating New Records

#### ✅ DO: Create devices via DevicesService

```typescript
import { devicesService } from '@/lib/services/devices-service'

// Create a new device
const device = await devicesService.createDevice({
  device_id: 'DEV-001',
  asset_tag: 'ASSET-001',
  device_type: 'laptop',
  brand: 'Apple',
  model: 'MacBook Pro 14',
  status: 'available',
  condition: 'excellent'
})
```

#### ✅ DO: Create resources via ResourcesService

```typescript
import { resourcesService } from '@/lib/services/resources-service'

// Create a new resource (room, equipment, etc.)
const resource = await resourcesService.createResource({
  resource_id: 'ROOM-001',
  resource_name: 'Conference Room A',
  resource_type: 'Room',
  capacity: 25,
  is_available: true
})
```

#### ❌ DON'T: Create devices as resources

```typescript
// ❌ WRONG - This will fail
await resourcesService.createResource({
  resource_id: 'DEV-001',
  resource_name: 'Laptop',
  resource_type: 'Device'  // ❌ This will throw an error
})
```

### 2. Querying Data

#### ✅ DO: Query devices separately

```typescript
// Get all devices
const devices = await devicesService.listDevices({})

// Get devices by status
const availableDevices = await devicesService.listDevices({
  status: 'available'
})

// Count devices
const deviceCount = await supabase
  .from('devices')
  .select('*', { count: 'exact', head: true })
  .is('deleted_at', null)
```

#### ✅ DO: Query resources (devices automatically excluded)

```typescript
// Get all resources (devices automatically excluded)
const resources = await resourcesService.listResources({})

// Get resources by type
const rooms = await resourcesService.listResources({
  resource_type: 'Room'
})

// Count resources (devices automatically excluded)
const resourceCount = await supabase
  .from('resources')
  .select('*', { count: 'exact', head: true })
  .is('deleted_at', null)
  .or('resource_type.is.null,resource_type.neq.Device')
```

### 3. Dashboard Counts

#### ✅ DO: Use separate counts

```typescript
// Dashboard summary query
const summary = {
  // Count devices from devices table
  totalDevices: await supabase
    .from('devices')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null),
  
  // Count resources from resources table (devices excluded automatically)
  totalResources: await supabase
    .from('resources')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .or('resource_type.is.null,resource_type.neq.Device')
}
```

#### ❌ DON'T: Combine counts incorrectly

```typescript
// ❌ WRONG - This counts devices twice
const wrongCount = await supabase
  .from('resources')
  .select('*', { count: 'exact', head: true })
  // Missing filter - will include devices if they still exist in resources
```

### 4. API Endpoints

#### ✅ DO: Use correct endpoints

- **Devices**: `/api/devices` (GET, POST, PATCH, DELETE)
- **Resources**: `/api/resources` (GET, POST, PATCH, DELETE)

#### ❌ DON'T: Use resources endpoint for devices

```typescript
// ❌ WRONG
fetch('/api/resources?resource_type=Device')  // Will return error

// ✅ CORRECT
fetch('/api/devices')  // Use devices endpoint
```

### 5. Database Constraints

The migration adds a constraint to prevent devices from being added to resources:

```sql
ALTER TABLE resources 
ADD CONSTRAINT chk_resources_no_devices 
CHECK (resource_type IS NULL OR resource_type != 'Device');
```

**This constraint ensures:**
- No new devices can be accidentally added to resources table
- Database-level enforcement of separation
- Clear error messages if someone tries to violate the rule

### 6. Migration Safety

#### Before Running Migration

1. **Backup your database** - Always backup before running migrations
2. **Test in staging** - Run migration in staging environment first
3. **Verify data** - Check how many devices exist in resources table:
   ```sql
   SELECT COUNT(*) FROM resources WHERE resource_type = 'Device' AND deleted_at IS NULL;
   ```

#### After Running Migration

1. **Verify counts** - Ensure device and resource counts are correct
2. **Test functionality** - Verify all device and resource operations still work
3. **Monitor errors** - Watch for any constraint violations or query errors

### 7. Long-Term Scalability

#### Benefits of Separation

1. **Performance**: Separate indexes for devices and resources
2. **Clarity**: Clear separation of concerns
3. **Flexibility**: Devices can have device-specific features without affecting resources
4. **Maintainability**: Easier to understand and modify each table independently

#### Future Considerations

- **Device-specific features**: Add device-specific columns without affecting resources
- **Resource-specific features**: Add resource-specific columns without affecting devices
- **Different access patterns**: Optimize queries for each table's usage patterns
- **Reporting**: Easier to generate separate reports for devices vs resources

## Common Issues and Solutions

### Issue 1: "Device still showing in resources count"

**Solution**: Ensure your query excludes devices:
```sql
SELECT COUNT(*) FROM resources 
WHERE deleted_at IS NULL 
AND (resource_type IS NULL OR resource_type != 'Device');
```

### Issue 2: "Cannot create device as resource"

**Solution**: Use the devices endpoint/service instead:
```typescript
// Use DevicesService, not ResourcesService
await devicesService.createDevice({ ... })
```

### Issue 3: "Migration failed partway through"

**Solution**: 
1. Check the error message in the migration output
2. Verify all devices were migrated: `SELECT COUNT(*) FROM devices`
3. Check for remaining devices in resources: `SELECT COUNT(*) FROM resources WHERE resource_type = 'Device'`
4. Use rollback script if needed: `rollback-separate-devices.sql`

### Issue 4: "Constraint violation when updating resource"

**Solution**: Ensure you're not trying to set `resource_type = 'Device'`:
```typescript
// ❌ Wrong
await resourcesService.updateResource(id, { resource_type: 'Device' })

// ✅ Correct - use DevicesService for devices
await devicesService.updateDevice(deviceId, { ... })
```

## Migration Files

1. **`separate-devices-from-resources.sql`**: Main migration script
   - Creates/ensures devices table exists
   - Migrates data from resources to devices
   - Removes devices from resources table
   - Adds constraints and views

2. **`rollback-separate-devices.sql`**: Rollback script
   - Removes constraints
   - Optionally moves devices back to resources (commented out)

3. **`updated-dashboard-queries.sql`**: Reference queries
   - Correct queries for dashboard counts
   - Examples for different use cases

## Testing Checklist

After migration, verify:

- [ ] Device counts match expected values
- [ ] Resource counts exclude devices
- [ ] Dashboard cards show correct numbers
- [ ] Creating devices works via DevicesService
- [ ] Creating resources works via ResourcesService
- [ ] Cannot create devices via ResourcesService
- [ ] Cannot set resource_type to 'Device'
- [ ] All existing device functionality still works
- [ ] All existing resource functionality still works
- [ ] No constraint violations in logs

## Support

If you encounter issues:

1. Check migration logs for errors
2. Verify database constraints exist
3. Review query filters (ensure devices are excluded from resources queries)
4. Check API endpoint usage (use correct endpoints)
5. Review this guide for common issues

## Summary

The separation of devices from resources provides:
- ✅ Accurate counting in dashboard cards
- ✅ Clear separation of concerns
- ✅ Better scalability and maintainability
- ✅ Database-level enforcement of separation
- ✅ Improved query performance

Follow the best practices outlined in this guide to maintain this separation and avoid counting issues in the future.

