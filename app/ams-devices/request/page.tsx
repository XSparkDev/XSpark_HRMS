"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCurrentUser } from "@/lib/auth"

export default function RequestDevicePage() {
  const user = getCurrentUser()
  if (!user) return null
  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy">Request Device</h1>
          <p className="text-muted-foreground mt-2">Request a device from inventory</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
            <CardDescription>Minimal placeholder form</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Device Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Needed By</Label>
              <Input type="date" />
            </div>
            <Button className="gradient-primary text-white">Submit Request</Button>
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}



























