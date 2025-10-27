"use client"

import { AMSDashboardLayout } from "@/components/ams-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser } from "@/lib/auth"
import { useRouter } from "next/navigation"
import {
  CalendarPlus,
  CalendarCheck,
  Search,
  History,
} from "lucide-react"

export default function AMSBookingsPage() {
  const user = getCurrentUser()
  const router = useRouter()

  if (!user) return null

  const handleCardClick = (action: string) => {
    switch (action) {
      case "book":
        router.push("/ams-bookings/book")
        break
      case "my-bookings":
        router.push("/ams-bookings/my-bookings")
        break
      case "availability":
        router.push("/ams-bookings/availability")
        break
      case "history":
        router.push("/ams-bookings/history")
        break
      default:
        break
    }
  }

  return (
    <AMSDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-navy">Room Bookings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your room bookings and check availability
          </p>
        </div>

        {/* Room Booking Cards Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Book a Room Card */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20 hover:scale-105">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <CalendarPlus className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-navy mb-2">Book a Room</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Reserve a conference room or meeting space
                </p>
              </div>
              <Button 
                onClick={() => handleCardClick("book")}
                className="w-full gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                Book Now
              </Button>
            </CardContent>
          </Card>

          {/* My Room Bookings Card */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20 hover:scale-105">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <CalendarCheck className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-navy mb-2">My Room Bookings</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  View your current and upcoming bookings
                </p>
              </div>
              <Button 
                onClick={() => handleCardClick("my-bookings")}
                className="w-full gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                View Bookings
              </Button>
            </CardContent>
          </Card>

          {/* Check Room Availability Card */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20 hover:scale-105">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Search className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-navy mb-2">Check Room Availability</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Find available rooms by date and time
                </p>
              </div>
              <Button 
                onClick={() => handleCardClick("availability")}
                className="w-full gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                Check Availability
              </Button>
            </CardContent>
          </Card>

          {/* Booking History Card */}
          <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/20 hover:scale-105">
            <CardContent className="p-6 text-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <History className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-navy mb-2">Booking History</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  View all your previous room bookings
                </p>
              </div>
              <Button 
                onClick={() => handleCardClick("history")}
                className="w-full gradient-primary text-white hover:opacity-90 transition-opacity"
              >
                View History
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AMSDashboardLayout>
  )
}