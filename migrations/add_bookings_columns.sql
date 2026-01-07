-- Migration: Add missing columns to bookings table
-- Based on bookings-service.ts requirements
-- Date: 2025
-- 
-- IMPORTANT: Bookings are automatically approved by the system. Conflicts are resolved
-- separately by supervisors based on meeting type, category, and employee position.
-- Therefore, approved_by and approved_at columns are NOT needed.

-- Add checked_in_at column (timestamp when user checked in)
-- Note: This is separate from check_in_time which stores the scheduled check-in time
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE NULL;

-- Add rejection_reason column (text field for cancellation reasons)
-- This accepts any text data - examples: "Cancelled by user", "Room unavailable", "Schedule conflict", etc.
-- Note: Used only for cancellations, NOT for conflict resolution rejections
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;

-- Add created_at column (timestamp when booking was created)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW();

-- Add updated_at column (timestamp when booking was last updated)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW();

-- Update existing records to have created_at and updated_at timestamps
UPDATE public.bookings
SET created_at = NOW(), updated_at = NOW()
WHERE created_at IS NULL OR updated_at IS NULL;

-- Add a trigger to automatically update updated_at on record updates
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_bookings_updated_at ON public.bookings;
CREATE TRIGGER trigger_update_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_bookings_updated_at();

-- Add comment to rejection_reason column explaining acceptable values
COMMENT ON COLUMN public.bookings.rejection_reason IS 
'Text field for cancellation reasons. Accepts any text data such as: 
- "Cancelled by user"
- "Room unavailable" 
- "Schedule conflict"
- Any other descriptive text explaining why the booking was cancelled.

Note: Bookings are automatically approved by the system. Conflicts are resolved separately 
by supervisors based on meeting type, category, and employee position.';

-- Optional: Add index on rejection_reason for filtering cancelled bookings
CREATE INDEX IF NOT EXISTS idx_bookings_rejection_reason ON public.bookings(rejection_reason) 
WHERE rejection_reason IS NOT NULL;

-- Optional: Add index on checked_in_at for filtering checked-in bookings
CREATE INDEX IF NOT EXISTS idx_bookings_checked_in_at ON public.bookings(checked_in_at) 
WHERE checked_in_at IS NOT NULL;
