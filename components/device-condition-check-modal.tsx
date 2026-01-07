"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

type DeviceConditionCheckModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  borrowId?: string
  onConfirm: (condition: "Good" | "Damaged" | "Charger Missing" | "Needs Maintenance") => void
}

export function DeviceConditionCheckModal({
  open,
  onOpenChange,
  borrowId,
  onConfirm,
}: DeviceConditionCheckModalProps) {
  const [condition, setCondition] = useState<"Good" | "Damaged" | "Charger Missing" | "Needs Maintenance" | "">("")
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!condition) return
    
    setSubmitting(true)
    try {
      // Save condition in return_condition (stub - would update borrow record)
      await fetch(`/api/borrows/${borrowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          return_condition: condition,
        }),
      }).catch(() => {}) // Ignore errors for stub

      // If Damaged or Needs Maintenance, add maintenance log entry
      if (condition === "Damaged" || condition === "Needs Maintenance") {
        await fetch("/api/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: borrowId, // This would be the actual device_id from the borrow record
            category: condition === "Damaged" ? "Damage Report" : "Maintenance Request",
            priority: "High",
            description: `Device condition reported as: ${condition}`,
          }),
        }).catch(() => {}) // Ignore errors for stub
      }

      onConfirm(condition)
      handleClose()
    } catch (error) {
      console.error("Failed to save condition:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setCondition("")
    setSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg space-y-4">
        <DialogHeader className="rounded-lg bg-white/80 p-4 shadow-sm space-y-1">
          <DialogTitle>Device Condition Check</DialogTitle>
          <DialogDescription>Please select the condition of the device being returned.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 rounded-lg bg-white/90 p-4 shadow-sm">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Device Condition</Label>
            <RadioGroup value={condition} onValueChange={(value) => setCondition(value as typeof condition)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Good" id="good" />
                <Label htmlFor="good" className="font-normal cursor-pointer">
                  Good
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Damaged" id="damaged" />
                <Label htmlFor="damaged" className="font-normal cursor-pointer">
                  Damaged
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Charger Missing" id="charger-missing" />
                <Label htmlFor="charger-missing" className="font-normal cursor-pointer">
                  Charger Missing
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Needs Maintenance" id="needs-maintenance" />
                <Label htmlFor="needs-maintenance" className="font-normal cursor-pointer">
                  Needs Maintenance
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <DialogClose asChild>
              <Button variant="outline" className="w-40" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white w-40 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleConfirm}
              disabled={!condition || submitting}
            >
              {submitting ? "Saving..." : "Confirm"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

