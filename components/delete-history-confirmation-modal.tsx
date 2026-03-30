'use client'

import { X, AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeleteHistoryConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordType: 'Borrow' | 'Return' | 'Incident'
  deviceName: string
  employeeName: string
  onConfirm: () => void
  isDeleting?: boolean
}

export function DeleteHistoryConfirmationModal({
  open,
  onOpenChange,
  recordType,
  deviceName,
  employeeName,
  onConfirm,
  isDeleting = false,
}: DeleteHistoryConfirmationModalProps) {
  const handleConfirm = () => {
    onConfirm()
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#25294B]">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Confirm Permanent Deletion
          </DialogTitle>
          <DialogDescription className="text-[#58595B]">
            Are you sure you want to permanently delete this history record?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Record Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-muted-foreground">Record Type</span>
                <p className="font-medium">{recordType}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Device</span>
                <p className="font-medium">{deviceName}</p>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-muted-foreground">Employee</span>
                <p className="font-medium">{employeeName}</p>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-red-900">This action cannot be undone</p>
              <p className="text-xs text-red-700">
                This will permanently delete this {recordType.toLowerCase()} record from the history. 
                The record will be removed from the database and cannot be recovered.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isDeleting}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isDeleting}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? (
              <>
                <Trash2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Confirm Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
