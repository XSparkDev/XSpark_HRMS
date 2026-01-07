"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCurrentUser } from "@/lib/auth"

export default function AddDevicePage() {
  const user = getCurrentUser()
  if (!user) return null
  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy">Add New Device</h1>
          <p className="text-muted-foreground mt-2">Register a device to the inventory</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Device Details</CardTitle>
            <CardDescription>Minimal placeholder form</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Device Name</Label>
              <Input placeholder="e.g. Dell XPS 13" />
            </div>
            <div>
              <Label>Asset Tag</Label>
              <Input placeholder="e.g. LAP-001" />
            </div>
            <Button className="gradient-primary text-white">Save</Button>
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}


























