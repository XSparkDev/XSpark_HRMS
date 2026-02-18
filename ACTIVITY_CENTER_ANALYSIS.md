# Activity Center Functionality Analysis

## How the Activity Center is Supposed to Function

The Activity Center is designed to aggregate and display activities from multiple sources across the system. It fetches data from 6 different activity types and combines them into a unified feed.

### Data Sources (6 Activity Types)

1. **Meeting Bookings** (Lines 21-40)
   - Source: Room bookings table
   - Shows: New room bookings and meeting cancellations
   - Status Detection: Checks if booking is cancelled

2. **Device Booking Approvals/Rejections** (Lines 42-69)
   - Source: Borrows table
   - Shows: When device borrow requests are approved or rejected
   - Filters: Only shows records where `approval_status` is 'approved' or 'rejected'

3. **Device Return Due-Date Alerts** (Lines 71-106)
   - Source: Borrows table (active borrows)
   - Shows: Devices that are due for return within 5 days
   - Status: 'borrowed' devices with `expected_return_date` approaching

4. **Incident Reviews & Replies** (Lines 108-135)
   - Source: Incidents table
   - Shows: When incidents are reviewed, resolved, or replied to
   - Filters: Status must be 'reviewed', 'resolved', or 'replied'

5. **Maintenance Updates** (Lines 137-164)
   - Source: Maintenance requests table
   - Shows: Maintenance tickets that are in progress, completed, or resolved
   - Filters: Status must be 'in_progress', 'completed', or 'resolved'

6. **Conflict Resolutions** (Lines 166-186)
   - Source: Room bookings table (conflicts)
   - Shows: When room booking conflicts are resolved
   - Filters: Status must be 'resolved'

### Workflow

1. **Fetch Activities**: The API fetches activities from all 6 sources
2. **Combine**: All activities are pushed into a single array
3. **Sort**: Activities are sorted by `created_at` descending (newest first)
4. **Paginate**: Results are sliced based on `limit` and `offset` parameters
5. **Return**: Returns JSON with activities array and metadata

### Frontend Display

- The dashboard calls `/api/activity-center?limit=20&offset=0`
- Activities are displayed in a card with icons and status badges
- Supports pagination with "Load More" button
- Shows loading states and error messages

---

## Issues Preventing It From Working

### ❌ Issue 1: Wrong Table Name (CRITICAL)

**Lines 23 & 168**: Uses `'room_bookings'`
- **Should be**: `'bookings'`
- **Evidence**: `bookings-service.ts` uses `private readonly table = 'bookings'`

### ❌ Issue 2: Wrong Primary Key Column (CRITICAL)

**Line 24**: Selects `id`
- **Should be**: `booking_id`
- **Evidence**: `BookingRecord` interface shows `booking_id: string` is the primary key

**Line 111**: Selects `id` for incidents
- **Should be**: `incident_id`
- **Evidence**: `IncidentsService` uses `incident_id` as primary key

**Line 45, 60, 66, 74, 95, 101**: Uses `id` for borrows
- **Should be**: `borrow_id`
- **Evidence**: `BorrowRecord` interface shows `borrow_id: string` is the primary key

### ❌ Issue 3: Status Column Doesn't Exist

**Lines 24, 32, 36, 170**: Queries/uses `status` field
- **Problem**: The `bookings` table doesn't have a `status` column
- **Solution**: Cancellation is tracked via `rejection_reason` field
- **Fix**: Check `rejection_reason` instead of `status` for cancellation

### ❌ Issue 4: Date Field May Not Exist

**Line 24**: Selects `date` field
- **Problem**: `date` might not exist in bookings table
- **Solution**: Derive date from `start_time` timestamp

### ❌ Issue 5: Missing Column Names

**Line 24**: Missing `booking_reason` field
- Should include `booking_reason` as fallback for agenda

---

## Correct Table & Column Structure

### Table: `bookings`
- **Primary Key**: `booking_id` (TEXT)
- **Key Columns**: 
  - `room_id`, `booked_by`, `start_time`, `end_time`
  - `booking_reason`, `meeting_category`, `meeting_agenda`
  - `rejection_reason` (for cancellation)
  - `created_at`, `updated_at`

### Table: `borrows`
- **Primary Key**: `borrow_id` (TEXT)
- **Key Columns**:
  - `device_id`, `borrowed_by`, `approval_status`, `status`
  - `expected_return_date`, `return_date`
  - `created_at`, `updated_at`

### Table: `incidents`
- **Primary Key**: `incident_id` (TEXT/UUID)
- **Key Columns**:
  - `device_id`, `incident_type`, `status`
  - `created_at`, `updated_at`

### Table: `maintenance_requests` (if exists)
- **Primary Key**: Need to verify (likely `id` or `maintenance_id`)
- **Note**: Maintenance might be stored in localStorage only

---

## Summary

The Activity Center is **not working** because:

1. ❌ Wrong table name: `room_bookings` → should be `bookings`
2. ❌ Wrong primary keys: Using `id` instead of `booking_id`, `borrow_id`, `incident_id`
3. ❌ Non-existent columns: Querying `status` and `date` that may not exist
4. ❌ Wrong cancellation detection: Should check `rejection_reason` not `status`

These errors cause the API queries to fail silently, resulting in an empty activities array and showing "No activities yet."





