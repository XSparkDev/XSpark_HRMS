"use client"

import React from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { getCurrentUser, hasPermission } from "@/lib/auth"
import Link from "next/link"
import { useState } from "react"
import {
  ArrowLeft,
  Settings,
  Save,
  Bell,
  Clock,
  Shield,
  Database,
  Users,
} from "lucide-react"

export default function AMSSettingsPage() {
  const user = getCurrentUser()

  if (!user) return null

  const isSupervisor = user.role === "junior_hr" || user.role === "hr_manager" || user.role === "super_admin"

  if (!hasPermission(user, "manage_ams_settings")) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
              <p className="text-muted-foreground mb-4">
                You don't have permission to access AMS settings. Only supervisors can perform this action.
              </p>
              <Link href="/assets">
                <Button>Back to Asset Management</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  const [settings, setSettings] = useState({
    // Notification Settings
    emailNotifications: true,
    pushNotifications: true,
    borrowRequestNotifications: true,
    returnRequestNotifications: true,
    maintenanceReminders: true,
    damageReports: true,
    
    // Approval Settings
    autoApproveLowValue: false,
    requireSupervisorApproval: true,
    maxBorrowDuration: "30",
    
    // System Settings
    enableMaintenanceTracking: true,
    enableConditionReports: true,
    enableAuditLogging: true,
    dataRetentionPeriod: "365",
    
    // Integration Settings
    syncWithHRMS: true,
    enableBarcodeScanning: false,
    enableQRCodeGeneration: true,
  })

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSave = () => {
    console.log("Saving AMS settings:", settings)
    // In a real app, this would make an API call to save settings
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/assets">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to AMS
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">AMS Settings</h1>
              <p className="text-muted-foreground">Configure asset management system preferences</p>
            </div>
          </div>
          <Button onClick={handleSave} className="gradient-primary">
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Configure how and when you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => handleSettingChange("emailNotifications", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="pushNotifications">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive browser push notifications
                  </p>
                </div>
                <Switch
                  id="pushNotifications"
                  checked={settings.pushNotifications}
                  onCheckedChange={(checked) => handleSettingChange("pushNotifications", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="borrowRequestNotifications">Borrow Request Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when employees request to borrow devices
                  </p>
                </div>
                <Switch
                  id="borrowRequestNotifications"
                  checked={settings.borrowRequestNotifications}
                  onCheckedChange={(checked) => handleSettingChange("borrowRequestNotifications", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="returnRequestNotifications">Return Request Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when employees request to return devices
                  </p>
                </div>
                <Switch
                  id="returnRequestNotifications"
                  checked={settings.returnRequestNotifications}
                  onCheckedChange={(checked) => handleSettingChange("returnRequestNotifications", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="maintenanceReminders">Maintenance Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Get reminded about upcoming maintenance schedules
                  </p>
                </div>
                <Switch
                  id="maintenanceReminders"
                  checked={settings.maintenanceReminders}
                  onCheckedChange={(checked) => handleSettingChange("maintenanceReminders", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="damageReports">Damage Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when damage reports are submitted
                  </p>
                </div>
                <Switch
                  id="damageReports"
                  checked={settings.damageReports}
                  onCheckedChange={(checked) => handleSettingChange("damageReports", checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Approval Settings
            </CardTitle>
            <CardDescription>
              Configure approval workflows and policies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoApproveLowValue">Auto-approve Low Value Items</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically approve requests for low-value items
                  </p>
                </div>
                <Switch
                  id="autoApproveLowValue"
                  checked={settings.autoApproveLowValue}
                  onCheckedChange={(checked) => handleSettingChange("autoApproveLowValue", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="requireSupervisorApproval">Require Supervisor Approval</Label>
                  <p className="text-sm text-muted-foreground">
                    All requests must be approved by a supervisor
                  </p>
                </div>
                <Switch
                  id="requireSupervisorApproval"
                  checked={settings.requireSupervisorApproval}
                  onCheckedChange={(checked) => handleSettingChange("requireSupervisorApproval", checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxBorrowDuration">Maximum Borrow Duration (days)</Label>
                <Select
                  value={settings.maxBorrowDuration}
                  onValueChange={(value) => handleSettingChange("maxBorrowDuration", value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Settings
            </CardTitle>
            <CardDescription>
              Configure system features and data management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableMaintenanceTracking">Enable Maintenance Tracking</Label>
                  <p className="text-sm text-muted-foreground">
                    Track device maintenance schedules and history
                  </p>
                </div>
                <Switch
                  id="enableMaintenanceTracking"
                  checked={settings.enableMaintenanceTracking}
                  onCheckedChange={(checked) => handleSettingChange("enableMaintenanceTracking", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableConditionReports">Enable Condition Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to submit device condition reports
                  </p>
                </div>
                <Switch
                  id="enableConditionReports"
                  checked={settings.enableConditionReports}
                  onCheckedChange={(checked) => handleSettingChange("enableConditionReports", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableAuditLogging">Enable Audit Logging</Label>
                  <p className="text-sm text-muted-foreground">
                    Log all system activities for compliance
                  </p>
                </div>
                <Switch
                  id="enableAuditLogging"
                  checked={settings.enableAuditLogging}
                  onCheckedChange={(checked) => handleSettingChange("enableAuditLogging", checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataRetentionPeriod">Data Retention Period (days)</Label>
                <Select
                  value={settings.dataRetentionPeriod}
                  onValueChange={(value) => handleSettingChange("dataRetentionPeriod", value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="730">2 years</SelectItem>
                    <SelectItem value="1095">3 years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integration Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Integration Settings
            </CardTitle>
            <CardDescription>
              Configure integrations with other systems
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="syncWithHRMS">Sync with HRMS</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync employee data with HRMS
                  </p>
                </div>
                <Switch
                  id="syncWithHRMS"
                  checked={settings.syncWithHRMS}
                  onCheckedChange={(checked) => handleSettingChange("syncWithHRMS", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableBarcodeScanning">Enable Barcode Scanning</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow barcode scanning for device identification
                  </p>
                </div>
                <Switch
                  id="enableBarcodeScanning"
                  checked={settings.enableBarcodeScanning}
                  onCheckedChange={(checked) => handleSettingChange("enableBarcodeScanning", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enableQRCodeGeneration">Enable QR Code Generation</Label>
                  <p className="text-sm text-muted-foreground">
                    Generate QR codes for devices
                  </p>
                </div>
                <Switch
                  id="enableQRCodeGeneration"
                  checked={settings.enableQRCodeGeneration}
                  onCheckedChange={(checked) => handleSettingChange("enableQRCodeGeneration", checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
