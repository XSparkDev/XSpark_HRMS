# Devices API - GET Request Examples

## Using devices-service.ts via API Endpoint

The `devices-service.ts` is accessed through the `/api/devices` endpoint. Here are examples of how to send GET requests:

### Basic GET Request

```javascript
// Fetch all devices (with pagination)
const response = await fetch('/api/devices?limit=50&offset=0', {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },
  cache: 'no-store',
})

const result = await response.json()
// Returns: { success: true, data: DeviceRecord[], meta: { count, limit, offset } }
```

### GET Request with Filters

```javascript
// Get devices by status
const response = await fetch('/api/devices?status=available&limit=100', {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
  },
  cache: 'no-store',
})

// Get devices by type
const response = await fetch('/api/devices?device_type=laptop&limit=100', {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
  },
  cache: 'no-store',
})

// Get devices assigned to a specific employee UUID
const employeeUuid = '550e8400-e29b-41d4-a716-446655440000'
const response = await fetch(`/api/devices?assigned_to=${employeeUuid}&limit=100`, {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
  },
  cache: 'no-store',
})
```

### cURL Examples

```bash
# Get all devices
curl -X GET "http://localhost:3000/api/devices?limit=50&offset=0" \
  -H "Accept: application/json"

# Get available devices only
curl -X GET "http://localhost:3000/api/devices?availableOnly=true&limit=100" \
  -H "Accept: application/json"

# Get devices assigned to employee
curl -X GET "http://localhost:3000/api/devices?assigned_to=550e8400-e29b-41d4-a716-446655440000&limit=100" \
  -H "Accept: application/json"
```

### Response Format

```json
{
  "success": true,
  "data": [
    {
      "device_id": "uuid-or-string",
      "asset_tag": "DEV-001",
      "serial_number": "SN123456",
      "device_type": "laptop",
      "brand": "Apple",
      "model": "MacBook Pro 14",
      "status": "available",
      "condition": "Good",
      "location": "HQ Building 1",
      "assigned_to": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "count": 24,
    "limit": 50,
    "offset": 0
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Failed to fetch devices",
  "details": "Error message here"
}
```


