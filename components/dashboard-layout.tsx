"use client"

import { type ReactNode, useState, useEffect, memo } from "react"
import dynamic from "next/dynamic"
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
import { getCurrentUser, logout, getRoleBadgeColor, getRoleDisplayName, hasPermission, User } from "@/lib/auth"

// Lazy load AI chat widget to reduce initial bundle size
const AIChatWidget = dynamic(() => import("@/components/ai-chat-widget").then(mod => ({ default: mod.AIChatWidget })), {
  loading: () => null,
  ssr: false,
})
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
  StickyNote,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | undefined>(undefined)
  const [displayName, setDisplayName] = useState<string>("")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.replace("/login")
    }
    setUser(currentUser)
    // Initial load of profile for display name
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/auth/me', { headers: { 'Content-Type': 'application/json' } })
        const json = await res.json().catch(() => ({}))
        const profile = json?.data?.employee || null
        if (profile) {
          const dn = profile.preferred_name || `${profile.first_name} ${profile.last_name}`
          setDisplayName(dn)
        } else if (currentUser?.name) {
          setDisplayName(currentUser.name)
        }
      } catch {
        if (currentUser?.name) setDisplayName(currentUser.name)
      }
    }
    loadProfile()

    const onProfileUpdated = () => loadProfile()
    window.addEventListener('profile-updated', onProfileUpdated as EventListener)
    return () => window.removeEventListener('profile-updated', onProfileUpdated as EventListener)
  }, [router])

  if (user === undefined) {
    return null // Render nothing until user is determined
  }

  if (user === null) {
    return null // Redirect handled by useEffect
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home, permission: "*" },
    { name: "My Profile", href: "/profile", icon: UserIcon, permission: "*" },
    { name: "Notes", href: "/notes", icon: StickyNote, permission: "*" },
    { name: "Employees", href: "/employees", icon: Users, permission: "view_employees" },
    { name: "Leave Requests", href: "/leave", icon: Calendar, permission: "*" },
    { name: "Documents", href: "/documents", icon: FolderOpen, permission: "*" },
    { name: "Audit Logs", href: "/audit", icon: ClipboardList, permission: "*", adminOnly: true },
    { name: "Switch System", href: "/system-selector", icon: Settings, permission: "*" },
  ]

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
          <Link href="/dashboard" className="flex items-center">
            <XSparkLogo className="h-8 w-auto" />
          </Link>

          {/* Search (Admin and above) */}
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
                    {(displayName || user.name)
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium">{displayName || user.name}</span>
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