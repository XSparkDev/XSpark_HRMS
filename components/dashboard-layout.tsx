"use client"

import { type ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { XSparkLogo } from "@/components/xspark-logo"
import { type User as AuthUser, getCurrentUser, logout, getRoleBadgeColor, getRoleDisplayName, hasPermission } from "@/lib/auth"
import {
  Home,
  Users,
  Calendar,
  FolderOpen,
  ClipboardList,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  MessageSquare,
  User as UserIcon,
  Package,
  Plus,
  CheckCircle2,
  Activity,
  TrendingUp,
  FileText,
  ArrowLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: ReactNode
}

function DashboardContent({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const current = getCurrentUser()
    if (!current) {
      router.push("/login")
      return
    }
    
    // If user is on root dashboard, redirect to system selector
    if (pathname === "/dashboard") {
      router.push("/system-selector")
      return
    }
    
    setUser(current)
    setIsReady(true)
  }, [router, pathname])

  if (!isReady || !user) {
    return null
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  // Determine current system based on pathname
  const isHRMS = pathname.startsWith("/hrms")
  const isAMS = pathname.startsWith("/ams")
  
  const navigation = isHRMS ? [
    { name: "Dashboard", href: "/hrms/dashboard", icon: Home, permission: "*" },
    { name: "My Profile", href: "/hrms/profile", icon: UserIcon, permission: "*" },
    { name: "Employees", href: "/hrms/employees", icon: Users, permission: "view_employees" },
    { name: "Leave Requests", href: "/hrms/leave", icon: Calendar, permission: "*" },
    { name: "Documents", href: "/hrms/documents", icon: FolderOpen, permission: "*" },
    { name: "Audit Logs", href: "/hrms/audit", icon: ClipboardList, permission: "*", adminOnly: true },
  ] : isAMS ? [
    { name: "Dashboard", href: "/ams/dashboard", icon: Home, permission: "*" },
    { name: "All Devices", href: "/ams/all-devices", icon: Package, permission: "*" },
    { name: "Add Device", href: "/ams/add", icon: Plus, permission: "add_devices" },
    { name: "Borrow Device", href: "/ams/borrow", icon: Package, permission: "borrow_devices" },
    { name: "Return Device", href: "/ams/return", icon: CheckCircle2, permission: "return_devices" },
    { name: "Activity Log", href: "/ams/activity", icon: Activity, permission: "*" },
    { name: "Device Status", href: "/ams/status", icon: TrendingUp, permission: "*" },
    { name: "Condition Reports", href: "/ams/reports", icon: FileText, permission: "*" },
    { name: "AMS Settings", href: "/ams/settings", icon: Settings, permission: "manage_ams_settings" },
  ] : []

  const filteredNavigation = navigation.filter((item) => {
    if (item.adminOnly && user.role !== "super_admin") return false
    if (item.permission === "*") return true
    return hasPermission(user, item.permission)
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-4">
          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Logo */}
          <Link href={isHRMS ? "/hrms/dashboard" : isAMS ? "/ams/dashboard" : "/system-selector"} className="flex items-center">
            <XSparkLogo className="h-8 w-auto" />
          </Link>

          {/* System Switcher */}
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/system-selector")}
              className="text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Switch System
            </Button>
            <Badge variant="outline" className="text-xs">
              {isHRMS ? "HRMS" : isAMS ? "AMS" : "Platform"}
            </Badge>
          </div>

          {/* Search (HR Manager and above) */}
          {hasPermission(user, "view_employees") && (
            <div className="hidden md:flex flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search employees..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          <div className="flex-1" />

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#E31E24]" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="gradient-primary text-white text-xs">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium">{user.name}</span>
                  <Badge className={cn("text-xs", getRoleBadgeColor(user.role))}>{getRoleDisplayName(user.role)}</Badge>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <UserIcon className="mr-2 h-4 w-4" />
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 border-r bg-background transition-transform duration-300 md:translate-x-0 md:static",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav className="flex flex-col gap-2 p-4 pt-20 md:pt-4">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gradient-to-r from-[#A6206A]/10 to-[#C9234A]/10 text-navy border-l-4 border-l-[#A6206A]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* AI Chatbot Widget */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          className="h-14 w-14 rounded-full gradient-primary text-white shadow-lg hover:shadow-xl transition-all animate-pulse"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </div>

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

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return <DashboardContent>{children}</DashboardContent>
}
