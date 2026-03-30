# Device History API - Postman Request

## Endpoint
**GET** `/api/devices/[deviceId]/history`

## Description
Retrieves combined history of borrows and incidents for a specific device. The device can be identified by:
- `device_id` (UUID)
- `asset_tag`
- `serial_number`

## Request Details

### URL
```
GET http://localhost:3000/api/devices/{deviceId}/history
```

### Example URLs
```
# Using device_id (UUID)
GET http://localhost:3000/api/devices/5cb28a2b-5b56-401a-ac0e-c84fc2f32c5d/history

# Using asset_tag
GET http://localhost:3000/api/devices/ASSET-001/history

# Using serial_number
GET http://localhost:3000/api/devices/SN123456789/history
```

### Headers
```
Content-Type: application/json
Accept: application/json
```

### Query Parameters
None required. The `deviceId` is part of the URL path.

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "borrows": [
      {
        "idx": 0,
        "borrow_id": "1479b202-674d-4fa3-bdfb-26c6b7ab1245",
        "device_id": "5cb28a2b-5b56-401a-ac0e-c84fc2f32c5d",
        "borrowed_by": "acda84df-869b-419c-b3f2-a79cbc44e217",
        "borrow_date": "2026-01-09 13:59:18.038+00",
        "return_date": "2026-01-27 00:00:00+00",
        "is_borrowed": false,
        "notes": "Testing",
        "qr_code_url": null,
        "status": "pending",
        "approval_status": "pending_approval",
        "approved_by": null,
        "approved_at": null,
        "picked_up_at": null,
        "returned_at": null
      }
    ],
    "incidents": [
      {
        "incident_id": "abc123-...",
        "device_id": "5cb28a2b-5b56-401a-ac0e-c84fc2f32c5d",
        "reported_by": "acda84df-869b-419c-b3f2-a79cbc44e217",
        "incident_type": "Damage",
        "description": "Screen cracked",
        "severity": "High",
        "status": "Open",
        "resolved_by": null,
        "resolved_at": null,
        "resolution_notes": null,
        "created_at": "2026-01-10 10:00:00+00",
        "updated_at": "2026-01-10 10:00:00+00"
      }
    ],
    "total": 7
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Device ID
```json
{
  "success": false,
  "error": "Device ID is required"
}
```

#### 404 Not Found - Device Not Found
```json
{
  "success": false,
  "error": "Device not found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to fetch device history"
}
```

## Postman Collection JSON

```json
{
  "info": {
    "name": "Device History API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Device History by device_id",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Accept",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "http://localhost:3000/api/devices/5cb28a2b-5b56-401a-ac0e-c84fc2f32c5d/history",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "devices", "5cb28a2b-5b56-401a-ac0e-c84fc2f32c5d", "history"]
        }
      },
      "response": []
    },
    {
      "name": "Get Device History by asset_tag",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Accept",
            "value": "application/json"
          }
        ],
        "url": {
          "raw": "http://localhost:3000/api/devices/ASSET-001/history",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "devices", "ASSET-001", "history"]
        }
      },
      "response": []
    }
  ]
}
```

## Testing in Postman

1. **Create a new GET request**
   - Method: `GET`
   - URL: `http://localhost:3000/api/devices/{deviceId}/history`

2. **Set Headers**
   - `Content-Type: application/json`
   - `Accept: application/json`

3. **Replace `{deviceId}`** with one of:
   - A valid `device_id` UUID (e.g., `5cb28a2b-5b56-401a-ac0e-c84fc2f32c5d`)
   - A valid `asset_tag` (e.g., `ASSET-001`)
   - A valid `serial_number` (e.g., `SN123456789`)

4. **Send the request**

## Example cURL Command

```bash
curl -X GET \
  'http://localhost:3000/api/devices/5cb28a2b-5b56-401a-ac0e-c84fc2f32c5d/history' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'
```

## Notes

- The endpoint accepts flexible device identifiers (device_id, asset_tag, or serial_number)
- Both borrows and incidents are fetched in parallel for performance
- The response includes a `total` count of all records (borrows + incidents)
- Borrows are ordered by `borrow_date` (most recent first)
- Incidents are ordered by `created_at` (most recent first)
