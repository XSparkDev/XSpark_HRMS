# Assigned Devices Database Schema

## Overview

This schema provides comprehensive tracking of device assignments in the Asset Management System. It supports both permanent assignments and temporary loans (borrowing), with full approval workflows and condition tracking.

## Prerequisites

Before running `assigned-devices-schema.sql`, ensure you have:

1. **Devices table** - Run `devices-schema.sql` first
2. **Employees table** - Must exist (from `complete-schema.sql`)
3. **Extensions** - `uuid-ossp` and `pgcrypto` (usually created automatically)

## Installation Order

```sql
1. devices-schema.sql          -- Creates devices table
2. assigned-devices-schema.sql -- Creates assigned_devices table and all related objects
```

## Schema Components

### Tables

#### `assigned_devices`
Main table tracking all device assignments with:
- Device and employee relationships
- Assignment dates (assigned, expected return, actual return)
- Condition tracking (when assigned and returned)
- Approval workflow fields
- Issue tracking
- Soft delete support

### ENUMs

1. **`assignment_status_enum`**
   - `pending` - Waiting for approval
   - `approved` - Approved and ready
   - `active` - Currently assigned
   - `returned` - Device returned
   - `overdue` - Past return date
   - `cancelled` - Assignment cancelled
   - `rejected` - Request rejected

2. **`assignment_type_enum`**
   - `permanent` - Permanent assignment
   - `temporary` - Temporary assignment
   - `loan` - Short-term loan
   - `repair` - Device sent for repair

3. **`device_condition_enum`**
   - `excellent` - Like new
   - `good` - Minor wear
   - `fair` - Visible wear but functional
   - `poor` - Significant wear/damage
   - `damaged` - Needs repair
   - `unusable` - Not usable

### Views

1. **`active_device_assignments`** - All currently active assignments
2. **`device_assignment_history`** - Complete assignment history for devices
3. **`employee_device_assignments`** - All devices assigned to employees
4. **`pending_device_assignments`** - Assignments waiting for approval
5. **`overdue_device_assignments`** - Assignments past their return date

### Functions

1. **`get_available_devices()`** - Get devices available for assignment
2. **`get_employee_assigned_devices()`** - Get all devices assigned to an employee
3. **`create_device_assignment()`** - Create a new device assignment
4. **`approve_device_assignment()`** - Approve a pending assignment
5. **`return_device_assignment()`** - Return a device

### Triggers

1. **`trigger_update_assigned_devices_updated_at`** - Auto-update `updated_at`
2. **`trigger_update_device_status_on_assignment`** - Auto-update device status
3. **`trigger_prevent_duplicate_active_assignments`** - Prevent duplicate active assignments

## Usage Examples

### Create a Device Assignment

```sql
-- Create a temporary assignment (requires approval)
SELECT create_device_assignment(
    p_device_id := 'device-uuid-here',
    p_employee_id := 'employee-uuid-here',
    p_assigned_by := 'supervisor-uuid-here',
    p_assignment_type := 'temporary',
    p_expected_return_date := '2025-12-31',
    p_purpose := 'Work from home setup',
    p_assignment_notes := 'Employee needs laptop for remote work',
    p_approval_required := TRUE
);
```

### Approve an Assignment

```sql
SELECT approve_device_assignment(
    p_assignment_id := 'assignment-uuid-here',
    p_approved_by := 'supervisor-uuid-here'
);
```

### Return a Device

```sql
SELECT return_device_assignment(
    p_assignment_id := 'assignment-uuid-here',
    p_returned_condition := 'good',
    p_return_notes := 'Device returned in good condition',
    p_verified_by := 'supervisor-uuid-here'
);
```

### Get Available Devices

```sql
-- Get all available laptops
SELECT * FROM get_available_devices(
    p_device_type := 'laptop',
    p_limit := 20,
    p_offset := 0
);
```

### Get Employee's Assigned Devices

```sql
SELECT * FROM get_employee_assigned_devices('employee-uuid-here');
```

### Query Views

```sql
-- Get all active assignments
SELECT * FROM active_device_assignments;

-- Get assignment history for a device
SELECT * FROM device_assignment_history 
WHERE device_id = 'device-uuid-here';

-- Get all devices assigned to an employee
SELECT * FROM employee_device_assignments 
WHERE employee_id = 'employee-uuid-here';

-- Get pending approvals
SELECT * FROM pending_device_assignments;

-- Get overdue assignments
SELECT * FROM overdue_device_assignments;
```

## Direct Table Queries

### Insert Assignment Manually

```sql
INSERT INTO assigned_devices (
    device_id,
    employee_id,
    assigned_by,
    assignment_type,
    status,
    expected_return_date,
    purpose,
    approval_required
) VALUES (
    'device-uuid',
    'employee-uuid',
    'supervisor-uuid',
    'temporary',
    'pending',
    '2025-12-31',
    'Project work',
    TRUE
);
```

### Update Assignment Status

```sql
UPDATE assigned_devices
SET status = 'approved',
    approved_by = 'supervisor-uuid',
    approved_at = NOW()
WHERE id = 'assignment-uuid';
```

### Mark Device as Returned

```sql
UPDATE assigned_devices
SET status = 'returned',
    actual_return_date = NOW(),
    returned_condition = 'good',
    return_notes = 'Device returned in good condition'
WHERE id = 'assignment-uuid';
```

## API Integration

### Example API Endpoint Structure

```typescript
// POST /api/assignments - Create assignment
// GET /api/assignments - List assignments (with filters)
// GET /api/assignments/:id - Get assignment details
// PATCH /api/assignments/:id/approve - Approve assignment
// PATCH /api/assignments/:id/return - Return device
// GET /api/assignments/employee/:employeeId - Get employee assignments
// GET /api/assignments/device/:deviceId - Get device assignment history
// GET /api/assignments/pending - Get pending approvals
// GET /api/assignments/overdue - Get overdue assignments
```

## Constraints & Business Rules

1. **One Active Assignment Per Device** - A device can only have one active assignment at a time
2. **Return Date Validation** - Actual return date must be after assignment date
3. **Permanent Assignments** - Cannot have expected_return_date
4. **Return Condition Required** - Must specify condition when returning device
5. **Device Status Auto-Update** - Device status automatically updates based on assignment status

## Indexes

The schema includes 12+ indexes optimized for:
- Device lookups
- Employee assignments
- Status filtering
- Date-based queries
- Overdue detection
- Approval workflows
- Full-text search on notes

## Security Considerations

1. **RLS Policies** - Configure Row Level Security in Supabase
2. **Permissions** - Grant appropriate permissions to roles
3. **Audit Trail** - Consider adding audit logging for sensitive operations
4. **Data Encryption** - Sensitive notes may need encryption

## Maintenance

### Clean Up Old Assignments

```sql
-- Soft delete old returned assignments (older than 1 year)
UPDATE assigned_devices
SET deleted_at = NOW()
WHERE status = 'returned'
AND actual_return_date < NOW() - INTERVAL '1 year'
AND deleted_at IS NULL;
```

### Find Devices Needing Attention

```sql
-- Devices with overdue assignments
SELECT * FROM overdue_device_assignments;

-- Devices in maintenance that should be available
SELECT * FROM devices 
WHERE status = 'maintenance' 
AND id NOT IN (
    SELECT device_id FROM assigned_devices 
    WHERE status IN ('approved', 'active')
);
```

## Migration Notes

If you're adding this to an existing database:

1. Check for existing device assignment data in other tables
2. Migrate existing data to `assigned_devices` table
3. Update device statuses to match assignment statuses
4. Test all triggers and functions
5. Update API endpoints to use new schema

## Troubleshooting

### Error: "Device already has an active assignment"
- Check for existing active assignments: `SELECT * FROM assigned_devices WHERE device_id = '...' AND status IN ('approved', 'active')`
- Return or cancel existing assignment before creating new one

### Error: "Device not found"
- Ensure device exists: `SELECT * FROM devices WHERE id = '...'`
- Check if device is soft-deleted: `SELECT * FROM devices WHERE id = '...' AND deleted_at IS NULL`

### Trigger Not Firing
- Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname LIKE '%assigned_devices%'`
- Verify function exists: `SELECT * FROM pg_proc WHERE proname LIKE '%assigned_devices%'`

## Support

For issues or questions about this schema, refer to:
- Database documentation in `/database/`
- API documentation in `/app/api/`
- Implementation examples in the codebase







