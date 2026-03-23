# Migration: Add is_returned Column to borrows Table

## Overview

This migration adds the `is_returned` boolean column to the `borrows` table to properly track returned devices. This ensures that:

1. Returned devices are properly marked and tracked
2. Active borrows are correctly filtered (is_borrowed = true AND is_returned = false)
3. Borrow history is maintained (is_returned = true)
4. No records are deleted - only marked as returned

## Migration File

**File:** `database/migrations/add-is-returned-to-borrows.sql`

## How to Run

1. **Backup your database** (critical!)
2. **Run the migration**:
   ```sql
   -- Copy and paste the contents of add-is-returned-to-borrows.sql
   -- into your Supabase SQL Editor or psql client
   ```
3. **Verify the migration**:
   ```sql
   -- Check that the column exists
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'borrows' AND column_name = 'is_returned';
   
   -- Should return: is_returned | boolean | false
   ```

## What This Migration Does

1. ✅ Adds `is_returned` boolean column with default value `false`
2. ✅ Creates indexes for efficient querying
3. ✅ Updates existing records where `return_date IS NOT NULL` to `is_returned = true`
4. ✅ Adds helpful comments to the column and table

## Backend Changes

The following files have been updated to use `is_returned`:

- `lib/services/borrow-service.ts`:
  - Updated `BorrowRecord` interface to include `is_returned`
  - Updated `listBorrows()` to filter by `is_returned`
  - Updated `returnDevice()` to set `is_returned = true`
  - Updated `getActiveBorrowByDevice()` to filter `is_returned = false`
  - Updated `getActiveBorrowsByDeviceIds()` to filter `is_returned = false`
  - Updated `createBorrow()` to set `is_returned = false`
  - Updated `approveBorrow()` to ensure `is_returned = false`

- `lib/services/supervisor-dashboard-service.ts`:
  - Updated `getActiveBorrows()` to filter `is_returned = false`
  - Added client-side filtering for safety

- `app/api/borrows/route.ts`:
  - Added `isReturned` filter parameter
  - Updated logging to include `is_returned` status

- `app/api/device-scans/validate/route.ts`:
  - Updated return logic to use `returnDevice()` which sets `is_returned = true`

## Query Logic

### Active Borrows (Currently Borrowed)
```sql
SELECT * FROM borrows 
WHERE is_borrowed = true 
  AND is_returned = false
```

### Pending Requests
```sql
SELECT * FROM borrows 
WHERE is_borrowed = false 
  AND is_returned = false
  AND status NOT LIKE '%rejected%'
  AND approval_status NOT LIKE '%rejected%'
```

### Returned Devices (History)
```sql
SELECT * FROM borrows 
WHERE is_returned = true
ORDER BY return_date DESC
```

## Important Notes

- **No Deletion**: Records are NEVER deleted, only marked as returned
- **Full History**: All borrow records are maintained for audit purposes
- **Backward Compatibility**: The migration updates existing records automatically
- **Indexes**: Indexes are created for efficient querying of active borrows

## Testing

After migration, verify:

1. **Pending requests appear on supervisor dashboard**
2. **Active borrows show only non-returned devices**
3. **Returned devices appear in history**
4. **No records are deleted when returning devices**

## Rollback (if needed)

```sql
-- Remove the column (WARNING: This will lose return tracking data)
ALTER TABLE public.borrows DROP COLUMN IF EXISTS is_returned;

-- Remove indexes
DROP INDEX IF EXISTS idx_borrows_is_returned;
DROP INDEX IF EXISTS idx_borrows_active;
```
