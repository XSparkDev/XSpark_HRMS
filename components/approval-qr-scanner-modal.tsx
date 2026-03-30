"use client"

import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { QRScanner as QRScannerComponent } from "@/components/qr-scanner"
import { CheckCircle2, X } from "lucide-react"

interface ApprovalQRScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestType: "borrow" | "return"
  requestId: string
  deviceId: string
  assetTag?: string | null
  deviceName?: string
  employeeName?: string
  onScanSuccess: (scannedCode: string) => void
  onError?: (error: string) => void
}

export function ApprovalQRScannerModal({
  open,
  onOpenChange,
  requestType,
  requestId,
  deviceId,
  assetTag,
  deviceName,
  employeeName,
  onScanSuccess,
  onError,
}: ApprovalQRScannerModalProps) {
  const [scannedCode, setScannedCode] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)

  const handleScan = useCallback(
    async (result: string) => {
      setScannedCode(result)
      setError(null)
      setValidating(true)

      try {
        // Validate the scanned code against the device
        // Use the device API endpoint which supports flexible identifier lookup
        const scannedCode = result.trim()
        const response = await fetch(`/api/devices/${encodeURIComponent(scannedCode)}`, {
          cache: "no-store",
        })
        const json = await response.json()
        
        if (!response.ok || !json.success || !json.data) {
          throw new Error("Device not found with scanned code")
        }

        const device = json.data

        // Validate that the scanned device matches the requested device
        // Compare by device_id, asset_tag, or serial_number
        const requestedDeviceId = deviceId?.toLowerCase().trim()
        const scannedDeviceId = device.device_id?.toLowerCase().trim() || device.id?.toLowerCase().trim()
        const requestedAssetTag = assetTag?.toLowerCase().trim()
        const scannedAssetTag = device.asset_tag?.toLowerCase().trim()
        const scannedSerialNumber = device.serial_number?.toLowerCase().trim()

        const deviceIdMatches = requestedDeviceId && scannedDeviceId && requestedDeviceId === scannedDeviceId
        const assetTagMatches = requestedAssetTag && scannedAssetTag && requestedAssetTag === scannedAssetTag
        const serialMatches = requestedAssetTag && scannedSerialNumber && requestedAssetTag === scannedSerialNumber
        const scannedMatchesRequested = scannedCode.toLowerCase() === requestedDeviceId || 
                                       scannedCode.toLowerCase() === requestedAssetTag

        if (!deviceIdMatches && !assetTagMatches && !serialMatches && !scannedMatchesRequested) {
          throw new Error("Scanned device does not match the requested device")
        }

        // Success - call callback
        setValidating(false)
        onScanSuccess(result)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Invalid device scanned"
        setError(errorMessage)
        setValidating(false)
        onError?.(errorMessage)
      }
    },
    [deviceId, assetTag, onScanSuccess, onError],
  )

  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage)
      onError?.(errorMessage)
    },
    [onError],
  )

  const handleClose = useCallback(() => {
    setScannedCode("")
    setError(null)
    setValidating(false)
    onOpenChange(false)
  }, [onOpenChange])

  const title = requestType === "borrow" ? "Scan Device to Approve Borrow" : "Scan Device to Approve Return"
  const instruction =
    requestType === "borrow"
      ? "Please scan the device QR code to approve the borrow request."
      : "Please scan the device QR code to approve the return request."

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg space-y-4">
        <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{instruction}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
          {/* Request Info */}
          {deviceName && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-1">
              <Label className="text-xs text-muted-foreground">Device</Label>
              <p className="text-sm font-medium">{deviceName}</p>
              {assetTag && (
                <>
                  <Label className="text-xs text-muted-foreground mt-2 block">Expected Asset Tag</Label>
                  <p className="text-sm font-mono">{assetTag}</p>
                </>
              )}
              {employeeName && (
                <>
                  <Label className="text-xs text-muted-foreground mt-2 block">Requester</Label>
                  <p className="text-sm">{employeeName}</p>
                </>
              )}
            </div>
          )}

          {/* QR Scanner Container */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Device QR Code</Label>
            <div className="border border-[#E4E4E7] rounded-lg p-4 bg-muted/50">
              <QRScannerComponent
                onScan={handleScan}
                onError={handleError}
                className="w-full"
                expectedCode={assetTag || deviceId}
              />
              {scannedCode && !error && (
                <div className="mt-3 p-2 bg-[#16A34A]/10 border border-[#16A34A]/30 rounded">
                  <p className="text-sm text-[#16A34A] flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Valid device scanned: <span className="font-mono font-semibold">{scannedCode}</span>
                  </p>
                </div>
              )}
              {error && (
                <div className="mt-3 p-2 bg-[#BE1E2D]/10 border border-[#BE1E2D]/30 rounded">
                  <p className="text-sm text-[#BE1E2D] flex items-center gap-2">
                    <X className="h-4 w-4" />
                    {error}
                  </p>
                </div>
              )}
              {validating && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-800">Validating scanned device...</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={validating}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
