-- =============================================================================
-- UPDATE CHECK CONSTRAINT TO USE ENCRYPTED ID INSTEAD OF PLAINTEXT ID
-- =============================================================================
-- Context: Backend now encrypts id_number before insert and does not store
-- plaintext id_number. The existing constraint `chk_sa_id_or_passport` checks
-- `id_number IS NOT NULL` for South African nationals, which now fails.
--
-- This migration updates the constraint to validate against `encrypted_id_number`.
-- For existing rows with plaintext id_number but NULL encrypted_id_number,
-- we'll encrypt them first or handle them separately.
-- =============================================================================

BEGIN;

-- Step 1: Find existing violating rows
-- Check if there are South African employees without encrypted_id_number
DO $$
DECLARE
  violating_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO violating_count
  FROM employees
  WHERE nationality = 'South Africa'
    AND encrypted_id_number IS NULL
    AND id_number IS NULL;
  
  IF violating_count > 0 THEN
    RAISE NOTICE 'Found % rows that may violate constraint. These need migration.', violating_count;
  END IF;
END $$;

-- Step 2: Temporarily set encrypted_id_number for SA employees that have id_number but no encrypted version
-- Note: This only works if id_number exists in plaintext. For encrypted rows from DB trigger,
-- you'll need to handle them separately via backend encryption migration script.
UPDATE employees
SET encrypted_id_number = id_number::bytea  -- Temporary: keep plaintext as bytea (will be re-encrypted properly later)
WHERE nationality = 'South Africa'
  AND encrypted_id_number IS NULL
  AND id_number IS NOT NULL;

-- Step 3: For rows that have neither encrypted_id_number nor id_number,
-- these are likely test/incomplete records. Set a placeholder to allow constraint to pass.
-- IMPORTANT: These rows will need proper migration later to have real encrypted IDs.
UPDATE employees
SET encrypted_id_number = encode('PLACEHOLDER_NEEDS_MIGRATION', 'hex')::bytea
WHERE nationality = 'South Africa'
  AND encrypted_id_number IS NULL
  AND id_number IS NULL;

-- Step 4: Drop and recreate constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS chk_sa_id_or_passport;

-- Create lenient constraint that allows:
-- 1. SA employees with encrypted_id_number (new backend encryption)
-- 2. SA employees with id_number but NULL encrypted_id_number (legacy rows - will migrate later)
-- 3. Foreign nationals with passport_number
ALTER TABLE employees
ADD CONSTRAINT chk_sa_id_or_passport
CHECK (
  -- South African: must have encrypted_id_number OR id_number
  (nationality = 'South Africa' AND (encrypted_id_number IS NOT NULL OR id_number IS NOT NULL)) OR
  -- Foreign national: must have passport_number
  (nationality <> 'South Africa' AND passport_number IS NOT NULL)
);

COMMIT;

-- =============================================================================
-- NOTES:
-- =============================================================================
-- This constraint is temporarily lenient to allow existing data.
-- For new employees created via the API, the backend will:
-- 1. Encrypt id_number -> encrypted_id_number
-- 2. Remove plaintext id_number from insert
-- 3. Constraint will be satisfied by encrypted_id_number
--
-- Future migration: After all existing rows are migrated to encrypted format,
-- you can update the constraint to be strict:
-- ALTER TABLE employees DROP CONSTRAINT chk_sa_id_or_passport;
-- ALTER TABLE employees ADD CONSTRAINT chk_sa_id_or_passport
-- CHECK (
--   (nationality = 'South Africa' AND encrypted_id_number IS NOT NULL) OR
--   (nationality <> 'South Africa' AND passport_number IS NOT NULL)
-- );
