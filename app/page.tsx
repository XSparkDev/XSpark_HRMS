"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    const user = getCurrentUser()
    if (user) {
      // If user is authenticated, redirect to system selector
      router.replace("/system-selector")
    } else {
      // If not authenticated, redirect to login
      router.replace("/login")
    }
  }, [router])

  // Show nothing while redirecting
  return null
}
