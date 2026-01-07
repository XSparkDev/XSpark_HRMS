# Devices and Resources Separation Migration

## Quick Start

This migration separates devices from resources to fix incorrect counting in dashboard cards.

### Files Included

1. **`separate-devices-from-resources.sql`** - Main migration script (run this first)
2. **`rollback-separate-devices.sql`** - Rollback script (if needed)
3. **`updated-dashboard-queries.sql`** - Reference queries for dashboard counts
4. **`SEPARATION_GUIDE.md`** - Comprehensive best practices guide

### Execution Steps

1. **Backup your database** (critical!)
2. **Run the migration**:
   ```sql
   -- Copy and paste the contents of separate-devices-from-resources.sql
   -- into your Supabase SQL Editor or psql client
   ```
3. **Verify the migration**:
   - Check migration output for success messages
   - Verify device counts match expected values
   - Verify resource counts exclude devices
4. **Update your application**:
   - The API routes and services have been updated automatically
   - Dashboard queries will now work correctly

### What This Migration Does

1. ✅ Ensures `devices` table exists with proper structure
2. ✅ Adds `device_id` column to devices table for compatibility
3. ✅ Migrates all rows from `resources` where `resource_type = 'Device'` to `devices`
4. ✅ Removes migrated devices from `resources` table (soft delete)
5. ✅ Adds constraint to prevent future devices in resources table
6. ✅ Creates helpful views for dashboard queries

### What Changed in Code

#### API Routes (`app/api/resources/route.ts`)
- GET endpoint now excludes devices automatically
- POST endpoint prevents creating devices as resources
- PATCH endpoint prevents setting resource_type to 'Device'

#### Services (`lib/services/resources-service.ts`)
- `listResources()` automatically excludes devices
- `createResource()` throws error if trying to create device
- `updateResource()` prevents setting resource_type to 'Device'

### Verification

After migration, run these queries to verify:

```sql
-- Should return 0 (no devices in resources)
SELECT COUNT(*) FROM resources 
WHERE resource_type = 'Device' AND deleted_at IS NULL;

-- Should return your device count
SELECT COUNT(*) FROM devices WHERE deleted_at IS NULL;

-- Should return resources count (excluding devices)
SELECT COUNT(*) FROM resources 
WHERE deleted_at IS NULL 
AND (resource_type IS NULL OR resource_type != 'Device');
```

### Rollback

If you need to rollback:

1. Run `rollback-separate-devices.sql`
2. Note: This removes constraints but does NOT move devices back to resources
3. If you need to move devices back, uncomment the migration section in rollback script

### Support

See `SEPARATION_GUIDE.md` for:
- Detailed best practices
- Common issues and solutions
- Query examples
- Testing checklist

---

**Important**: Always backup your database before running migrations!

