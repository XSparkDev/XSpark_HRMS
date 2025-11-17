const CONTACT_FEEDBACKS_KEY = 'contact_feedbacks'
const CONTACT_QUERIES_KEY = 'contact_queries'

type ContactEntry = {
  id: string
  userId: string
  message: string
  createdAt: string
  recipient?: string
}

const isBrowser = () => typeof window !== 'undefined'

const readEntries = (key: string): ContactEntry[] => {
  if (!isBrowser()) return []
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as ContactEntry[]) : []
  } catch (error) {
    console.error(`Failed to read ${key}:`, error)
    return []
  }
}

const writeEntries = (key: string, entries: ContactEntry[]) => {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(entries))
  } catch (error) {
    console.error(`Failed to write ${key}:`, error)
  }
}

const addEntry = (key: string, entry: ContactEntry): ContactEntry[] => {
  const entries = [entry, ...readEntries(key)]
  writeEntries(key, entries)
  return entries
}

export const getUserFeedbackEntries = (userId?: string | null) => {
  if (!userId) return []
  return readEntries(CONTACT_FEEDBACKS_KEY).filter((entry) => entry.userId === userId)
}

export const getUserQueryEntries = (userId?: string | null) => {
  if (!userId) return []
  return readEntries(CONTACT_QUERIES_KEY).filter((entry) => entry.userId === userId)
}

export const addUserFeedbackEntry = (entry: ContactEntry) => addEntry(CONTACT_FEEDBACKS_KEY, entry)
export const addUserQueryEntry = (entry: ContactEntry) => addEntry(CONTACT_QUERIES_KEY, entry)


