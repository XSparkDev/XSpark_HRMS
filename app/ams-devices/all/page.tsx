"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getCurrentUser } from "@/lib/auth"
import { Laptop, Monitor, Smartphone, Package, Tablet, Headphones } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Device = {
  id?: string
  asset_tag?: string | null
  serial_number?: string | null
  device_type?: string | null
  brand?: string | null
  model?: string | null
  specs?: Record<string, unknown> | null
  purchase_date?: string | null
  warranty_expiry?: string | null
  condition?: string | null
  status?: string | null
  assigned_to?: string | null
  location?: string | null
  notes?: string | null
}

const typeIcon: Record<string, { icon: any; size: string }> = {
  laptop: { icon: Laptop, size: "h-8 w-8" },
  desktop: { icon: Monitor, size: "h-8 w-8" },
  phone: { icon: Smartphone, size: "h-8 w-8" },
  tablet: { icon: Tablet, size: "h-8 w-8" },
  headphones: { icon: Headphones, size: "h-8 w-8" },
  monitor: { icon: Monitor, size: "h-8 w-8" },
}

const toTitleCase = (value?: string | null) => {
  if (!value) return "Unknown"
  return value
    .toString()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  borrowed: "bg-amber-100 text-amber-800 border-amber-200",
  assigned: "bg-blue-100 text-blue-800 border-blue-200",
  returned: "bg-gray-100 text-gray-800 border-gray-200",
  available: "bg-green-100 text-green-800 border-green-200",
  maintenance: "bg-red-100 text-red-800 border-red-200",
}

export default function AllDevicesPage() {
  const user = getCurrentUser()
  const router = useRouter()
  if (!user) return null

  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    const fetchDevices = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/devices")
        if (!response.ok) {
          throw new Error("Failed to load devices")
        }

        const payload = await response.json()
        const supabaseDevices: Device[] = Array.isArray(payload)
          ? payload
          : payload?.data ?? []

        if (isMounted) {
          setDevices(supabaseDevices)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to fetch devices")
          setDevices([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchDevices()

    return () => {
      isMounted = false
    }
  }, [])

  const formattedDevices = useMemo(() => {
    return devices.map((device) => {
      const type = device.device_type?.toLowerCase() ?? "unknown"
      const status = device.status?.toLowerCase() ?? "unknown"

      const name = device.model || device.brand || device.device_type || device.asset_tag || "Unnamed Device"
      const description = device.notes || device.location || "No notes provided yet."
      const id = device.asset_tag || device.serial_number || device.id || "—"

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
        <div>
          <h1 className="text-3xl font-bold text-navy">All Devices</h1>
          <p className="text-muted-foreground mt-2">Browse available devices and their current status</p>
        </div>

        {error && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Unable to load devices</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading && !hasResults &&
            Array.from({ length: 8 }).map((_, idx) => (
              <Card key={`skeleton-${idx}`} className="flex flex-col border border-[#808285]/10 animate-pulse">
                <CardHeader className="flex-1 space-y-3 p-4">
                  <div className="h-12 w-12 rounded-full bg-muted mx-auto" />
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded" />
                    <div className="h-3 bg-muted rounded w-1/2 mx-auto" />
                    <div className="h-3 bg-muted rounded w-1/3 mx-auto" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="h-8 bg-muted rounded mb-2" />
                  <div className="h-8 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}

          {!isLoading && hasResults &&
            formattedDevices.map((device, idx) => {
            const IconComponent = typeIcon[device.type]?.icon || Package
              const iconSize = typeIcon[device.type]?.size || "h-8 w-8"

              const statusBadgeClass = statusColor[device.status] || "bg-gray-100 text-gray-800 border-gray-200"
              const displayStatus = device.status ? device.status.replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown"
              const displayType = device.raw.device_type || "Unknown"
            
            return (
                <Card key={`${device.id}-${idx}`} className="flex flex-col transition-all hover:shadow-md border border-[#808285]/10 bg-gradient-to-br from-white to-[#F5F7FB]">
                  <CardHeader className="flex-1 p-4">
                    <div className="flex flex-col items-center text-center space-y-3 mb-3">
                      <div className="p-2.5 rounded-full bg-gradient-to-r from-[#92278F]/5 to-[#BE1E2D]/5 border border-[#92278F]/10">
                      <IconComponent className={`${iconSize} text-[#92278F]`} />
                    </div>
                    <div className="w-full">
                        <CardTitle className="text-base font-semibold text-navy mb-1.5">{device.name}</CardTitle>
                        <CardDescription className="text-xs capitalize mb-2">{displayType}</CardDescription>
                      <Badge 
                        variant="outline"
                          className={`text-xs font-medium border ${statusBadgeClass}`}
                      >
                          {displayStatus}
                      </Badge>
                    </div>
                  </div>
                    <CardDescription className="text-xs text-center text-muted-foreground line-clamp-2">
                    {device.description}
                  </CardDescription>
                </CardHeader>
                  <CardContent className="pt-0 p-4 space-y-2">
                    <div className="text-xs text-muted-foreground text-center">
                      <span className="font-medium">ID:</span> {device.id}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90 transition-opacity text-xs h-8"
                        onClick={() => router.push('/ams-devices')}
                      >
                        Borrow
                      </Button>
                    <Button 
                        variant="outline"
                        className="flex-1 border-[#808285]/30 text-[#25294B] hover:bg-[#F5F7FB] text-xs h-8"
                        onClick={() => {
                          setSelectedDevice(device.raw)
                          setViewDetailsOpen(true)
                        }}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {!isLoading && !error && !hasResults && (
            <Card className="flex flex-col items-center justify-center py-12 border-dashed">
              <CardHeader className="text-center">
                <CardTitle className="text-xl">No devices found</CardTitle>
                <CardDescription>
                  Once devices are added in Supabase, they will appear here automatically.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* View Details Dialog */}
        <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Device Details</DialogTitle>
              <DialogDescription>
                View information about {selectedDevice?.model || selectedDevice?.brand || selectedDevice?.device_type || selectedDevice?.asset_tag || "this device"}
              </DialogDescription>
            </DialogHeader>
            {selectedDevice && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Asset Tag:</span>
                  <span className="font-medium text-[#25294B]">{selectedDevice.asset_tag || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Serial Number:</span>
                  <span className="font-medium text-[#25294B]">{selectedDevice.serial_number || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Device Type:</span>
                  <span className="font-medium text-[#25294B]">{toTitleCase(selectedDevice.device_type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Brand:</span>
                  <span className="font-medium text-[#25294B]">{selectedDevice.brand || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Model:</span>
                  <span className="font-medium text-[#25294B]">{selectedDevice.model || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#58595B]">Status:</span>
                  <Badge variant="outline" className="text-xs">
                    {toTitleCase(selectedDevice.status)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Condition:</span>
                  <span className="font-medium text-[#25294B]">{selectedDevice.condition || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Location:</span>
                  <span className="font-medium text-[#25294B]">{selectedDevice.location || '—'}</span>
                </div>
                {selectedDevice.purchase_date && (
                  <div className="flex justify-between">
                    <span className="text-[#58595B]">Purchase Date:</span>
                    <span className="font-medium text-[#25294B]">{new Date(selectedDevice.purchase_date).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedDevice.warranty_expiry && (
                  <div className="flex justify-between">
                    <span className="text-[#58595B]">Warranty Expiry:</span>
                    <span className="font-medium text-[#25294B]">{new Date(selectedDevice.warranty_expiry).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#58595B]">Last Updated:</span>
                  <span className="font-medium text-[#25294B]">{(selectedDevice.updated_at || selectedDevice.created_at) ? new Date(selectedDevice.updated_at || selectedDevice.created_at as string).toLocaleString() : '—'}</span>
                </div>
                {selectedDevice.notes && (
                  <div>
                    <span className="text-[#58595B]">Notes:</span>
                    <p className="font-medium text-[#25294B] mt-1">{selectedDevice.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AMSDashboardLayout>
  )
}


