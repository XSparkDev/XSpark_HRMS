"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { getCurrentUser } from "@/lib/auth"
import { ArrowLeft, Package } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BUSINESS_START_TIME, BUSINESS_END_TIME, BUSINESS_TIME_PATTERN, isWithinBusinessHours as isBusinessTime } from "@/lib/utils/business-hours"

export default function BorrowDevicePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null)
  const [availableDevices, setAvailableDevices] = useState<Array<{ id: string; assetTag: string; name: string; raw: any }>>([])
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [devicesError, setDevicesError] = useState<string | null>(null)
  const [borrowTimeError, setBorrowTimeError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    device: "",
    borrowerName: "",
    employeeId: "",
    deviceId: "",
    borrowDate: "",
    borrowTime: "",
    returnDate: "",
    purpose: "",
    confirmation: false,
  })

  useEffect(() => {
    setMounted(true)
    const currentUser = getCurrentUser()
    setUser(currentUser)
    
    // Set default borrow date and time
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().slice(0, 5)
    
    setFormData((prev) => ({
      ...prev,
      borrowerName: currentUser?.name || "John Doe",
      employeeId: currentUser?.employeeId || "N/A",
      borrowDate: dateStr,
      borrowTime: timeStr,
      returnDate: dateStr,
    }))
  }, [])

  useEffect(() => {
    const loadDevices = async () => {
      setLoadingDevices(true)
      setDevicesError(null)

      try {
        const response = await fetch("/api/devices?status=available")
        if (!response.ok) throw new Error("Failed to load available devices")

        const payload = await response.json()
        const data: any[] = Array.isArray(payload) ? payload : payload?.data ?? []

        const mapped = data.map((device) => ({
          id: device.id ?? device.asset_tag ?? device.serial_number ?? crypto.randomUUID(),
          assetTag: device.asset_tag ?? device.serial_number ?? "—",
          name: device.model || device.brand || device.device_type || "Unnamed Device",
          raw: device,
        }))

        setAvailableDevices(mapped)
      } catch (error) {
        setDevicesError(error instanceof Error ? error.message : "Unable to fetch devices")
        setAvailableDevices([])
      } finally {
        setLoadingDevices(false)
      }
    }

    loadDevices()
  }, [])

  if (!mounted || !user) return null

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (field === "borrowTime" && typeof value === "string") {
      if (!value) {
        setBorrowTimeError(null)
        return
      }
      if (!BUSINESS_TIME_PATTERN.test(value)) {
        setBorrowTimeError("Enter time in HH:MM format.")
        return
      }
      if (!isBusinessTime(value)) {
        setBorrowTimeError("Not a business hour")
        return
      }
      setBorrowTimeError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.confirmation) {
      alert("Please confirm that you will handle this device responsibly.")
      return
    }
    if (!formData.borrowTime) {
      setBorrowTimeError("Select a borrow time.")
      return
    }
    if (!BUSINESS_TIME_PATTERN.test(formData.borrowTime)) {
      setBorrowTimeError("Enter time in HH:MM format.")
      return
    }
    if (!isBusinessTime(formData.borrowTime)) {
      setBorrowTimeError("Not a business hour")
      return
    }
    setBorrowTimeError(null)
    setSubmitError(null)

    const selectedDevice = availableDevices.find((d) => d.id === formData.device)
    if (!selectedDevice) {
      setSubmitError("Please select a device.")
      return
    }

    // Combine borrow date and time into ISO string
    const borrowDateTime = formData.borrowDate && formData.borrowTime
      ? new Date(`${formData.borrowDate}T${formData.borrowTime}`).toISOString()
      : new Date().toISOString()

    // Convert return date to ISO string if provided
    const returnDateISO = formData.returnDate
      ? new Date(`${formData.returnDate}T23:59:59`).toISOString()
      : null

    // Get device_id from the selected device (use device_id from raw data, or asset_tag, or id)
    const deviceId = selectedDevice.raw?.device_id || selectedDevice.raw?.asset_tag || selectedDevice.assetTag || selectedDevice.id

    setSubmitting(true)
    try {
      const response = await fetch("/api/borrows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: deviceId,
          borrowed_by: formData.employeeId,
          borrow_date: borrowDateTime,
          return_date: returnDateISO,
          notes: formData.purpose || undefined,
        }),
      })

      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.success === false) {
        throw new Error(json?.error || "Failed to submit borrow request.")
      }

      alert("Device borrow request submitted successfully!")
      router.back()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit borrow request.")
      console.error("Borrow request submission error:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  const isFormValid = !!(
    formData.device &&
    formData.borrowDate &&
    formData.borrowTime &&
    formData.returnDate &&
    formData.purpose &&
    formData.confirmation &&
    !borrowTimeError
  )

  // Format date for display
  const formatDateTime = (date: string, time?: string) => {
    if (!date) return "--"
    const d = new Date(date)
    const dateFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    if (time) {
      return `${dateFormatted}, ${time}`
    }
    return dateFormatted
  }

  const formatDuration = () => {
    if (!formData.borrowDate) return "--"
    const borrowDate = formatDateTime(formData.borrowDate, formData.borrowTime)
    const returnDate = formData.returnDate ? formatDateTime(formData.returnDate) : "--"
    return `${borrowDate} - ${returnDate}`
  }

  // Available devices list
  const selectedDeviceDetails = availableDevices.find((device) => device.id === formData.device)
  const selectedDevice = selectedDeviceDetails ? `${selectedDeviceDetails.assetTag} — ${selectedDeviceDetails.name}` : formData.device || "-"
  const duration = formatDuration()
  const purpose = formData.purpose || "-"

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center gap-4">
          <Link href="/ams-devices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Device Management
            </Button>
          </Link>
        </div>

        {/* Gradient Banner */}
        <div className="gradient-primary text-white p-8 rounded-lg">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Borrow a Device</h1>
          <p className="text-white/90 text-lg">
            Select an available device to borrow and specify the borrowing duration.
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Device Selection */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Device Selection
                </CardTitle>
                <CardDescription>Choose an available device to borrow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="device">Device *</Label>
                  <Select
                    value={formData.device}
                    onValueChange={(value) => {
                      const selected = availableDevices.find((d) => d.id === value)
                      handleInputChange("device", value)
                      handleInputChange("deviceId", selected?.assetTag ?? value)
                    }}
                    disabled={loadingDevices || !!devicesError || availableDevices.length === 0}
                  >
                    <SelectTrigger id="device">
                      <SelectValue placeholder={loadingDevices ? "Loading devices..." : devicesError ? "Devices unavailable" : "Select an available device"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDevices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.assetTag} — {device.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {devicesError && (
                    <p className="text-xs text-destructive">{devicesError}</p>
                  )}
                  {submitError && (
                    <p className="text-xs text-destructive">{submitError}</p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="borrowerName">Borrower Name</Label>
                    <Input
                      id="borrowerName"
                      value={formData.borrowerName}
                      readOnly
                      className="bg-muted text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeId">Employee ID</Label>
                    <Input
                      id="employeeId"
                      value={formData.employeeId}
                      readOnly
                      className="bg-muted text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deviceId">Device ID</Label>
                  <Input
                    id="deviceId"
                    value={formData.deviceId}
                    onChange={(e) => handleInputChange("deviceId", e.target.value)}
                    placeholder="-"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="borrowDate">Borrow Date *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="borrowDate"
                        type="date"
                        value={formData.borrowDate}
                        onChange={(e) => handleInputChange("borrowDate", e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="flex-1"
                        required
                      />
                      <Input
                        id="borrowTime"
                        type="time"
                        min={BUSINESS_START_TIME}
                        max={BUSINESS_END_TIME}
                        value={formData.borrowTime}
                        onChange={(e) => handleInputChange("borrowTime", e.target.value)}
                        className={`w-32 ${borrowTimeError ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
                        aria-invalid={borrowTimeError ? true : undefined}
                      />
                      {borrowTimeError && (
                        <p className="text-xs text-destructive">{borrowTimeError}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="returnDate">Return Date *</Label>
                    <Input
                      id="returnDate"
                      type="date"
                      value={formData.returnDate}
                      onChange={(e) => handleInputChange("returnDate", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose *</Label>
                  <Textarea
                    id="purpose"
                    value={formData.purpose}
                    onChange={(e) => handleInputChange("purpose", e.target.value)}
                    placeholder="Enter the reason for borrowing this device"
                    rows={4}
                    required
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Confirmation */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Confirmation</CardTitle>
                <CardDescription>Review your selection and confirm.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">Device:</Label>
                    <p className="font-medium">{selectedDevice}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Duration:</Label>
                    <p className="font-medium">{duration}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Purpose:</Label>
                    <p className="font-medium">{purpose}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="confirmation"
                    checked={formData.confirmation}
                    onCheckedChange={(checked) => handleInputChange("confirmation", checked === true)}
                  />
                  <Label
                    htmlFor="confirmation"
                    className="text-sm font-normal cursor-pointer"
                  >
                    I confirm I will handle this device responsibly.
                  </Label>
                </div>

                <div className="flex flex-col gap-2 pt-4">
                  <Button
                    type="button"
                    className="gradient-primary text-white w-full"
                    disabled={!isFormValid || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? "Submitting..." : "Book a Device"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AMSDashboardLayout>
  )
}
