"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getCurrentUser } from "@/lib/auth"

export default function NewConditionReportPage() {
  const user = getCurrentUser()
  if (!user) return null
  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-navy">Create Condition Report</h1>
          <p className="text-muted-foreground mt-2">Submit a new device condition assessment</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
            <CardDescription>Minimal placeholder form</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Device ID</Label>
              <Input placeholder="e.g. LAP-001" />
            </div>
            <div>
              <Label>Condition Notes</Label>
              <Textarea rows={4} />
            </div>
            <Button className="gradient-primary text-white">Submit Report</Button>
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}


























