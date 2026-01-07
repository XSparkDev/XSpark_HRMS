"use client"

import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { QRScanner } from "@/components/qr-scanner"
import { Label } from "@/components/ui/label"

type CollectScanDeviceModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "collect" | "return"
  borrowId?: string
  deviceId?: string
  onScanSuccess?: (scannedCode: string) => void
  onError?: (error: string) => void
}

export function CollectScanDeviceModal({
  open,
  onOpenChange,
  mode,
  borrowId,
  deviceId,
  onScanSuccess,
  onError,
}: CollectScanDeviceModalProps) {
  const [scannedCode, setScannedCode] = useState<string>("")
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleScan = useCallback(
    async (result: string) => {
      setScannedCode(result)
      setError(null)
      setScanning(true)

      try {
        // Call validation endpoint
        const response = await fetch("/api/device-scans/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            borrow_id: borrowId,
            device_id: deviceId,
            scanned_code: result,
            mode,
          }),
        })

        const json = await response.json().catch(() => ({}))

        if (!response.ok || json.success === false) {
          throw new Error(json?.error || "Incorrect device scanned.")
        }

        // Success - call callback
        onScanSuccess?.(result)
        setScanning(false)
        
        // Close modal after short delay
        setTimeout(() => {
          onOpenChange(false)
          setScannedCode("")
        }, 1000)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Incorrect device scanned."
        setError(errorMessage)
        setScanning(false)
        onError?.(errorMessage)
      }
    },
    [borrowId, deviceId, mode, onScanSuccess, onError, onOpenChange],
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
    setScanning(false)
    onOpenChange(false)
  }, [onOpenChange])

  const title = mode === "collect" ? "Scan Device to Collect" : "Scan Device to Return"
  const instruction =
    mode === "collect"
      ? "Please scan the device QR code to collect your device."
      : "Please scan the device QR code to return your device."

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg space-y-4">
        <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{instruction}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
          {/* QR Scanner Container */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Device QR Code</Label>
            <div className="border border-[#E4E4E7] rounded-lg p-4 bg-muted/50">
              <QRScanner
                onScan={handleScan}
                onError={handleError}
                className="w-full"
                expectedCode={deviceId}
              />
              {scannedCode && !error && (
                <div className="mt-3 p-2 bg-[#16A34A]/10 border border-[#16A34A]/30 rounded">
                  <p className="text-sm text-[#16A34A]">
                    Scanned: <span className="font-mono font-semibold">{scannedCode}</span>
                  </p>
                </div>
              )}
              {error && (
                <div className="mt-3 p-2 bg-[#BE1E2D]/10 border border-[#BE1E2D]/30 rounded">
                  <p className="text-sm text-[#BE1E2D]">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <DialogClose asChild>
              <Button variant="outline" className="w-40" disabled={scanning}>
                Close
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

