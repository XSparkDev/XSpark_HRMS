"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getCurrentUser } from "@/lib/auth"
import { Laptop, Monitor, Smartphone, Package, Tablet, Headphones, Search, RefreshCw, CheckCircle2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

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
  laptop: { icon: Laptop, size: "h-8 w-8" },
  desktop: { icon: Monitor, size: "h-8 w-8" },
  monitor: { icon: Monitor, size: "h-8 w-8" },
  smartphone: { icon: Smartphone, size: "h-8 w-8" },
  tablet: { icon: Tablet, size: "h-8 w-8" },
  headphones: { icon: Headphones, size: "h-8 w-8" },
  default: { icon: Package, size: "h-8 w-8" },
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

export default function DevicesListPage() {
  const user = getCurrentUser()
  const router = useRouter()
  if (!user) return null

  const [devices, setDevices] = useState<DeviceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [searchIdentifier, setSearchIdentifier] = useState("")
  const [searchResult, setSearchResult] = useState<DeviceRecord | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceRecord | null>(null)
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)

  // Fetch all devices from /api/devices endpoint
  // Uses devices-service.ts listDevices() method
  const fetchAllDevices = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // GET request to http://localhost:3000/api/devices
      // This uses devicesService.listDevices() which queries the database
      const response = await fetch("http://localhost:3000/api/devices?limit=1000&offset=0", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to load devices")
      }

      const json = await response.json()
      
      if (json.success === false) {
        throw new Error(json.error || "Failed to fetch devices")
      }

      // Extract devices and count from API response
      // meta.count is the accurate total count from devices-service.ts
      const devicesData: DeviceRecord[] = Array.isArray(json.data) ? json.data : []
      const count = json.meta?.count ?? (typeof json.count === 'number' ? json.count : devicesData.length)

      setDevices(devicesData)
      setTotalCount(count)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch devices")
      setDevices([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Search for a device using getDeviceByIdentifier function
  // This uses the devices-service.ts getDeviceByIdentifier() method (lines 183-201)
  // It tries multiple lookup strategies: device_id, id, asset_tag, serial_number
  const searchDeviceByIdentifier = async (identifier: string) => {
    if (!identifier.trim()) {
      setSearchResult(null)
      return
    }

    setSearchLoading(true)
    try {
      // Call the API endpoint that uses getDeviceByIdentifier
      // GET /api/devices/[deviceId] uses devicesService.getDeviceByIdentifier()
      // The deviceId parameter accepts flexible identifiers (device_id, UUID, asset_tag, serial_number)
      const response = await fetch(`http://localhost:3000/api/devices/${encodeURIComponent(identifier)}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })

      const json = await response.json()

      if (response.ok && json.success && json.data) {
        // Device found using getDeviceByIdentifier
        setSearchResult(json.data)
        setSearchDialogOpen(true)
      } else {
        // Device not found
        setSearchResult(null)
        setSearchDialogOpen(true) // Still open dialog to show "not found" message
      }
    } catch (err) {
      console.error("Error searching device:", err)
      setSearchResult(null)
      setSearchDialogOpen(true)
    } finally {
      setSearchLoading(false)
    }
  }

  useEffect(() => {
    fetchAllDevices()
  }, [])

  const formattedDevices = useMemo(() => {
    return devices.map((device) => {
      const type = device.device_type?.toLowerCase() ?? "unknown"
      const status = device.status?.toLowerCase() ?? "unknown"

      const name = device.model || device.brand || device.device_type || device.asset_tag || "Unnamed Device"
      const description = device.notes || device.location || "No notes provided yet."
      const id = device.asset_tag || device.serial_number || device.device_id || device.id || "—"

      return {
        name,
        type,
        status,
        description,
        id,
        raw: device,
      }
    })
  }, [devices])

  const hasResults = formattedDevices.length > 0

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy">All Devices</h1>
            <p className="text-muted-foreground mt-2">
              Browse available devices and their current status
            </p>
          </div>
          <Button onClick={fetchAllDevices} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Total Count Card */}
        <Card className="border-[#3B4370]/20 bg-gradient-to-r from-[#3B4370]/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-[#3B4370]/10 p-3">
                  <CheckCircle2 className="h-6 w-6 text-[#3B4370]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Devices</p>
                  <p className="text-3xl font-bold text-[#25294B] tabular-nums">{totalCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Count from devices-service.ts listDevices() method
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search by Identifier */}
        <Card>
          <CardHeader>
            <CardTitle>Search Device by Identifier</CardTitle>
            <CardDescription>
              Search using device_id, asset_tag, or serial_number (uses getDeviceByIdentifier from devices-service.ts)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter device ID, asset tag, or serial number"
                value={searchIdentifier}
                onChange={(e) => setSearchIdentifier(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    searchDeviceByIdentifier(searchIdentifier)
                  }
                }}
              />
              <Button
                onClick={() => searchDeviceByIdentifier(searchIdentifier)}
                disabled={searchLoading || !searchIdentifier.trim()}
              >
                <Search className="h-4 w-4 mr-2" />
                {searchLoading ? "Searching..." : "Search"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Unable to load devices</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {isLoading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">Loading devices...</p>
            </CardContent>
          </Card>
        ) : !hasResults ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-semibold">No devices found</p>
              <p className="text-muted-foreground mt-2">
                There are currently no devices in the inventory.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {formattedDevices.map((device) => {
              const IconComponent = typeIcon[device.type]?.icon || typeIcon.default.icon
              const iconSize = typeIcon[device.type]?.size || typeIcon.default.size

              return (
                <Card
                  key={device.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedDevice(device.raw)
                    setViewDetailsOpen(true)
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`${iconSize} text-[#3B4370]`}>
                        <IconComponent />
                      </div>
                      <Badge
                        className={statusColor[device.status] || statusColor.default}
                        variant="outline"
                      >
                        {toTitleCase(device.status)}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{device.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {toTitleCase(device.type)}
                    </p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>ID: {device.id}</p>
                      {device.raw.location && <p>Location: {device.raw.location}</p>}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Device Details Dialog */}
        <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Device Details</DialogTitle>
              <DialogDescription>Complete information about the selected device</DialogDescription>
            </DialogHeader>
            {selectedDevice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Asset Tag</Label>
                    <p className="font-medium">{selectedDevice.asset_tag || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Serial Number</Label>
                    <p className="font-medium">{selectedDevice.serial_number || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Device Type</Label>
                    <p className="font-medium">{toTitleCase(selectedDevice.device_type) || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Brand</Label>
                    <p className="font-medium">{selectedDevice.brand || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Model</Label>
                    <p className="font-medium">{selectedDevice.model || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge
                      className={
                        statusColor[selectedDevice.status?.toLowerCase() || ""] ||
                        statusColor.default
                      }
                      variant="outline"
                    >
                      {toTitleCase(selectedDevice.status)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Condition</Label>
                    <p className="font-medium">{toTitleCase(selectedDevice.condition) || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="font-medium">{selectedDevice.location || "—"}</p>
                  </div>
                  {selectedDevice.purchase_date && (
                    <div>
                      <Label className="text-muted-foreground">Purchase Date</Label>
                      <p className="font-medium">
                        {new Date(selectedDevice.purchase_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {selectedDevice.warranty_expiry && (
                    <div>
                      <Label className="text-muted-foreground">Warranty Expiry</Label>
                      <p className="font-medium">
                        {new Date(selectedDevice.warranty_expiry).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
                {selectedDevice.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="font-medium">{selectedDevice.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Search Result Dialog */}
        <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Search Result</DialogTitle>
              <DialogDescription>
                Device found using getDeviceByIdentifier function
              </DialogDescription>
            </DialogHeader>
            {searchResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Asset Tag</Label>
                    <p className="font-medium">{searchResult.asset_tag || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Serial Number</Label>
                    <p className="font-medium">{searchResult.serial_number || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Device Type</Label>
                    <p className="font-medium">{toTitleCase(searchResult.device_type) || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge
                      className={
                        statusColor[searchResult.status?.toLowerCase() || ""] ||
                        statusColor.default
                      }
                      variant="outline"
                    >
                      {toTitleCase(searchResult.status)}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No device found with that identifier.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AMSDashboardLayout>
  )
}

