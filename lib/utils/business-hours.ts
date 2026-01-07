const TIME_PATTERN = /^\d{2}:\d{2}$/

export const BUSINESS_START_TIME = "08:30"
export const BUSINESS_END_TIME = "17:00"
export const BUSINESS_START_MINUTES = 8 * 60 + 30
export const BUSINESS_END_MINUTES = 17 * 60

export const timeStringToMinutes = (value?: string | null): number | null => {
  if (!value || !TIME_PATTERN.test(value)) return null
  const [hours, minutes] = value.split(":").map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

export const isWithinBusinessHours = (value?: string | null): boolean => {
  const minutes = timeStringToMinutes(value)
  if (minutes === null) return false
  return minutes >= BUSINESS_START_MINUTES && minutes <= BUSINESS_END_MINUTES
}

export const validateBusinessHourSelection = (value?: string | null) => {
  if (!value) return "Time is required."
  if (!TIME_PATTERN.test(value)) return "Enter time in HH:MM format."
  if (!isWithinBusinessHours(value)) return "Not a business hour"
  return null
}

export const BUSINESS_TIME_PATTERN = TIME_PATTERN














