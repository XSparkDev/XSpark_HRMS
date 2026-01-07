# Devices Service - Get Device Functions

This document describes all the `getDevice` functions available in `devices-service.ts` and their functionalities.

## Overview

The `DevicesService` class provides three main functions for retrieving device records from the database:

1. `getDeviceById(id: string)` - Get a single device by its device_id
2. `getDeviceByIdentifier(identifier: string)` - Get a device using multiple lookup strategies
3. `getDevicesByIds(ids: string[])` - Get multiple devices by their IDs

---

## 1. `getDeviceById(id: string)`

### Function Signature
```typescript
async getDeviceById(id: string): Promise<DeviceRecord | null>
```

### Location
Lines 168-181 in `devices-service.ts`

### Functionality
- **Purpose**: Retrieves a single device record by its `device_id` (primary key)
- **Database Query**: `SELECT * FROM devices WHERE device_id = {id} LIMIT 1`
- **Client Used**: Uses the `supabase` anon client (not admin client)
- **Returns**: 
  - `DeviceRecord | null` - The device record if found, `null` if not found
- **Error Handling**: Uses `executeQuery` wrapper which handles errors gracefully

### Implementation Details
```typescript
async getDeviceById(id: string): Promise<DeviceRecord | null> {
  return this.executeQuery<DeviceRecord | null>(
    async () => {
      // Use device_id as the primary key (matches database schema)
      const { data, error } = await supabase
        .from(this.table)
        .select('*')
        .eq('device_id', id)
        .maybeSingle()
      return { data: data ? this.normalizeDeviceRecord(data) : null, error }
    },
    'get device by id',
  )
}
```

### Usage Example
```typescript
const device = await devicesService.getDeviceById('device-uuid-here')
if (device) {
  console.log('Device found:', device.asset_tag)
} else {
  console.log('Device not found')
}
```

### Key Features
- Uses `maybeSingle()` which returns `null` if no record is found (doesn't throw error)
- Normalizes the device record (adds `id` alias for backward compatibility)
- Uses anon client (respects RLS policies)

---

## 2. `getDeviceByIdentifier(identifier: string)`

### Function Signature
```typescript
async getDeviceByIdentifier(identifier: string): Promise<DeviceRecord | null>
```

### Location
Lines 183-224 in `devices-service.ts`

### Functionality
- **Purpose**: Retrieves a device using multiple lookup strategies (flexible identifier matching)
- **Lookup Strategies** (in order):
  1. **By device_id**: Tries `getDeviceById(identifier)` first
  2. **By UUID (id column)**: If identifier looks like a UUID, tries `id` column
  3. **By asset_tag**: Searches by asset tag (e.g., "DEV-001")
  4. **By serial_number**: Searches by serial number (e.g., "SN123456")
- **Client Used**: Uses `supabaseAdmin` for admin operations (bypasses RLS)
- **Returns**: 
  - `DeviceRecord | null` - The device record if found, `null` if not found
- **Error Handling**: Gracefully handles errors and returns `null` if device not found

### Implementation Details
```typescript
async getDeviceByIdentifier(identifier: string): Promise<DeviceRecord | null> {
  // Try multiple lookup strategies: device_id, asset_tag, serial_number
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  // First, try by device_id
  let device = await this.getDeviceById(identifier).catch(() => null)
  if (device) return device
  
  // If looks like UUID, try by id column
  if (uuidRegex.test(identifier)) {
    const { data, error } = await this.admin
      .from(this.table)
      .select('*')
      .eq('id', identifier)
      .maybeSingle()
    if (!error && data) {
      return this.normalizeDeviceRecord(data)
    }
  }
  
  // Try by asset_tag
  const { data: assetTagData, error: assetTagError } = await this.admin
    .from(this.table)
    .select('*')
    .eq('asset_tag', identifier)
    .maybeSingle()
  if (!assetTagError && assetTagData) {
    return this.normalizeDeviceRecord(assetTagData)
  }
  
  // Try by serial_number
  const { data: serialData, error: serialError } = await this.admin
    .from(this.table)
    .select('*')
    .eq('serial_number', identifier)
    .maybeSingle()
  if (!serialError && serialData) {
    return this.normalizeDeviceRecord(serialData)
  }
  
  return null
}
```

### Usage Examples
```typescript
// By device_id
const device1 = await devicesService.getDeviceByIdentifier('device-uuid-here')

// By asset_tag
const device2 = await devicesService.getDeviceByIdentifier('DEV-001')

// By serial_number
const device3 = await devicesService.getDeviceByIdentifier('SN123456')

// By UUID (id column)
const device4 = await devicesService.getDeviceByIdentifier('550e8400-e29b-41d4-a716-446655440000')
```

### Key Features
- **Flexible Lookup**: Tries multiple strategies automatically
- **UUID Detection**: Automatically detects UUID format and tries `id` column
- **Fallback Chain**: Tries each method in sequence until one succeeds
- **Admin Client**: Uses admin client to bypass RLS for flexible lookups
- **No Errors**: Returns `null` gracefully if device not found (doesn't throw)

---

## 3. `getDevicesByIds(ids: string[])`

### Function Signature
```typescript
async getDevicesByIds(ids: string[]): Promise<DeviceRecord[]>
```

### Location
Lines 226-252 in `devices-service.ts`

### Functionality
- **Purpose**: Retrieves multiple device records by their `device_id` values in a single query
- **Database Query**: `SELECT * FROM devices WHERE device_id IN (id1, id2, id3, ...)`
- **Client Used**: Uses `supabaseAdmin` for admin operations
- **Returns**: 
  - `DeviceRecord[]` - Array of device records (empty array if none found)
- **Error Handling**: Uses `executeQueryArray` wrapper which handles errors gracefully

### Implementation Details
```typescript
async getDevicesByIds(ids: string[]): Promise<DeviceRecord[]> {
  const sanitizedIds = Array.from(
    new Set(
      (ids ?? [])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  )

  if (sanitizedIds.length === 0) {
    return []
  }

  return this.executeQueryArray<DeviceRecord>(
    async () => {
      const { data, error } = await this.admin
        .from(this.table)
        .select('*')
        .in('device_id', sanitizedIds)
      return {
        data: data ? data.map((record: Record<string, any>) => this.normalizeDeviceRecord(record)) : [],
        error,
      }
    },
    'get devices by ids',
  )
}
```

### Usage Example
```typescript
const deviceIds = ['device-uuid-1', 'device-uuid-2', 'device-uuid-3']
const devices = await devicesService.getDevicesByIds(deviceIds)
console.log(`Found ${devices.length} devices`)
```

### Key Features
- **Bulk Lookup**: Efficiently retrieves multiple devices in a single database query
- **Input Sanitization**: 
  - Removes duplicates using `Set`
  - Trims whitespace from IDs
  - Filters out empty strings
  - Returns empty array if input is empty/null
- **Normalization**: All returned records are normalized (adds `id` alias)
- **Performance**: Single query is more efficient than multiple individual queries

---

## Common Features Across All Functions

### 1. **Record Normalization**
All functions use `normalizeDeviceRecord()` which:
- Ensures `device_id` is always present
- Adds `id` as an alias for `device_id` (backward compatibility)
- Preserves all other device fields

### 2. **Error Handling**
- All functions handle errors gracefully
- Return `null` or empty array instead of throwing errors
- Log errors for debugging

### 3. **Database Connection**
- `getDeviceById`: Uses `supabase` (anon client, respects RLS)
- `getDeviceByIdentifier`: Uses `supabaseAdmin` (bypasses RLS)
- `getDevicesByIds`: Uses `supabaseAdmin` (bypasses RLS)

### 4. **Table Reference**
- All functions query the `devices` table
- Defined as `private readonly table = 'devices'`

---

## Summary Table

| Function | Input | Output | Lookup Method | Client | Use Case |
|----------|-------|--------|---------------|--------|----------|
| `getDeviceById` | `string` (device_id) | `DeviceRecord \| null` | Single: device_id | anon | Simple ID lookup |
| `getDeviceByIdentifier` | `string` (flexible) | `DeviceRecord \| null` | Multiple: device_id, id, asset_tag, serial_number | admin | Flexible identifier lookup |
| `getDevicesByIds` | `string[]` (device_ids) | `DeviceRecord[]` | Bulk: device_id IN (...) | admin | Bulk device retrieval |

---

## When to Use Each Function

### Use `getDeviceById` when:
- You have the exact `device_id` (UUID)
- You want RLS policies to be respected
- You need a simple, direct lookup

### Use `getDeviceByIdentifier` when:
- You have an identifier but don't know which field it matches
- You might have asset_tag, serial_number, or UUID
- You need flexible lookup capabilities
- You want to bypass RLS policies

### Use `getDevicesByIds` when:
- You need to retrieve multiple devices at once
- You have an array of device IDs
- You want to optimize performance (single query vs multiple)
- You want to bypass RLS policies

---

## Related Functions

The service also provides:
- `listDevices(filters)` - List devices with filters and pagination
- `createDevice(payload)` - Create a new device
- `updateDevice(id, updates)` - Update a device
- `deleteDevice(id, options)` - Delete/soft-delete a device
- `markDeviceAsBorrowed(deviceId, employeeId)` - Mark device as borrowed
- `markDeviceAsAvailable(deviceId)` - Mark device as available
- `setDeviceStatus(id, status)` - Update device status


