"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import { Monitor, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function DeviceStatusPage() {
  const user = getCurrentUser()

  if (!user) return null

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/ams-devices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Device Management
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Device Status</CardTitle>
            <CardDescription>View the status of your assigned devices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Monitor className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy mb-2">Device Status</h3>
              <p className="text-muted-foreground mb-6">
                This page will contain device status information for the Asset Management System.
              </p>
              <Button variant="outline">Coming Soon</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}


