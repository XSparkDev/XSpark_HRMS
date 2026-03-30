'use client'

import { useState, useCallback } from 'react'
import { X, AlertCircle } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface RejectBorrowModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: {
    id: string
    deviceName: string
    employeeName: string
  } | null
  onConfirm: (requestId: string, reason: string) => Promise<void>
}

export function RejectBorrowModal({
  open,
  onOpenChange,
  request,
  onConfirm,
}: RejectBorrowModalProps) {
  const { toast } = useToast()
  const [rejectionReason, setRejectionReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleConfirm = useCallback(async () => {
    if (!request) return

    const trimmedReason = rejectionReason.trim()
    if (!trimmedReason) {
      toast({
        variant: 'destructive',
        title: 'Rejection reason required',
        description: 'Please provide a reason for rejecting this request',
      })
      return
    }

    setIsProcessing(true)
    try {
      await onConfirm(request.id, trimmedReason)
      setRejectionReason('')
      onOpenChange(false)
    } catch (error) {
      console.error('Rejection error:', error)
      toast({
        variant: 'destructive',
        title: 'Rejection failed',
        description: error instanceof Error ? error.message : 'Failed to reject request',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [request, rejectionReason, onConfirm, onOpenChange, toast])

  const handleCancel = useCallback(() => {
    setRejectionReason('')
    onOpenChange(false)
  }, [onOpenChange])

  // Reset reason when modal closes
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setRejectionReason('')
      }
      onOpenChange(open)
    },
    [onOpenChange]
  )

  if (!request) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#25294B]">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Confirm Rejection
          </DialogTitle>
          <DialogDescription className="text-[#58595B]">
            Are you sure you want to reject this borrow request?
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
                <Label className="text-xs text-muted-foreground">Employee</Label>
                <p className="font-medium">{request.employeeName}</p>
              </div>
            </div>
          </div>

          {/* Rejection Reason */}
          <div className="space-y-2">
            <Label htmlFor="rejection-reason" className="text-sm font-semibold">
              Rejection Reason <span className="text-red-600">*</span>
            </Label>
            <Textarea
              id="rejection-reason"
              placeholder="Enter the reason for rejecting this request..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              This reason will be sent to the employee via notification.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!rejectionReason.trim() || isProcessing}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isProcessing ? (
              <>
                <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Confirm Rejection
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
