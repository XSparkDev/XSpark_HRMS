"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import { Settings, User, Bell, Shield } from "lucide-react"

export default function AMSSettingsPage() {
  const user = getCurrentUser()

  if (!user) return null

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Manage your AMS preferences and account settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Settings className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-navy mb-2">AMS Settings</h3>
              <p className="text-muted-foreground mb-6">
                This page will contain settings and preferences for the Asset Management System.
              </p>
              <Button variant="outline">Coming Soon</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}


