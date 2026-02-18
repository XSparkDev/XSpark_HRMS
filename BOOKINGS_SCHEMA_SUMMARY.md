# Bookings Table Schema Update - Summary

## Why `approved_by` and `approved_at` Are NOT Needed

You're absolutely right! Since:
- **Bookings are automatically approved** by the system
- **Conflicts are resolved separately** by supervisors based on:
  - Meeting type
  - Meeting category
  - Employee position (for same category)

These approval tracking columns are not needed. The system handles conflicts through a separate resolution process, not through an approval/rejection workflow.

## Final SQL Migration

The migration file `BOOKINGS_SCHEMA_FINAL.sql` or `migrations/add_bookings_columns.sql` adds only these columns:

### 1. `checked_in_at` (TIMESTAMP WITH TIME ZONE)
- When user actually checked in
- Separate from `check_in_time` (scheduled time)

### 2. `rejection_reason` (TEXT)
- **Data Type**: TEXT (accepts any text string)
- **Used For**: Cancellation reasons only
- **NOT Used For**: Conflict resolution rejections
- **Acceptable Values**: Any text such as:
  - "Cancelled by user"
  - "Room unavailable"
  - "Schedule conflict"
  - Any descriptive cancellation reason

### 3. `created_at` (TIMESTAMP WITH TIME ZONE)
- Auto-set to NOW() on insert

### 4. `updated_at` (TIMESTAMP WITH TIME ZONE)
- Auto-set to NOW() on insert
- Auto-updated via trigger on each UPDATE

## Rejection Reason Field Details

**Data Type**: `TEXT` - accepts any text string

**Purpose**: Track why a booking was cancelled

**NOT used for**: Conflict resolution (that's handled separately)

**Examples of valid values**:
```sql
'Cancelled by user'
'Room unavailable'
'Schedule conflict'
'User requested cancellation'
```

## Route Handler Fix

The route handler already correctly awaits params:
```typescript
const { bookingId } = await params  // ✅ Already correct
```

No changes needed to the route handler.





