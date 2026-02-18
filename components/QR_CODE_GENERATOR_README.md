# QR Code Generator Component

A React component for generating QR codes that link to device asset pages.

## Features

- Generate QR codes for device IDs (e.g., DEV-019)
- Automatically creates URLs pointing to `/assets/[deviceId]` route
- Copy QR code URL to clipboard
- Download QR code as PNG image
- Open device page in new tab
- Works as both standalone component and dialog modal

## Usage

### Basic Usage

```tsx
import { QRCodeGenerator } from "@/components/qr-code-generator"

// In your component
<QRCodeGenerator 
  deviceId="DEV-019"
  deviceName="MacBook Pro 14"
/>
```

### With Dialog Modal

```tsx
import { QRCodeGeneratorDialog } from "@/components/qr-code-generator"

const [isOpen, setIsOpen] = useState(false)

<Button onClick={() => setIsOpen(true)}>
  Generate QR Code
</Button>

<QRCodeGeneratorDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  deviceId="DEV-019"
  deviceName="MacBook Pro 14"
/>
```

### In Device List/Details Page

```tsx
import { QRCodeGenerator } from "@/components/qr-code-generator"
import { Button } from "@/components/ui/button"
import { useState } from "react"

function DeviceCard({ device }) {
  const [showQR, setShowQR] = useState(false)

  return (
    <div>
      <Button onClick={() => setShowQR(true)}>
        Generate QR Code
      </Button>
      
      {showQR && (
        <QRCodeGenerator
          deviceId={device.device_id}
          deviceName={`${device.brand} ${device.model}`}
        />
      )}
    </div>
  )
}
```

## Props

### QRCodeGenerator

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `deviceId` | `string` | No | The device ID to generate QR code for (e.g., "DEV-019") |
| `deviceName` | `string` | No | Optional device name for display |
| `onGenerate` | `(qrData: string) => void` | No | Callback when QR code is generated |
| `className` | `string` | No | Additional CSS classes |

### QRCodeGeneratorDialog

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Controls dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | Yes | Callback when dialog state changes |
| `deviceId` | `string` | No | The device ID to generate QR code for |
| `deviceName` | `string` | No | Optional device name for display |

## How It Works

1. **QR Code Generation**: Uses a free QR code API service (`api.qrserver.com`) to generate QR codes
2. **URL Format**: Creates URLs in the format: `{origin}/assets/{deviceId}`
3. **Features**:
   - **Copy URL**: Copies the full asset URL to clipboard
   - **Download**: Downloads the QR code image as PNG
   - **Open Link**: Opens the device asset page in a new tab

## Alternative: Client-Side QR Generation

If you prefer client-side QR code generation (no external API dependency), you can install `qrcode.react`:

```bash
npm install qrcode.react
# or
pnpm add qrcode.react
```

Then update the component to use the library instead of the API. Here's an example modification:

```tsx
import { QRCodeSVG } from 'qrcode.react'

// Replace the img tag with:
<QRCodeSVG
  value={`${window.location.origin}/assets/${qrValue}`}
  size={256}
  level="H"
  includeMargin={true}
/>
```

## Integration with Device Pages

The QR codes generated link to the `/assets/[deviceId]` route, which displays device information without requiring authentication. This makes it perfect for:

- Physical asset labels
- Quick device lookup via mobile scanning
- Inventory management
- Asset tracking

## Example Integration in Device Management

```tsx
// In app/ams-devices/list/page.tsx or similar
import { QRCodeGeneratorDialog } from "@/components/qr-code-generator"
import { QrCode } from "lucide-react"

function DeviceRow({ device }) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setQrDialogOpen(true)}
      >
        <QrCode className="h-4 w-4" />
      </Button>

      <QRCodeGeneratorDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        deviceId={device.device_id}
        deviceName={`${device.brand} ${device.model}`}
      />
    </>
  )
}
```

## Notes

- The component automatically uses the current window origin for URL generation
- QR codes are generated at 300x300 pixels
- The component handles empty/invalid device IDs gracefully
- Toast notifications are used for user feedback
