# Resource API Payload Examples

## POST /api/resources - Create a Resource

### Required Fields
- `resource_id` (string) - Unique identifier for the resource
- `resource_name` (string) - Name of the resource

### Optional Fields
- `resource_type` (string) - Type of resource (e.g., "Room", "Device")
- `description` (string) - Description of the resource
- `location` (string) - Physical location
- `capacity` (number) - Capacity (for rooms/venues)
- `condition` (string) - Condition status: "excellent", "good", "fair", "poor", "damaged", "unusable"
- `is_available` (boolean) - Availability status (default: true)
- `notes` (string) - Additional notes

---

## Example 1: Conference Room

```json
{
  "resource_id": "Res011",
  "resource_name": "Conference Room A",
  "resource_type": "Room",
  "description": "Large conference room with video conferencing equipment",
  "location": "HQ Building 1 · Floor 3 · Room 301",
  "capacity": 25,
  "condition": "good",
  "is_available": true,
  "notes": "Includes smart board and projector"
}
```

## Example 2: Meeting Room (Minimal)

```json
{
  "resource_id": "Res012",
  "resource_name": "Meeting Room B",
  "resource_type": "Room",
  "capacity": 10,
  "is_available": true
}
```

## Example 3: Equipment/Device

```json
{
  "resource_id": "Res013",
  "resource_name": "Projector System",
  "resource_type": "Device",
  "description": "High-definition projector with wireless connectivity",
  "location": "Equipment Storage · Shelf 5",
  "condition": "excellent",
  "is_available": true,
  "notes": "Requires HDMI cable"
}
```

## Example 4: Room with All Fields

```json
{
  "resource_id": "Res014",
  "resource_name": "Training Center",
  "resource_type": "Room",
  "description": "Large training facility with seating for 50 people",
  "location": "HQ Building 2 · Floor 1 · Training Center",
  "capacity": 50,
  "condition": "excellent",
  "is_available": true,
  "notes": "Includes 50 laptops, whiteboards, and presentation screen. Book 48 hours in advance."
}
```

## Example 5: Unavailable Resource

```json
{
  "resource_id": "Res015",
  "resource_name": "Maintenance Room",
  "resource_type": "Room",
  "description": "Room under maintenance",
  "location": "HQ Building 1 · Basement",
  "condition": "poor",
  "is_available": false,
  "notes": "Under renovation until further notice"
}
```

---

## Condition Values

Allowed condition values (case-insensitive, will be normalized):
- `"excellent"` or `"Excellent"`
- `"good"` or `"Good"`
- `"fair"` or `"Fair"`
- `"poor"` or `"Poor"`
- `"damaged"` or `"Damaged"`
- `"unusable"` or `"Unusable"`

---

## cURL Examples

### Create a Resource

```bash
curl -X POST "http://localhost:3000/api/resources" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "Res011",
    "resource_name": "Conference Room A",
    "resource_type": "Room",
    "description": "Large conference room",
    "location": "HQ Building 1 · Floor 3",
    "capacity": 25,
    "condition": "good",
    "is_available": true
  }'
```

### Get All Resources

```bash
curl -X GET "http://localhost:3000/api/resources?limit=200"
```

### Get Available Resources Only

```bash
curl -X GET "http://localhost:3000/api/resources?is_available=true&limit=200"
```

### Get Resources by Type

```bash
curl -X GET "http://localhost:3000/api/resources?resource_type=Room&limit=200"
```

---

## Response Format

### Success Response (201 Created)

```json
{
  "resource_id": "Res011",
  "resource_name": "Conference Room A",
  "resource_type": "Room",
  "description": "Large conference room",
  "location": "HQ Building 1 · Floor 3",
  "capacity": 25,
  "condition": "good",
  "is_available": true,
  "notes": null,
  "created_at": "2025-11-25T14:00:00.000Z",
  "updated_at": "2025-11-25T14:00:00.000Z"
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "Invalid resource data",
  "details": [
    {
      "path": ["resource_id"],
      "message": "Required"
    }
  ]
}
```

### Error Response (409 Conflict)

```json
{
  "success": false,
  "error": "Resource ID already exists",
  "details": "duplicate key value violates unique constraint"
}
```




