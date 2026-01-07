// ============================================================================
// SUPABASE ADMIN CLIENT - Server-side service role client (bypasses RLS)
// ============================================================================

import { createClient } from '@supabase/supabase-js'
import { supabase as anonSupabase } from './supabase'

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabaseAdminClient =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'xspark-hrms-admin',
      },
    },
  })
    : (() => {
  console.warn(
          'SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to anon Supabase client; some admin-only operations may be limited.',
  )
        return anonSupabase
      })()

export const supabaseAdmin = supabaseAdminClient
export default supabaseAdminClient

