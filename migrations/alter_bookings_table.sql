-- ============================================================================
-- ALTER BOOKINGS TABLE - Add Missing Columns
-- ============================================================================
-- Copy and run this entire script in your Supabase SQL editor or PostgreSQL client
-- ============================================================================

-- Add checked_in_at column (actual check-in timestamp)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE NULL;

-- Add rejection_reason column (TEXT - accepts any text string)
-- Used for cancellation reasons only
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;

-- Add created_at column (creation timestamp)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW();

-- Add updated_at column (last update timestamp)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW();

-- Update existing records with timestamps
UPDATE public.bookings
SET created_at = NOW(), updated_at = NOW()
WHERE created_at IS NULL OR updated_at IS NULL;

-- Create function to auto-update updated_at on record updates
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_bookings_updated_at ON public.bookings;
CREATE TRIGGER trigger_update_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_bookings_updated_at();

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bookings_rejection_reason ON public.bookings(rejection_reason) 
WHERE rejection_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_checked_in_at ON public.bookings(checked_in_at) 
WHERE checked_in_at IS NOT NULL;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW();

-- Add updated_at column
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW();

-- Update existing records with timestamps
UPDATE public.bookings
SET created_at = NOW(), updated_at = NOW()
WHERE created_at IS NULL OR updated_at IS NULL;

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on record updates
DROP TRIGGER IF EXISTS trigger_update_bookings_updated_at ON public.bookings;
CREATE TRIGGER trigger_update_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_bookings_updated_at();

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_bookings_rejection_reason ON public.bookings(rejection_reason) 
WHERE rejection_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_checked_in_at ON public.bookings(checked_in_at) 
WHERE checked_in_at IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN public.bookings.checked_in_at IS 
'Timestamp when user actually checked in. Separate from check_in_time (scheduled time).';

COMMENT ON COLUMN public.bookings.rejection_reason IS 
'Text field for cancellation reasons. Accepts any text (e.g., "Cancelled by user", "Room unavailable"). Bookings are auto-approved.';

COMMENT ON COLUMN public.bookings.created_at IS 
'Timestamp when booking record was created. Auto-set to NOW() on insert.';

COMMENT ON COLUMN public.bookings.updated_at IS 
'Timestamp when booking record was last updated. Auto-updated via trigger.';



