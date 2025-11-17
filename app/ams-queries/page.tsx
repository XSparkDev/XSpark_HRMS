"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"

export default function AMSQueriesPage() {
  const user = getCurrentUser()
  if (!user) return null
  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Queries</CardTitle>
            <CardDescription>Placeholder page for supervisor queries</CardDescription>
          </CardHeader>
          <CardContent>
            Content coming soon.
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}














