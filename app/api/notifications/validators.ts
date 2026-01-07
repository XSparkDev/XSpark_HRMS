import { z } from 'zod'

export const notificationsListSchema = z.object({
  employeeId: z.string().uuid('employeeId must be a valid UUID'),
  onlyUnread: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => {
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        const normalized = value.toLowerCase()
        return normalized === 'true' || normalized === '1'
      }
      return false
    }),
})

export const notificationCreateSchema = z.object({
  employee_id: z.string().uuid('employee_id must be a valid UUID'),
  title: z.string().min(1, 'title is required'),
  message: z.string().min(1, 'message is required'),
  notification_type: z.string().min(1, 'notification_type is required'),
  published_by: z.string().uuid('published_by must be a valid UUID'),
  is_confidential: z.boolean().optional(),
})


