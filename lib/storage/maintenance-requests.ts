export type MaintenanceRequestRecord = {
  id: string
  deviceName: string
  assetTag: string
  issueType: string
  description?: string
  priority: "Low" | "Medium" | "High"
  status: "Pending" | "In Progress" | "Completed"
  createdAt: string
  updatedAt: string
}

export const MAINTENANCE_REQUESTS_UPDATED_EVENT = "maintenance-requests:updated"

const isBrowser = () => typeof window !== "undefined"

const getStorageKey = (userIdentifier: string | null | undefined) =>
  userIdentifier ? `maintenance_requests_${userIdentifier}` : null

export const getMaintenanceRequestRecords = (
  userIdentifier: string | null | undefined
): MaintenanceRequestRecord[] => {
  const key = getStorageKey(userIdentifier)
  if (!isBrowser() || !key) return []
  try {
    const stored = localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as MaintenanceRequestRecord[]) : []
  } catch (error) {
    console.error("Failed to load maintenance request records:", error)
    return []
  }
}

export const addMaintenanceRequestRecord = (
  userIdentifier: string | null | undefined,
  record: MaintenanceRequestRecord
) => {
  if (!isBrowser()) return
  const key = getStorageKey(userIdentifier)
  if (!key) return
  try {
    const existing = getMaintenanceRequestRecords(userIdentifier)
    const next = [record, ...existing]
    localStorage.setItem(key, JSON.stringify(next))
    window.dispatchEvent(
      new CustomEvent(MAINTENANCE_REQUESTS_UPDATED_EVENT, {
        detail: { key },
      })
    )
  } catch (error) {
    console.error("Failed to add maintenance request record:", error)
  }
}

