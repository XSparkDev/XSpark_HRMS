export type DeviceHistoryEntry = {
  recordId: string
  deviceId: string
  deviceName: string
  deviceType: string
  borrowDate: string
  expectedReturnDate?: string
  returnDate?: string
  status: "Pending" | "Borrowed" | "Awaiting Return" | "Awaiting Review" | "Returned"
  action: "Borrow" | "Return" | "Incident"
  notes?: string
}

export type BorrowRequestRecord = {
  id: string
  employeeName: string
  employeeId: string
  deviceName: string
  assetTag: string
  borrowDate: string
  purpose: string
  status: string
}

export const DEVICE_HISTORY_UPDATED_EVENT = "device-history:updated"
export const BORROW_REQUESTS_UPDATED_EVENT = "borrow-requests:updated"

const isBrowser = () => typeof window !== "undefined"

export const appendDeviceHistoryEntry = (
  userIdentifier: string | null | undefined,
  entry: DeviceHistoryEntry
) => {
  if (!isBrowser() || !userIdentifier) return
  const key = `ams_device_history_${userIdentifier}`
  try {
    const existing = JSON.parse(localStorage.getItem(key) || "[]")
    const next = [entry, ...existing]
    localStorage.setItem(key, JSON.stringify(next))
    window.dispatchEvent(
      new CustomEvent(DEVICE_HISTORY_UPDATED_EVENT, {
        detail: { key },
      })
    )
  } catch (error) {
    console.error("Failed to append device history entry:", error)
  }
}

export const addBorrowRequestRecord = (record: BorrowRequestRecord) => {
  if (!isBrowser()) return
  try {
    const existing = JSON.parse(localStorage.getItem("borrowRequests") || "[]")
    const next = [record, ...existing]
    localStorage.setItem("borrowRequests", JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(BORROW_REQUESTS_UPDATED_EVENT))
  } catch (error) {
    console.error("Failed to add borrow request record:", error)
  }
}















