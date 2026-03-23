'use client'

import { useState, useCallback, useEffect } from 'react'
import { QrCode, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { QRScanner } from '@/components/qr-scanner'

interface ApproveBorrowModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: {
    id: string
    deviceId: string
    deviceName: string
    assetTag: string
    employeeName: string
    employeeId: string
    borrowDate: string
    purpose?: string
  } | null
  onConfirm: (requestId: string) => Promise<void>
}

export function ApproveBorrowModal({
  open,
  onOpenChange,
  request,
  onConfirm,
}: ApproveBorrowModalProps) {
  const { toast } = useToast()
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Reset scanned code when modal closes
  useEffect(() => {
    if (!open) {
      setScannedCode(null)
    }
  }, [open])

  const handleScan = useCallback(
    (scannedValue: string) => {
      if (!request) return

      // Check if scanned code matches device ID or asset tag
      const deviceId = request.deviceId?.toLowerCase().trim()
      const assetTag = request.assetTag?.toLowerCase().trim()
      const scanned = scannedValue.toLowerCase().trim()

      // First try exact matches
      const exactMatch = scanned === deviceId || scanned === assetTag
      
      // Then try if scanned code contains device ID or asset tag (for QR codes with URLs/JSON)
      const containsMatch = 
        (deviceId && scanned.includes(deviceId)) ||
        (assetTag && scanned.includes(assetTag))
      
      // Also check if device ID or asset tag contains the scanned value (for partial scans)
      const reverseMatch =
        (deviceId && deviceId.includes(scanned)) ||
        (assetTag && assetTag.includes(scanned))

      if (exactMatch || containsMatch || reverseMatch) {
        setScannedCode(scannedValue)
        toast({
          title: 'Device verified',
          description: 'Scanned device matches the request',
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Device mismatch',
          description: `Scanned device does not match. Expected: ${deviceId || assetTag || 'device ID'}`,
        })
      }
    },
    [request, toast]
  )

  const handleScanError = useCallback(
    (error: string) => {
      console.error('QR scan error:', error)
      // Error is already handled by QRScanner component
    },
    []
  )

  const handleConfirm = useCallback(async () => {
    if (!request || !scannedCode) {
      toast({
        variant: 'destructive',
        title: 'Device not scanned',
        description: 'Please scan the device QR code before approving',
      })
      return
    }

    setIsProcessing(true)
    try {
      await onConfirm(request.id)
      toast({
        title: 'Borrow approved',
        description: 'The borrow request has been approved successfully.',
      })
      onOpenChange(false)
      setScannedCode(null)
    } catch (error) {
      console.error('Approval error:', error)
      toast({
        variant: 'destructive',
        title: 'Approval failed',
        description: error instanceof Error ? error.message : 'Failed to approve request',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [request, scannedCode, onConfirm, onOpenChange, toast])

  const handleCancel = useCallback(() => {
    setScannedCode(null)
    onOpenChange(false)
  }, [onOpenChange])

  // Don't render if modal is closed or request is not available
  if (!open || !request) return null

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#25294B]">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Confirm Approval
          </DialogTitle>
          <DialogDescription className="text-[#58595B]">
            Are you sure you want to approve this borrow request?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Request Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Device</Label>
                <p className="font-medium">{request.deviceName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Asset Tag</Label>
                <p className="font-medium">{request.assetTag || '—'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Employee</Label>
                <p className="font-medium">{request.employeeName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Expected Device ID</Label>
                <p className="font-medium font-mono text-xs">{request.deviceId || request.assetTag}</p>
              </div>
            </div>
          </div>

          {/* QR Scanner Section */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Scan Device QR Code</Label>
            <QRScanner
              onScan={handleScan}
              onError={handleScanError}
              expectedCode={request.deviceId || request.assetTag}
            />
            {scannedCode && (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>Device verified: {scannedCode.substring(0, 30)}...</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!scannedCode || isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isProcessing ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm & Approve
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
