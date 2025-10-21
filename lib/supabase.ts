// ============================================================================
// SUPABASE CONFIGURATION - Centralized Supabase client setup
// ============================================================================
// This file provides a centralized Supabase client configuration
// ============================================================================

import { createClient } from '@supabase/supabase-js'

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET!

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable')
}
if (!supabaseAnonKey) {
  throw new Error('Missing SUPABASE_ANON_KEY environment variable')
}
if (!supabaseStorageBucket) {
  throw new Error('Missing SUPABASE_STORAGE_BUCKET environment variable')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'xspark-hrms'
    }
  }
})

// Storage configuration
export const storageConfig = {
  bucket: supabaseStorageBucket,
  // Define storage buckets for different file types
  buckets: {
    employeeDocuments: 'employee-documents',
    contracts: 'contracts',
    payslips: 'payslips',
    profilePictures: 'profile-pictures',
    supportingDocuments: 'supporting-documents'
  }
}

// Database connection test
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('Database connection test failed:', error)
      return false
    }
    
    console.log('✅ Database connection successful')
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}

// Storage connection test
export async function testStorageConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(storageConfig.bucket)
      .list('', { limit: 1 })
    
    if (error) {
      console.error('Storage connection test failed:', error)
      return false
    }
    
    console.log('✅ Storage connection successful')
    return true
  } catch (error) {
    console.error('Storage connection test failed:', error)
    return false
  }
}

// Initialize and test all connections
export async function initializeSupabase(): Promise<{
  database: boolean
  storage: boolean
}> {
  console.log('🚀 Initializing Supabase connections...')
  
  const [database, storage] = await Promise.all([
    testDatabaseConnection(),
    testStorageConnection()
  ])
  
  if (database && storage) {
    console.log('✅ All Supabase connections successful!')
  } else {
    console.error('❌ Some Supabase connections failed')
  }
  
  return { database, storage }
}

export default supabase
