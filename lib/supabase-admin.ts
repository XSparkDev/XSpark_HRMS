// ============================================================================
// SUPABASE ADMIN CLIENT - Server-side service role client (bypasses RLS)
// ============================================================================
// WARNING: This client should ONLY be used on the server side.
// It uses the service role key which must never be exposed to the client.
// ============================================================================

import { createClient } from '@supabase/supabase-js'

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined'

// Only access environment variables on the server
const supabaseUrl = isBrowser ? '' : (process.env.SUPABASE_URL || '')
const supabaseServiceRoleKey = isBrowser ? '' : (process.env.SUPABASE_SERVICE_ROLE_KEY || '')

// Create a stub for browser environments
const createBrowserStub = () => {
  const error = new Error('supabaseAdmin cannot be used in browser. Use API routes instead.')
  const stub = {
    from: () => {
      throw error
    },
    storage: {
      from: () => {
        throw error
      }
    },
    auth: {
      getUser: async () => {
        throw error
      },
      getSession: async () => {
        throw error
      }
    }
  }
  return stub as any
}

// Create the actual client only on the server
let supabaseAdmin: any

if (isBrowser) {
  // In browser, return a stub that throws helpful errors
  supabaseAdmin = createBrowserStub()
} else {
  // On server, validate and create the client
if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable')
}

if (!supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'xspark-hrms-admin'
    }
  }
})
}

export { supabaseAdmin }
export default supabaseAdmin

