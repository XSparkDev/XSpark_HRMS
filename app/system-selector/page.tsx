"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { XSparkLogo } from "@/components/xspark-logo"
import { getCurrentUser, logout } from "@/lib/auth"
import { Users, Building2, LogOut } from "lucide-react"

export default function SystemSelectorPage() {
  const router = useRouter()
  const user = getCurrentUser()

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user) {
      router.push("/login")
      return
    }
  }, [user, router])

  if (!user) return null

  const handleSystemSelection = (systemPath: string) => {
    // Store the selected system for future logins
    localStorage.setItem("lastSelectedSystem", systemPath)
    router.push(systemPath)
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-white flex flex-col p-4 md:p-6">
      {/* Header with Logo and Logout */}
      <div className="w-full max-w-6xl mx-auto pt-10 md:pt-16 mb-4 md:mb-8">
        <div className="flex justify-between items-center">
          <div className="flex-1"></div>
          <div className="flex-1 flex justify-center">
            <XSparkLogo className="h-20 md:h-28 w-auto" />
          </div>
          <div className="flex-1 flex justify-end">
            <Button
              onClick={handleLogout}
              variant="outline"
              size="default"
              className="bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-700 font-medium shadow-sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div className="w-full max-w-6xl mx-auto px-4">
          {/* Main Heading */}
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2 md:mb-3">Select a System to Continue</h1>
            <p className="text-gray-600 text-base md:text-lg">
              Choose the system you want to access
            </p>
          </div>

          {/* System Options - Perfectly Aligned */}
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 justify-center items-center md:items-stretch max-w-4xl mx-auto mb-8 md:mb-12">
            {/* HR Management System */}
            <Card className="w-full md:flex-1 md:max-w-md group hover:shadow-xl transition-all duration-300 cursor-pointer border-gray-200">
              <CardContent className="p-6 md:p-8 text-center flex flex-col h-full">
                <div className="flex-grow">
                  <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-8 w-8 md:h-10 md:w-10 text-white" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2 md:mb-3">HR Management System</h2>
                  <p className="text-gray-600 text-sm mb-6 md:mb-8">
                    Manage employees, leave requests, documents, and HR operations
                  </p>
                </div>
                <Button 
                  onClick={() => handleSystemSelection("/dashboard")}
                  className="w-full gradient-primary text-white hover:opacity-90 transition-opacity h-12 text-base font-medium"
                >
                  Access HRMS
                </Button>
              </CardContent>
            </Card>

            {/* Asset Management System */}
            <Card className="w-full md:flex-1 md:max-w-md group hover:shadow-xl transition-all duration-300 cursor-pointer border-gray-200">
              <CardContent className="p-6 md:p-8 text-center flex flex-col h-full">
                <div className="flex-grow">
                  <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Building2 className="h-8 w-8 md:h-10 md:w-10 text-white" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2 md:mb-3">Asset Management System</h2>
                  <p className="text-gray-600 text-sm mb-6 md:mb-8">
                    Track assets, manage inventory, and monitor equipment lifecycle
                  </p>
                </div>
                <Button 
                  onClick={() => handleSystemSelection("/ams-dashboard")}
                  className="w-full gradient-primary text-white hover:opacity-90 transition-opacity h-12 text-base font-medium"
                >
                  Access AMS
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Footer with Welcome Message */}
          <div className="text-center">
            <p className="text-base md:text-lg text-gray-700 font-medium">
              Welcome back, <span className="text-gray-900 font-semibold">{user.name}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
