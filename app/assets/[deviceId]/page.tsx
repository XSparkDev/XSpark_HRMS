"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { 
  Laptop, 
  Monitor, 
  Smartphone, 
  Package, 
  Tablet, 
  Headphones, 
  ArrowLeft, 
  Loader2,
  AlertCircle 
} from "lucide-react"
import Link from "next/link"
import { QRCodeGenerator } from "@/components/qr-code-generator"

type DeviceRecord = {
  device_id?: string
  id?: string
  asset_tag?: string | null
  serial_number?: string | null
  device_type?: string | null
  brand?: string | null
  model?: string | null
  specs?: Record<string, any> | null
  status?: string | null
  condition?: string | null
  location?: string | null
  assigned_to?: string | null
  notes?: string | null
  purchase_date?: string | null
  warranty_expiry?: string | null
  created_at?: string | null
  updated_at?: string | null
}

const typeIcon: Record<string, { icon: any; size: string }> = {
  laptop: { icon: Laptop, size: "h-12 w-12" },
  desktop: { icon: Monitor, size: "h-12 w-12" },
  monitor: { icon: Monitor, size: "h-12 w-12" },
  smartphone: { icon: Smartphone, size: "h-12 w-12" },
  tablet: { icon: Tablet, size: "h-12 w-12" },
  headphones: { icon: Headphones, size: "h-12 w-12" },
  default: { icon: Package, size: "h-12 w-12" },
}

const toTitleCase = (str: string | null | undefined): string => {
  if (!str) return ""
  return str
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

const statusColor: Record<string, string> = {
  active: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30",
  borrowed: "bg-[#92278F]/10 text-[#92278F] border-[#92278F]/30",
  assigned: "bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/30",
  returned: "bg-[#808285]/10 text-[#808285] border-[#808285]/30",
  available: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30",
  maintenance: "bg-[#BE1E2D]/10 text-[#BE1E2D] border-[#BE1E2D]/30",
  in_maintenance: "bg-[#BE1E2D]/10 text-[#BE1E2D] border-[#BE1E2D]/30",
}

export default function AssetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const deviceId = params?.deviceId as string

  const [device, setDevice] = useState<DeviceRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!deviceId) {
      setError("Device ID is required")
      setIsLoading(false)
      return
    }

    const fetchDevice = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Use the API endpoint that supports flexible identifier lookup
        // This endpoint accepts device_id, UUID, asset_tag, or serial_number
        const response = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        })

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Device not found")
          }
          throw new Error("Failed to load device")
        }

        const json = await response.json()
        
        if (json.success && json.data) {
          setDevice(json.data)
        } else {
          throw new Error(json.error || "Device not found")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to fetch device")
        setDevice(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDevice()
  }, [deviceId])

  const DeviceIcon = device?.device_type 
    ? (typeIcon[device.device_type.toLowerCase()] || typeIcon.default).icon
    : typeIcon.default.icon

  const iconSize = device?.device_type
    ? (typeIcon[device.device_type.toLowerCase()] || typeIcon.default).size
    : typeIcon.default.size

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Loading device information...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !device) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/ams-devices">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Devices
              </Button>
            </Link>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Device Not Found</h3>
                <p className="text-muted-foreground mb-6">
                  {error || `No device found with identifier: ${deviceId}`}
                </p>
                <Button onClick={() => router.push("/ams-devices")}>
                  Go to Device Management
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/ams-devices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Devices
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`${iconSize} text-[#25294B]`}>
                  <DeviceIcon />
                </div>
                <div>
                  <CardTitle className="text-2xl">
                    {device.model || device.brand || device.device_type || "Device"}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {device.device_id || device.asset_tag || "Device Details"}
                  </CardDescription>
                </div>
              </div>
              <Badge
                className={
                  statusColor[device.status?.toLowerCase() || ""] ||
                  "bg-gray-100 text-gray-800 border-gray-300"
                }
                variant="outline"
              >
                {toTitleCase(device.status) || "Unknown"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-[#25294B]">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Device ID</Label>
                    <p className="font-medium">{device.device_id || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Asset Tag</Label>
                    <p className="font-medium">{device.asset_tag || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Serial Number</Label>
                    <p className="font-medium">{device.serial_number || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Device Type</Label>
                    <p className="font-medium">{toTitleCase(device.device_type) || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Brand</Label>
                    <p className="font-medium">{device.brand || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Model</Label>
                    <p className="font-medium">{device.model || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Status & Condition */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-[#25294B]">Status & Condition</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge
                        className={
                          statusColor[device.status?.toLowerCase() || ""] ||
                          "bg-gray-100 text-gray-800 border-gray-300"
                        }
                        variant="outline"
                      >
                        {toTitleCase(device.status) || "—"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Condition</Label>
                    <p className="font-medium">{toTitleCase(device.condition) || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="font-medium">{device.location || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              {(device.purchase_date || device.warranty_expiry) && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-[#25294B]">Important Dates</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {device.purchase_date && (
                      <div>
                        <Label className="text-muted-foreground">Purchase Date</Label>
                        <p className="font-medium">
                          {new Date(device.purchase_date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                    {device.warranty_expiry && (
                      <div>
                        <Label className="text-muted-foreground">Warranty Expiry</Label>
                        <p className="font-medium">
                          {new Date(device.warranty_expiry).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Specifications */}
              {device.specs && Object.keys(device.specs).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-[#25294B]">Specifications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(device.specs).map(([key, value]) => (
                      <div key={key}>
                        <Label className="text-muted-foreground">
                          {toTitleCase(key.replace(/_/g, " "))}
                        </Label>
                        <p className="font-medium">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {device.notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-[#25294B]">Notes</h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm whitespace-pre-wrap">{device.notes}</p>
                  </div>
                </div>
              )}

              {/* Metadata */}
              {(device.created_at || device.updated_at) && (
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                    {device.created_at && (
                      <div>
                        <Label className="text-muted-foreground">Created</Label>
                        <p>
                          {new Date(device.created_at).toLocaleString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                    {device.updated_at && (
                      <div>
                        <Label className="text-muted-foreground">Last Updated</Label>
                        <p>
                          {new Date(device.updated_at).toLocaleString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* QR Code Generator */}
        <Card>
          <CardHeader>
            <CardTitle>QR Code</CardTitle>
            <CardDescription>
              Scan this QR code to quickly access this device page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QRCodeGenerator
              deviceId={deviceId}
              deviceName={device.model || device.brand || device.device_type || "Device"}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
