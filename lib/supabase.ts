// ============================================================================
// SUPABASE CONFIGURATION - Centralized Supabase client setup
// ============================================================================
// This file provides a centralized Supabase client configuration
// ============================================================================

import { createClient } from '@supabase/supabase-js'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'placeholder-bucket'

// Flag to indicate if Supabase is configured
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

// Create Supabase client
// Create Supabase client or a safe no-op shim when not configured
export const supabase: any = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      db: { schema: 'public' },
      global: { headers: { 'X-Client-Info': 'xspark-hrms' } }
    })
  : (() => {
      const createQueryStub = (defaultResult: any = { data: [], error: null, count: 0 }) => {
        const resolved = Promise.resolve(defaultResult)
        const builder: any = {
          select: () => builder,
          insert: () => builder,
          update: () => builder,
          delete: () => builder,
          order: () => builder,
          limit: () => builder,
          range: () => builder,
          eq: () => builder,
          neq: () => builder,
          in: () => builder,
          is: () => builder,
          gte: () => builder,
          lte: () => builder,
          gt: () => builder,
          lt: () => builder,
          like: () => builder,
          ilike: () => builder,
          single: async () => ({ data: null, error: null }),
          then: resolved.then.bind(resolved),
          catch: resolved.catch.bind(resolved),
          finally: resolved.finally?.bind(resolved),
        }
        return builder
      }

      return {
        from() {
          return createQueryStub()
      },
        channel() {
          // Return a no-op channel stub for real-time subscriptions
          return {
            on: () => ({
              subscribe: () => ({
                unsubscribe: () => {}
              })
            }),
            subscribe: () => ({
              unsubscribe: () => {}
            }),
            unsubscribe: () => {}
          }
        },
      storage: {
        from() {
          return {
            list: async () => ({ data: [], error: null })
          }
        }
      },
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null })
      }
    }
    })()

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
