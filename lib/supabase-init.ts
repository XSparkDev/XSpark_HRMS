// ============================================================================
// SUPABASE INITIALIZATION SCRIPT
// ============================================================================
// This script initializes Supabase connections and sets up storage buckets
// ============================================================================

import { initializeSupabase, storageConfig } from '@/lib/supabase'

// Storage bucket setup
export async function setupStorageBuckets() {
  const { supabase } = await import('@/lib/supabase')
  
  console.log('🪣 Setting up Supabase Storage buckets...')
  
  const buckets = [
    {
      name: storageConfig.buckets.employeeDocuments,
      public: false,
      description: 'Employee documents and files'
    },
    {
      name: storageConfig.buckets.contracts,
      public: false,
      description: 'Employment contracts'
    },
    {
      name: storageConfig.buckets.payslips,
      public: false,
      description: 'Employee payslips'
    },
    {
      name: storageConfig.buckets.profilePictures,
      public: true,
      description: 'Employee profile pictures'
    },
    {
      name: storageConfig.buckets.supportingDocuments,
      public: false,
      description: 'Supporting documents for leave requests'
    }
  ]

  for (const bucket of buckets) {
    try {
      // Check if bucket exists
      const { data: existingBuckets, error: listError } = await supabase.storage
        .listBuckets()

      if (listError) {
        console.error(`Error listing buckets:`, listError)
        continue
      }

      const bucketExists = existingBuckets?.some(b => b.name === bucket.name)

      if (!bucketExists) {
        // Create bucket
        const { data, error } = await supabase.storage
          .createBucket(bucket.name, {
            public: bucket.public,
            allowedMimeTypes: bucket.public 
              ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
              : ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
          })

        if (error) {
          console.error(`Error creating bucket ${bucket.name}:`, error)
        } else {
          console.log(`✅ Created bucket: ${bucket.name}`)
        }
      } else {
        console.log(`✅ Bucket already exists: ${bucket.name}`)
      }
    } catch (error) {
      console.error(`Error setting up bucket ${bucket.name}:`, error)
    }
  }
}

// Database schema validation
export async function validateDatabaseSchema() {
  const { supabase } = await import('@/lib/supabase')
  
  console.log('🔍 Validating database schema...')
  
  const requiredTables = [
    'roles', 'job_titles', 'employees', 'next_of_kin', 'income',
    'contracts', 'banking_details', 'payslips', 'leave_balances',
    'leave_requests', 'disciplinary_records', 'notifications',
    'audit_logs', 'ai_chat_sessions', 'notes'
  ]

  const requiredViews = [
    'active_employees', 'pending_leave_requests', 'employee_leave_summary',
    'unread_notifications', 'contracts_expiring_soon', 'employee_full_profile'
  ]

  const requiredEnums = [
    'leave_type_enum', 'leave_status_enum', 'disciplinary_type_enum',
    'notification_type_enum', 'audit_action_enum', 'audit_severity_enum',
    'employment_status_enum', 'user_role_enum', 'gender_enum',
    'sex_enum', 'payment_method_enum', 'chat_intent_enum'
  ]

  try {
    // Check tables
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', requiredTables)

    if (tablesError) {
      console.error('Error checking tables:', tablesError)
      return false
    }

    const foundTables = tables?.map(t => t.table_name) || []
    const missingTables = requiredTables.filter(t => !foundTables.includes(t))

    if (missingTables.length > 0) {
      console.error(`❌ Missing tables: ${missingTables.join(', ')}`)
      return false
    }

    console.log(`✅ All ${requiredTables.length} required tables found`)

    // Check views
    const { data: views, error: viewsError } = await supabase
      .from('information_schema.views')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', requiredViews)

    if (viewsError) {
      console.error('Error checking views:', viewsError)
      return false
    }

    const foundViews = views?.map(v => v.table_name) || []
    const missingViews = requiredViews.filter(v => !foundViews.includes(v))

    if (missingViews.length > 0) {
      console.error(`❌ Missing views: ${missingViews.join(', ')}`)
      return false
    }

    console.log(`✅ All ${requiredViews.length} required views found`)

    // Check ENUMs
    const { data: enums, error: enumsError } = await supabase
      .from('pg_type')
      .select('typname')
      .eq('typtype', 'e')
      .in('typname', requiredEnums)

    if (enumsError) {
      console.error('Error checking ENUMs:', enumsError)
      return false
    }

    const foundEnums = enums?.map(e => e.typname) || []
    const missingEnums = requiredEnums.filter(e => !foundEnums.includes(e))

    if (missingEnums.length > 0) {
      console.error(`❌ Missing ENUMs: ${missingEnums.join(', ')}`)
      return false
    }

    console.log(`✅ All ${requiredEnums.length} required ENUMs found`)

    return true
  } catch (error) {
    console.error('Error validating database schema:', error)
    return false
  }
}

// Seed data validation
export async function validateSeedData() {
  const { supabase } = await import('@/lib/supabase')
  
  console.log('🌱 Validating seed data...')
  
  try {
    // Check roles
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('role_name')
      .in('role_name', ['employee', 'junior_hr', 'hr_manager', 'admin', 'super_admin'])

    if (rolesError) {
      console.error('Error checking roles:', rolesError)
      return false
    }

    const foundRoles = roles?.map(r => r.role_name) || []
    const expectedRoles = ['employee', 'junior_hr', 'hr_manager', 'admin', 'super_admin']
    const missingRoles = expectedRoles.filter(r => !foundRoles.includes(r))

    if (missingRoles.length > 0) {
      console.error(`❌ Missing roles: ${missingRoles.join(', ')}`)
      return false
    }

    console.log(`✅ All ${expectedRoles.length} required roles found`)

    // Check job titles
    const { data: jobTitles, error: jobTitlesError } = await supabase
      .from('job_titles')
      .select('title')
      .limit(1)

    if (jobTitlesError) {
      console.error('Error checking job titles:', jobTitlesError)
      return false
    }

    if (!jobTitles || jobTitles.length === 0) {
      console.error('❌ No job titles found')
      return false
    }

    console.log(`✅ Job titles found`)

    return true
  } catch (error) {
    console.error('Error validating seed data:', error)
    return false
  }
}

// Main initialization function
export async function initializeSupabaseIntegration() {
  console.log('🚀 Starting Supabase integration initialization...')
  
  try {
    // Test connections
    const { database, storage } = await initializeSupabase()
    
    if (!database) {
      console.error('❌ Database connection failed')
      return false
    }
    
    if (!storage) {
      console.error('❌ Storage connection failed')
      return false
    }

    // Validate database schema
    const schemaValid = await validateDatabaseSchema()
    if (!schemaValid) {
      console.error('❌ Database schema validation failed')
      return false
    }

    // Validate seed data
    const seedDataValid = await validateSeedData()
    if (!seedDataValid) {
      console.error('❌ Seed data validation failed')
      return false
    }

    // Setup storage buckets
    await setupStorageBuckets()

    console.log('✅ Supabase integration initialization completed successfully!')
    return true
  } catch (error) {
    console.error('❌ Supabase integration initialization failed:', error)
    return false
  }
}

// Export for use in API routes or components
export default initializeSupabaseIntegration
