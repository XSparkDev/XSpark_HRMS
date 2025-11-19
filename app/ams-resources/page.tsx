"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Building2, MapPin, Users, ClipboardList } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

type ResourceRecord = {
  resource_id: string
  resource_name: string
  resource_type?: string | null
  description?: string | null
  location?: string | null
  capacity?: number | null
  condition?: string | null
  is_available?: boolean | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
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

export default function AMSResourcesPage() {
  const user = getCurrentUser()
  const [resources, setResources] = useState<ResourceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchResources = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/resources?limit=200')
        if (!response.ok) {
          throw new Error('Failed to load resources')
        }
        const payload = await response.json()
        const data: ResourceRecord[] = Array.isArray(payload) ? payload : payload?.data ?? []
        setResources(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to fetch resources')
        setResources([])
      } finally {
        setLoading(false)
      }
    }

    fetchResources()
  }, [])

  const summary = useMemo(() => {
    const total = resources.length
    const available = resources.filter((resource) => resource.is_available !== false).length
    const unavailable = total - available
    return { total, available, unavailable }
  }, [resources])

  if (!user) return null
  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-navy">Resources Overview</h1>
          <p className="text-muted-foreground">Browse rooms and shared assets currently tracked in the system.</p>
        </div>

        <Card className="border border-[#808285]/20 bg-gradient-to-br from-white to-[#808285]/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#25294B]">
              <Building2 className="h-5 w-5 text-[#92278F]" />
              Inventory Summary
            </CardTitle>
            <CardDescription className="text-[#58595B]">
              {loading ? 'Loading resources...' : `Tracking ${summary.total} resources. ${summary.available} available, ${summary.unavailable} unavailable.`}
            </CardDescription>
          </CardHeader>
        </Card>

        {error && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Unable to load resources</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading && resources.length === 0
            ? Array.from({ length: 6 }).map((_, idx) => (
                <Card key={`resource-skeleton-${idx}`} className="border border-[#808285]/20 animate-pulse">
                  <CardContent className="p-6 space-y-4">
                    <div className="h-6 bg-muted rounded w-2/3" />
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))
            : resources.map((resource) => {
                const statusBadge = resource.is_available !== false ? 'Available' : 'Unavailable'
                return (
                  <Card key={resource.resource_id} className="transition-all hover:shadow-md border border-[#808285]/20 bg-white">
                    <CardHeader className="space-y-1">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl text-[#25294B]">{resource.resource_name}</CardTitle>
                        <Badge variant={resource.is_available !== false ? 'outline' : 'destructive'} className="text-xs">
                          {statusBadge}
                        </Badge>
                      </div>
                      <CardDescription className="capitalize text-[#58595B]">{toTitleCase(resource.resource_type)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-[#58595B]">
                      {resource.description && <p>{resource.description}</p>}
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[#92278F]" />
                        <span>{resource.location || 'No location specified'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#92278F]" />
                        <span>Capacity: {resource.capacity ?? 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-[#92278F]" />
                        <span>Condition: {resource.condition || 'Not recorded'}</span>
                      </div>
                      {resource.notes && <p className="text-xs text-muted-foreground">Notes: {resource.notes}</p>}
                    </CardContent>
                  </Card>
                )
              })}
        </div>

        {!loading && !error && resources.length === 0 && (
          <Card className="border border-[#808285]/20 bg-gradient-to-br from-white to-[#808285]/5">
            <CardContent className="py-12 text-center text-muted-foreground">
              No resources found. Add new resources to see them listed here.
            </CardContent>
          </Card>
        )}
      </div>
    </AMSDashboardLayout>
  )
}








