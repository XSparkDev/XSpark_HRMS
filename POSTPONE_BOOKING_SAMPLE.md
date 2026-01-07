# Postpone Booking API - Sample Request

## Endpoint
```
POST {{base_url}}/api/room-bookings/postpone
```

## Request Headers
```
Content-Type: application/json
```

## Request Body
```json
{
  "booking_id": "your-booking-id-here",
  "new_start_time": "2024-01-20T15:30:00.000Z",
  "new_end_time": "2024-01-20T16:30:00.000Z"
}
```

## Example using cURL
```bash
curl -X POST "http://localhost:3001/api/room-bookings/postpone" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "abc123-booking-id",
    "new_start_time": "2024-01-20T15:30:00.000Z",
    "new_end_time": "2024-01-20T16:30:00.000Z"
  }'
```

## Example using JavaScript/Fetch
```javascript
const response = await fetch('/api/room-bookings/postpone', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    booking_id: 'abc123-booking-id',
    new_start_time: '2024-01-20T15:30:00.000Z',
    new_end_time: '2024-01-20T16:30:00.000Z',
  }),
})

const result = await response.json()
console.log(result)
```

## Expected Success Response (200 OK)
```json
{
  "success": true,
  "message": "Meeting postponed successfully",
  "data": {
    "booking": {
      "booking_id": "abc123-booking-id",
      "room_id": "room-uuid",
      "booked_by": "employee-uuid",
      "start_time": "15:30",
      "end_time": "16:30",
      "booking_reason": "...",
      "is_postponed": true,
      "postponed_from": "2024-01-20T14:00:00.000Z",
      "postponed_to": "2024-01-20T15:30:00.000Z",
      ...
    },
    "previous_start_time": "2024-01-20T14:00:00.000Z",
    "previous_end_time": "2024-01-20T15:00:00.000Z",
    "new_start_time": "2024-01-20T15:30:00.000Z",
    "new_end_time": "2024-01-20T16:30:00.000Z",
    "is_postponed": true
  }
}
```

## Error Responses

### 400 Bad Request - Invalid Payload
```json
{
  "success": false,
  "error": "Invalid postpone payload",
  "details": [
    {
      "path": ["booking_id"],
      "message": "Required"
    }
  ]
}
```

### 409 Conflict - Room Unavailable
```json
{
  "success": false,
  "error": "Room unavailable for selected time window"
}
```

### 404 Not Found - Booking Not Found
```json
{
  "success": false,
  "error": "Booking not found"
}
```

## Notes

1. **Time Format**: The `new_start_time` and `new_end_time` must be valid ISO 8601 datetime strings. Examples:
   - Full ISO: `"2024-01-20T15:30:00.000Z"`
   - ISO without milliseconds: `"2024-01-20T15:30:00Z"`
   - ISO without timezone (assumes UTC): `"2024-01-20T15:30:00"`

2. **Validation**: The service will:
   - Check that the booking exists
   - Verify the room is available for the new time slot
   - Update the booking with the new times
   - Set `is_postponed` to `true`
   - Store the original times in `postponed_from` and `postponed_to`

3. **Room Availability**: If the room is already booked for the new time window (by another booking), the request will fail with a 409 Conflict error.

