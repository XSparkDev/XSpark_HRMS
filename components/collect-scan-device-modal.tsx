"use client"

import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { QRScanner } from "@/components/qr-scanner"
import { Label } from "@/components/ui/label"
import { CheckCircle2 } from "lucide-react"

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
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [validatedDeviceId, setValidatedDeviceId] = useState<string>("")

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

        // Success - show confirmation dialog for both collect and return modes
        setValidatedDeviceId(json.data?.device_id || result)
        setShowSuccessDialog(true)
        setScanning(false)
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
    setShowSuccessDialog(false)
    setValidatedDeviceId("")
    onOpenChange(false)
  }, [onOpenChange])

  const handleSuccessConfirm = useCallback(() => {
    // Call the success callback
    onScanSuccess?.(validatedDeviceId || scannedCode)
    // Close both dialogs
    setShowSuccessDialog(false)
    onOpenChange(false)
    setScannedCode("")
    setValidatedDeviceId("")
  }, [onScanSuccess, validatedDeviceId, scannedCode, onOpenChange])

  const title = mode === "collect" ? "Scan Device to Collect" : "Scan Device to Return"
  const instruction =
    mode === "collect"
      ? "Please scan the device QR code to collect your device."
      : "Please scan the device QR code to return your device."

  return (
    <>
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

      {/* Success Confirmation Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#16A34A]">
              <CheckCircle2 className="h-5 w-5" />
              {mode === "collect" ? "Device Collected Successfully" : "Device Returned Successfully"}
            </DialogTitle>
            <DialogDescription>
              {mode === "collect" 
                ? "The device has been successfully validated and the borrow status has been updated."
                : "The device has been successfully validated and returned. The device status has been updated to available."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-semibold text-green-900 mb-2">Status Updated:</p>
              <div className="flex items-center gap-2">
                {mode === "collect" ? (
                  <>
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Pending Borrow</span>
                    <span className="text-green-600">→</span>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">Borrowed</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">Borrowed</span>
                    <span className="text-green-600">→</span>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">Available</span>
                  </>
                )}
              </div>
            </div>
            {validatedDeviceId && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Device ID:</p>
                <p className="text-sm font-mono font-semibold">{validatedDeviceId}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={handleSuccessConfirm}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

