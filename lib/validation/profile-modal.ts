import { z } from "zod"

// Minimal validation schema for the profile modal
// Only validates the fields shown in the modal form
export const profileModalSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  sex: z.enum(["male", "female"], { required_error: "Sex is required" }),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional().or(z.literal("")),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().optional().or(z.literal("")),
  nationality: z.string().min(1, "Nationality is required"),
  date_hired: z.string().min(1, "Date hired is required")
})

export type ProfileModalFormData = z.infer<typeof profileModalSchema>

export const validateProfileModal = (data: unknown): { success: boolean; errors?: Array<{ field: string; message: string }> } => {
  try {
    profileModalSchema.parse(data)
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
      return { success: false, errors }
    }
    return { success: false, errors: [{ field: 'general', message: 'Validation failed' }] }
  }
}



