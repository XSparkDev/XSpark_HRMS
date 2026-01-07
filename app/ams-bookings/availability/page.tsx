"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"

import { RoomAvailabilityModal } from "@/components/room-availability-modal"

export default function CheckRoomAvailabilityPage() {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        router.back()
      }
    },
    [router],
  )

  return <RoomAvailabilityModal open={open} onOpenChange={handleOpenChange} />
}



