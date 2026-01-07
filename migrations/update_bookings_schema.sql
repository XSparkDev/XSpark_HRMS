-- ============================================================================
-- UPDATE BOOKINGS TABLE SCHEMA
-- ============================================================================
-- This migration adds missing columns to the bookings table based on
-- the bookings-service.ts interface requirements.
-- 
-- IMPORTANT: Bookings are automatically approved by the system. Conflicts are 
-- resolved separately by supervisors based on meeting type, category, and 
-- employee position. Therefore, approved_by and approved_at columns are NOT 
-- needed and are NOT included in this migration.
-- 
-- Run this SQL script to update your bookings table schema.
-- ============================================================================

-- Add checked_in_at column (timestamp when user checked in)
-- Note: This is separate from check_in_time which is the scheduled check-in time
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE NULL;

-- Add rejection_reason column (text field for cancellation reasons)
-- Accepts any text data - examples: "Cancelled by user", "Room unavailable", etc.
-- Note: Used only for cancellations, NOT for conflict resolution rejections
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;

-- Add created_at column (timestamp when booking was created)
-- Sets default to NOW() for new records
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW();

-- Add updated_at column (timestamp when booking was last updated)
-- Sets default to NOW() for new records
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW();

-- Update existing records to have created_at and updated_at timestamps
UPDATE public.bookings
SET created_at = NOW(), updated_at = NOW()
WHERE created_at IS NULL OR updated_at IS NULL;

-- Add trigger function to automatically update updated_at on record updates
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS trigger_update_bookings_updated_at ON public.bookings;
CREATE TRIGGER trigger_update_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_bookings_updated_at();

-- Add comments to document the columns
COMMENT ON COLUMN public.bookings.checked_in_at IS 
'Timestamp when the user checked in for the booking. Separate from check_in_time which is the scheduled check-in time.';

COMMENT ON COLUMN public.bookings.rejection_reason IS 
'Text field for cancellation reasons. Accepts any text data such as: 
- "Cancelled by user"
- "Room unavailable" 
- "Schedule conflict"
- Any other descriptive text explaining why the booking was cancelled.

Note: Bookings are automatically approved by the system. Conflicts are resolved separately 
by supervisors based on meeting type, category, and employee position.';

COMMENT ON COLUMN public.bookings.created_at IS 
'Timestamp when the booking record was created. Automatically set on insert.';

COMMENT ON COLUMN public.bookings.updated_at IS 
'Timestamp when the booking record was last updated. Automatically updated on each update.';

-- Optional: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bookings_rejection_reason ON public.bookings(rejection_reason) 
WHERE rejection_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_checked_in_at ON public.bookings(checked_in_at) 
WHERE checked_in_at IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this query to verify all columns were added successfully:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'bookings'
-- ORDER BY ordinal_position;
