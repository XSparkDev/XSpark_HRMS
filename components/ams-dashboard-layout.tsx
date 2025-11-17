"use client"

import { type ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { XSparkLogo } from "@/components/xspark-logo"
import { AIChatWidget } from "@/components/ai-chat-widget"
import {
  getCurrentUser,
  logout,
  getRoleBadgeColor,
  getRoleDisplayName,
  type User,
} from "@/lib/auth"
import {
  Home,
  Package,
  Calendar,
  Settings,
  LogOut,
  Bell,
  Menu,
  MessageSquare,
  Wrench,
  ClipboardList,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  Users,
  FileText,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface AMSDashboardLayoutProps {
  children: ReactNode
}

export function AMSDashboardLayout({ children }: AMSDashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | undefined>(undefined)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [employeeProfile, setEmployeeProfile] = useState<any>(null)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.replace("/login")
    }
    setUser(currentUser)
  }, [router])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedEmployee = localStorage.getItem("xspark_employee")
    if (storedEmployee) {
      try {
        setEmployeeProfile(JSON.parse(storedEmployee))
      } catch (error) {
        console.error("Failed to parse stored employee profile", error)
      }
    }
  }, [])

  if (user === undefined) return null
  if (user === null) return null

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const dashboardPath = user?.role === "supervisor" ? "/ams-supervisor" : "/ams-dashboard"

  const baseNavigation = [
    { name: "Dashboard", href: dashboardPath, icon: Home },
    { name: "Device Management", href: "/ams-devices", icon: Package },
    { name: "Room Booking", href: "/ams-bookings", icon: Calendar },
    { name: "Maintenance Request", href: "/ams-maintenance", icon: Wrench },
    { name: "Settings", href: "/ams-settings", icon: Settings },
  ]

  const navigationTabs =
    user?.role === "supervisor"
      ? [
          baseNavigation[0],
          { name: "Supervisor", href: "/ams-supervisor", icon: CheckCircle2 },
          ...baseNavigation.slice(1),
        ]
      : baseNavigation

  const extractSurname = (value?: string | null) => {
    if (!value) return ""
    const parts = value.split(" ").filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : ""
  }

  const profileImage: string | null =
    employeeProfile?.profile_image_url ??
    employeeProfile?.profilePicture ??
    employeeProfile?.avatar_url ??
    employeeProfile?.avatar ??
    null

  const fullNames =
    (typeof employeeProfile?.full_name === "string" && employeeProfile.full_name) ||
    (typeof employeeProfile?.names === "string" && employeeProfile.names) ||
    user.name

  const nameParts = (fullNames || "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  const firstName =
    (typeof employeeProfile?.first_name === "string" && employeeProfile.first_name) ||
    nameParts[0] ||
    user.name.split(" ")[0] ||
    ""

  const middleName =
    (typeof employeeProfile?.middle_name === "string" && employeeProfile.middle_name) ||
    (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "")

  const surname =
    (typeof employeeProfile?.surname === "string" && employeeProfile.surname) ||
    (typeof employeeProfile?.last_name === "string" && employeeProfile.last_name) ||
    extractSurname(fullNames) ||
    extractSurname(user.name)

  const employeeIdDisplay =
    employeeProfile?.employee_number ??
    employeeProfile?.employeeId ??
    employeeProfile?.employee_id ??
    user.employeeId ??
    "—"

  const cellNumber =
    employeeProfile?.cell_number ??
    employeeProfile?.cellphone ??
    employeeProfile?.mobile ??
    employeeProfile?.phone ??
    "—"

  const jobTitle =
    employeeProfile?.job_title ??
    employeeProfile?.jobTitle ??
    employeeProfile?.title ??
    "—"

  const position =
    employeeProfile?.position ??
    employeeProfile?.designation ??
    getRoleDisplayName(user.role)

  const initials =
    user.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("") || "U"

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-4">
          {/* Logo + Burger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Toggle navigation"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-md border border-transparent p-2 transition hover:border-[#92278F]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92278F]/40"
            >
              <Menu className="h-5 w-5 text-[#25294B]" />
            </button>
            <button
              type="button"
              aria-label="Toggle navigation"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92278F]/50 focus-visible:ring-offset-2"
            >
              <XSparkLogo className="h-12 w-auto" />
            </button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="View notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#E31E24]" />
            </Button>

            {/* User Profile Trigger */}
            <Button variant="ghost" className="gap-2" onClick={() => setProfileDialogOpen(true)}>
              <Avatar className="h-8 w-8">
                {profileImage ? <AvatarImage src={profileImage} alt={user.name} /> : null}
                <AvatarFallback className="gradient-primary text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium">{user.name}</span>
                <Badge className={cn("text-xs", getRoleBadgeColor(user.role))}>{getRoleDisplayName(user.role)}</Badge>
              </div>
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle>Your Profile</DialogTitle>
            <DialogDescription>Quick view of your AMS account information.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              {profileImage ? <AvatarImage src={profileImage} alt={user.name} /> : null}
              <AvatarFallback className="gradient-primary text-white text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-base font-semibold text-[#25294B]">{fullNames || user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-1 inline-flex">
                <Badge className={cn("text-xs", getRoleBadgeColor(user.role))}>{getRoleDisplayName(user.role)}</Badge>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">First Name</span>
              <span className="font-medium text-[#25294B]">{firstName || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Middle Name</span>
              <span className="font-medium text-[#25294B]">{middleName || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Surname</span>
              <span className="font-medium text-[#25294B]">{surname || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Employee ID</span>
              <span className="font-medium text-[#25294B]">{employeeIdDisplay}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Cell Number</span>
              <span className="font-medium text-[#25294B]">{cellNumber}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Job Title</span>
              <span className="font-medium text-[#25294B]">{jobTitle || "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Position</span>
              <span className="font-medium text-[#25294B]">{position}</span>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Link href="/dashboard" className="flex-1">
              <Button className="w-full gradient-primary text-white">Switch System</Button>
            </Link>
            <div className="flex flex-1 justify-end gap-2">
              <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>Close</Button>
              <Button className="bg-gradient-to-r from-[#92278F] to-[#BE1E2D] text-white" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative min-h-screen">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-72 border-r border-[#E4E4E7] bg-background/98 shadow-lg transition-transform duration-300",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "md:translate-x-0",
          )}
        >
          <nav className="flex flex-col gap-3 px-6 pt-20 pb-6 md:pt-6 max-h-[calc(100vh-80px)] overflow-y-auto">
            {navigationTabs.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex min-h-[52px] items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-gradient-to-r from-[#A6206A]/10 to-[#C9234A]/10 text-[#25294B] border border-[#A6206A]/25 shadow-sm"
                      : "text-muted-foreground hover:text-[#25294B] hover:bg-muted/60",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="min-h-screen p-6 transition-[padding] duration-300 md:pl-[21rem]">{children}</main>
      </div>

      {/* AI Chat Widget */}
      <AIChatWidget />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}


