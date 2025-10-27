# Asset Management System (AMS) Database Migration

This document explains how to add the AMS database schema to your existing X Spark HRMS database.

## Overview

The AMS migration adds Asset Management functionality to the existing HRMS database. It creates tables for:
- Users (AMS-specific user management)
- Resources (equipment, rooms, vehicles)
- Bookings (resource reservations)
- Scan Logs (QR code tracking)
- Notifications (booking confirmations, etc.)
- Incidents (damage/malfunction reporting)
- Audit Logs (AMS activity tracking)

## Installation

### Prerequisites

1. Ensure you have already deployed the HRMS schema (`complete-schema.sql`)
2. You have admin access to your Supabase/SQL database
3. Backup your database (recommended)

### Running the Migration

**Option 1: Supabase Dashboard**
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy the contents of `ams-migration.sql`
4. Paste into the SQL Editor
5. Click "Run"

**Option 2: Command Line**
```bash
psql -U postgres -d your_database -f ams-migration.sql
```

### What This Migration Does

1. **Checks for existing objects** - Won't create duplicates
2. **Creates 7 new tables** (if they don't exist):
   - `users` (extends `auth.users`)
   - `resources`
   - `bookings`
   - `scan_logs`
   - `notifications` (may conflict with existing HRMS table)
   - `incidents`
   - `audit_logs` (may conflict with existing HRMS table)

3. **Creates indexes** for performance
4. **Sets up RLS policies** for security
5. **Creates triggers** for automatic timestamp updates
6. **Inserts seed data** (sample resources)

## Important Warnings

### Potential Table Conflicts

The AMS schema uses the following table names that may already exist in your HRMS database:

- **`public.users`** - If this already exists, the migration will skip creating it
- **`public.notifications`** - HRMS already has this with a different schema. The migration will skip if it exists
- **`public.audit_logs`** - HRMS already has this with a different schema. The migration will skip if it exists

### What to Do If Tables Conflict

If `notifications` or `audit_logs` already exist but with different schemas:

**Option 1: Use the existing HRMS tables** (if structure is compatible)
- Keep the existing tables
- Modify your AMS code to work with the existing structure

**Option 2: Rename tables** (if structures differ significantly)
- Manually rename AMS tables to `ams_notifications` and `ams_audit_logs`
- Or drop the existing tables and re-run the migration

**Option 3: Separate AMS tables** (recommended)
- Modify the migration to use unique names like `ams_notifications`
- This keeps HRMS and AMS data completely separate

## Verification

After running the migration, verify it worked:

```sql
-- Check that tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'resources', 'bookings', 'scan_logs', 'notifications', 'incidents', 'audit_logs');

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename LIKE '%resource%' OR tablename LIKE '%booking%';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'resources', 'bookings');
```

## Rollback

If you need to remove the AMS tables:

```sql
-- WARNING: This will delete all AMS data!
DROP TABLE IF EXISTS public.incidents CASCADE;
DROP TABLE IF EXISTS public.scan_logs CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.resources CASCADE;
-- Note: DO NOT drop users, notifications, or audit_logs if they're shared with HRMS
```

## Troubleshooting

### Error: "infinite recursion detected in policy for relation"
**If you get this error after running the migration:**

The RLS policies are causing infinite recursion. Fix this by running:

```sql
-- In your Supabase SQL Editor, run:
\i database/fix-rls-recursion.sql

-- Or copy and paste the contents of database/fix-rls-recursion.sql
```

This creates a `check_user_role` function that bypasses RLS to prevent recursion.

### Error: "relation already exists"
- This is expected if you've run the migration before
- The migration uses `IF NOT EXISTS` checks
- It's safe to ignore these warnings

### Error: "permission denied"
- Ensure you're running as a database superuser or have appropriate privileges
- For Supabase, use the Dashboard SQL Editor

### Error: "function already exists"
- The migration uses `CREATE OR REPLACE` for functions
- This is normal and safe

### RLS Policies Not Working
- Ensure RLS is enabled on the tables
- Check that policies were created successfully
- Verify your user has the correct role

## Next Steps

After successful migration:

1. **Populate users table** - Link AMS users to auth.users
2. **Add resources** - Create the assets you want to manage
3. **Configure notifications** - Set up email/notification services
4. **Test bookings** - Verify booking flow works correctly
5. **Set up QR codes** - Generate QR codes for resources

## Support

For issues or questions:
- Check the X Spark HRMS main documentation
- Review the SQL migration file comments
- Contact the development team

## File Information

- **Migration File:** `database/ams-migration.sql`
- **Version:** 1.0
- **Last Updated:** 2025-01-23
- **Compatible With:** PostgreSQL 15+, Supabase
