# AMS Postman Test Requests

This document contains ready-to-use Postman requests for testing the Asset Management System (AMS) API.

## Prerequisites

 1. Make sure your Next.js dev server is running:
    ```bash
    npm run dev
    # or
    yarn dev
    ```

 2. Set up environment variables in Postman:
    - `base_url`: `http://localhost:3000`
    - `auth_token`: Your authenticated user's session token/cookie (optional for now)

2. Create a collection in Postman called "AMS Tests"

## Request 1: Create a New Resource

**Method:** `POST`

**URL:** `{{base_url}}/api/resources`

**Headers:**
```
Content-Type: application/json
apikey: {{supabase_anon_key}}
Authorization: Bearer {{auth_token}}
Prefer: return=representation
```

**Body (JSON):**
```json
{
  "resource_id": "Res004",
  "resource_name": "Meeting Room B",
  "resource_type": "Boardroom",
  "description": "Medium-sized conference room with projector",
  "location": "Building 1, Floor 3, Room 302",
  "capacity": 15,
  "condition": "Good",
  "is_available": true,
  "notes": "Includes whiteboard and 4K projector"
}
```

**Expected Response:**
```json
{
  "resource_id": "Res004",
  "resource_name": "Meeting Room B",
  "resource_type": "Boardroom",
  "description": "Medium-sized conference room with projector",
  "location": "Building 1, Floor 3, Room 302",
  "capacity": 15,
  "condition": "Good",
  "qr_code_url": null,
  "is_available": true,
  "notes": "Includes whiteboard and 4K projector",
  "created_by": "user-uuid-here",
  "created_at": "2025-01-23T10:30:00Z",
  "updated_at": "2025-01-23T10:30:00Z"
}
```

---

## Request 2: Create a Booking

**Method:** `POST`

**URL:** `{{base_url}}/api/bookings`

**Headers:**
```
Content-Type: application/json
apikey: {{supabase_anon_key}}
Authorization: Bearer {{auth_token}}
Prefer: return=representation
```

**Body (JSON):**
```json
{
  "booking_id": "xsp_Bk2501",
  "resource_id": "Res004",
  "booked_by": "user-uuid-here",
  "booking_reason": "Team meeting - Q4 planning",
  "start_time": "2025-01-25T09:00:00Z",
  "end_time": "2025-01-25T11:00:00Z",
  "status": "Pending",
  "is_recurring": false,
  "meeting_category": "Internal"
}
```

**Expected Response:**
```json
{
  "booking_id": "xsp_Bk2501",
  "resource_id": "Res004",
  "booked_by": "user-uuid-here",
  "booking_reason": "Team meeting - Q4 planning",
  "start_time": "2025-01-25T09:00:00Z",
  "end_time": "2025-01-25T11:00:00Z",
  "status": "Pending",
  "is_recurring": false,
  "recurrence_pattern": null,
  "recurrence_end_date": null,
  "meeting_category": "Internal",
  "approved_by": null,
  "approved_at": null,
  "rejection_reason": null,
  "created_at": "2025-01-23T10:35:00Z",
  "updated_at": "2025-01-23T10:35:00Z"
}
```

---

## Request 3: Report an Incident

**Method:** `POST`

**URL:** `{{base_url}}/api/incidents`

**Headers:**
```
Content-Type: application/json
apikey: {{supabase_anon_key}}
Authorization: Bearer {{auth_token}}
Prefer: return=representation
```

**Body (JSON):**
```json
{
  "resource_id": "Res001",
  "reported_by": "user-uuid-here",
  "incident_type": "Malfunction",
  "description": "Projector is not turning on. No response when pressing power button. Last worked yesterday.",
  "severity": "High",
  "status": "Open"
}
```

**Expected Response:**
```json
{
  "incident_id": "uuid-generated-here",
  "resource_id": "Res001",
  "reported_by": "user-uuid-here",
  "incident_type": "Malfunction",
  "description": "Projector is not turning on. No response when pressing power button. Last worked yesterday.",
  "severity": "High",
  "status": "Open",
  "resolved_by": null,
  "resolved_at": null,
  "resolution_notes": null,
  "created_at": "2025-01-23T10:40:00Z",
  "updated_at": "2025-01-23T10:40:00Z"
}
```

---

## Additional Useful Requests

### Get All Resources
**Method:** `GET`

**URL:** `{{base_url}}/api/resources`

**Headers:**
```
apikey: {{supabase_anon_key}}
Authorization: Bearer {{auth_token}}
```

---

### Get All Bookings
**Method:** `GET`

**URL:** `{{base_url}}/api/bookings?limit=10`

**Headers:**
```
apikey: {{supabase_anon_key}}
Authorization: Bearer {{auth_token}}
```

---

### Get Available Resources
**Method:** `GET`

**URL:** `{{base_url}}/api/resources?is_available=true`

**Headers:**
```
apikey: {{supabase_anon_key}}
Authorization: Bearer {{auth_token}}
```

---

### Approve a Booking
**Method:** `PATCH`

**URL:** `{{base_url}}/api/bookings/xsp_Bk2501`

**Headers:**
```
Content-Type: application/json
apikey: {{supabase_anon_key}}
Authorization: Bearer {{auth_token}}
Prefer: return=representation
```

**Body (JSON):**
```json
{
  "status": "Approved",
  "approved_by": "admin-uuid-here",
  "approved_at": "2025-01-23T10:45:00Z"
}
```

---

### Resolve an Incident
**Method:** `PATCH`

**URL:** `{{base_url}}/api/incidents/incident-uuid-here`

**Headers:**
```
Content-Type: application/json
apikey: {{supabase_anon_key}}
Authorization: Bearer {{auth_token}}
Prefer: return=representation
```

**Body (JSON):**
```json
{
  "status": "Resolved",
  "resolved_by": "admin-uuid-here",
  "resolved_at": "2025-01-23T11:00:00Z",
  "resolution_notes": "Power supply replaced. Projector working normally now."
}
```

---

## Notes

1. Replace `user-uuid-here` with actual user IDs from your `users` table
2. Replace `admin-uuid-here` with actual admin user IDs
3. Replace `incident-uuid-here` with actual incident IDs
4. Adjust timestamps to current date/time
5. The `booking_id` and `resource_id` should follow your naming conventions

## Testing Order

1. First create a resource (Request 1)
2. Then create a booking for that resource (Request 2)
3. Then report an incident for another resource (Request 3)
4. Test GET requests to verify data
5. Test UPDATE requests to approve booking or resolve incident

## Troubleshooting

If you get authentication errors:
- Make sure your JWT token is valid
- Check that RLS policies allow your operation
- Verify user roles in the `users` table

If you get "relation does not exist" errors:
- Ensure you've run the `ams-migration.sql` script
- Verify tables exist in your Supabase dashboard

