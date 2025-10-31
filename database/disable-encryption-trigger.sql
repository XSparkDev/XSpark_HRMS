-- ============================================================================
-- DISABLE ENCRYPTION TRIGGER
-- ============================================================================
-- This script disables the database-level encryption trigger for employees
-- Encryption is now handled in the backend service layer using lib/crypto.ts
-- ============================================================================

-- Disable encryption trigger for employees table
DROP TRIGGER IF EXISTS encrypt_employee_sensitive_data ON employees;

-- Disable encryption trigger for banking_details table
DROP TRIGGER IF EXISTS encrypt_banking_details_data ON banking_details;

-- ============================================================================
-- NOTES
-- ============================================================================
-- • Encryption is now handled in backend service (lib/services/employee-service.ts)
-- • Uses lib/crypto.ts with AES-256-GCM encryption
-- • Encryption key managed via ENCRYPTION_KEY environment variable
-- • This provides better key management and easier debugging
-- • Trigger functions remain in DB but are not active

-- ============================================================================
-- FALLBACK: Re-enable triggers if needed
-- ============================================================================
-- To re-enable the encryption trigger (requires app.encryption_key to be set):
-- 
-- CREATE TRIGGER encrypt_employee_sensitive_data
-- BEFORE INSERT OR UPDATE ON employees
-- FOR EACH ROW EXECUTE FUNCTION encrypt_sensitive_data();
--
-- CREATE TRIGGER encrypt_banking_details_data
-- BEFORE INSERT OR UPDATE ON banking_details
-- FOR EACH ROW EXECUTE FUNCTION encrypt_banking_data();
--
-- Note: You must set the encryption key in Postgres config:
-- ALTER DATABASE your_database SET app.encryption_key = 'your-encryption-key';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check that triggers are disabled:
-- SELECT tgname, tgenabled 
-- FROM pg_trigger 
-- WHERE tgrelid = 'employees'::regclass 
-- AND tgname LIKE '%encrypt%';
--
-- Expected: No rows returned (triggers dropped)

