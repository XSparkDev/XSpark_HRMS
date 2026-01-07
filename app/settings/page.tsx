"use client"

import Link from "next/link"
import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { getCurrentUser } from "@/lib/auth"
import { useMemo } from "react"

const notificationSettings = [
  { id: "device-updates", label: "Device assignments & returns" },
  { id: "maintenance-alerts", label: "Maintenance updates" },
  { id: "room-bookings", label: "Room booking reminders" },
  { id: "announcements", label: "Company announcements" },
]

export default function SettingsPage() {
  const user = getCurrentUser()

  const profileDefaults = useMemo(() => {
    return {
      name: user?.name ?? "",
      email: user?.email ?? "",
      employeeId: user?.employeeId ?? "",
    }
  }, [user])

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#25294B]">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your profile details, security preferences, and what you hear about.
          </p>
        </div>

        <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/6 to-[#BE1E2D]/10">
          <CardHeader>
            <CardTitle className="text-[#25294B]">Profile Information</CardTitle>
            <CardDescription className="text-[#58595B]">
              Keep your personal details up to date to ensure smooth device management.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="settings-name">Full Name</Label>
                <Input id="settings-name" defaultValue={profileDefaults.name} placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-employee-id">Employee ID</Label>
                <Input id="settings-employee-id" defaultValue={profileDefaults.employeeId} placeholder="Employee ID" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="settings-email">Email Address</Label>
                <Input id="settings-email" type="email" defaultValue={profileDefaults.email} placeholder="name@company.com" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="settings-about">About You</Label>
                <Textarea id="settings-about" placeholder="Add a short bio or notes for the IT team…" rows={4} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90">
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#dfeaff] to-[#f5ecff]">
          <CardHeader>
            <CardTitle className="text-[#25294B]">Activity & Audit Log</CardTitle>
            <CardDescription className="text-[#58595B]">
              Review a detailed history of changes, approvals, and device activity recorded in the audit log.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Use this view when you need to trace who did what and when across the system.
            </p>
            <Button
              asChild
              className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90"
            >
              <Link href="/activity-log">Open Activity Log</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/6 to-[#BE1E2D]/10">
          <CardHeader>
            <CardTitle className="text-[#25294B]">Change Password</CardTitle>
            <CardDescription className="text-[#58595B]">
              Strengthen your account security with a new password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="settings-current-password">Current Password</Label>
                <Input id="settings-current-password" type="password" placeholder="Current password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-new-password">New Password</Label>
                <Input id="settings-new-password" type="password" placeholder="New password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-confirm-password">Confirm Password</Label>
                <Input id="settings-confirm-password" type="password" placeholder="Confirm password" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90">
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#808285]/20 bg-gradient-to-br from-white via-[#92278F]/6 to-[#BE1E2D]/10">
          <CardHeader>
            <CardTitle className="text-[#25294B]">Notification Preferences</CardTitle>
            <CardDescription className="text-[#58595B]">
              Decide which updates you want to receive from the Asset Management System.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {notificationSettings.map((setting) => (
                <label
                  key={setting.id}
                  className="flex items-start gap-3 rounded-lg border border-[#808285]/20 bg-white/80 p-4 shadow-sm"
                >
                  <Checkbox id={setting.id} />
                  <span className="text-sm text-[#25294B] leading-relaxed">{setting.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white hover:opacity-90">
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AMSDashboardLayout>
  )
}

















