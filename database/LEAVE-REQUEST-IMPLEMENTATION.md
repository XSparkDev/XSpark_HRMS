# Leave Request Implementation Summary

## ✅ Implementation Complete

The leave request flow has been fully implemented to match your actual database structure.

## Database Structure (Confirmed)

### `leave_balances` Table
- `leave_type_id` (UUID foreign key to `leave_types`)
- `total_accrued`, `total_used`, `total_pending`, `carried_over`
- `available_balance` (computed): `((total_accrued + carried_over) - total_used) - total_pending`

### `leave_requests` Table
- `leave_type_id` (UUID foreign key to `leave_types`)
- `start_date`, `end_date` (DATE fields)
- `status`: 'pending', 'approved', 'rejected', 'cancelled'
- `submitted_by`, `reviewed_by` (UUIDs)
- `review_notes`, `document_url`, `document_required`

### `leave_calendar` Table
- Tracks individual leave days per request
- `leave_request_id`, `employee_id`, `leave_date`, `is_half_day`

### Functions
- `calculate_working_days(start_date, end_date, country='ZA')` - Excludes weekends and SA public holidays

## Implementation Details

### 1. Create Leave Request (`createLeaveRequest`)

**Flow:**
1. Resolve `leave_type_id` from `leave_types` table using `leave_type` key
2. Get current balance for employee and leave type
3. Calculate available balance: `((total_accrued + carried_over) - total_used) - total_pending`
4. Validate sufficient balance
5. Insert into `leave_requests` with `start_date`, `end_date`, `leave_type_id`
6. Create entries in `leave_calendar` (one per weekday)
7. Update `leave_balances.total_pending += total_days`

**API:** `POST /api/leave/requests`

**Request Body:**
```json
{
  "employee_id": "uuid",
  "leave_type": "annual", // Key from leave_types
  "start_date": "2026-08-07",
  "end_date": "2026-08-14",
  "reason": "Family vacation",
  "document_url": "optional-url",
  "document_required": false,
  "submitted_by": "employee-uuid"
}
```

### 2. Approve Leave Request (`approveLeaveRequest`)

**Flow:**
1. Get leave request (must be 'pending')
2. Get leave balance
3. Update `leave_requests.status = 'approved'`
4. Set `reviewed_by`, `reviewed_at`, `review_notes`
5. Move from pending to used:
   - `total_pending -= total_days`
   - `total_used += total_days`

**API:** `PUT /api/leave/requests`

**Request Body:**
```json
{
  "id": "request-uuid",
  "status": "approved",
  "reviewed_by": "reviewer-uuid",
  "review_notes": "Approved - team coverage arranged"
}
```

### 3. Reject Leave Request (`rejectLeaveRequest`)

**Flow:**
1. Get leave request (must be 'pending')
2. Get leave balance
3. Update `leave_requests.status = 'rejected'`
4. Set `reviewed_by`, `reviewed_at`, `review_notes`
5. Release pending balance: `total_pending -= total_days`
6. Delete `leave_calendar` entries for the request

**API:** `PUT /api/leave/requests`

**Request Body:**
```json
{
  "id": "request-uuid",
  "status": "rejected",
  "reviewed_by": "reviewer-uuid",
  "review_notes": "Rejected - business needs"
}
```

### 4. Get Leave Requests (`getLeaveRequests`)

**Flow:**
- Fetches leave requests with optional filters:
  - `employee_id`, `status`, `date_from`, `date_to`, `reviewed_by`
  - Supports pagination (`limit`, `offset`)

**API:** `GET /api/leave/requests?employee_id=uuid&status=pending`

### 5. Calculate Working Days (`calculateWorkingDays`)

**Flow:**
- Calls database function `calculate_working_days(start_date, end_date, 'ZA')`
- Falls back to weekend-only calculation if function unavailable
- Excludes weekends and SA public holidays

## Key Features

✅ **Balance Validation**: Checks available balance before allowing request
✅ **Pending Tracking**: Reserves days in `total_pending` on submission
✅ **Atomic Updates**: Moves from pending to used on approval
✅ **Calendar Tracking**: Creates individual day entries in `leave_calendar`
✅ **Working Days Calculation**: Uses database function for SA-specific holidays
✅ **Error Handling**: Comprehensive error messages and validation

## Testing

### Create Request
```bash
curl -X POST http://localhost:3000/api/leave/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "employee_id": "employee-uuid",
    "leave_type": "annual",
    "start_date": "2026-08-07",
    "end_date": "2026-08-14",
    "reason": "Family vacation",
    "submitted_by": "employee-uuid"
  }'
```

### Approve Request
```bash
curl -X PUT http://localhost:3000/api/leave/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "id": "request-uuid",
    "status": "approved",
    "reviewed_by": "reviewer-uuid",
    "review_notes": "Approved"
  }'
```

### Reject Request
```bash
curl -X PUT http://localhost:3000/api/leave/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "id": "request-uuid",
    "status": "rejected",
    "reviewed_by": "reviewer-uuid",
    "review_notes": "Rejected - business needs"
  }'
```

## Next Steps

1. ✅ **Leave Request Creation** - Implemented
2. ✅ **Leave Request Approval** - Implemented
3. ✅ **Leave Request Rejection** - Implemented
4. ⏭️ **Wire UI to API** - Connect the leave request form to `/api/leave/requests`
5. ⏭️ **Admin Approval UI** - Build approval/rejection interface for HR
6. ⏭️ **Balance Display** - Show live balances on leave request form











