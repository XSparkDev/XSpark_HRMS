"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"

export default function DashboardPage() {
  const router = useRouter()
  const user = getCurrentUser()

  useEffect(() => {
    if (!user) {
      router.push("/login")
    } else {
      router.push("/system-selector")
    }
  }, [user, router])

  return null
}
