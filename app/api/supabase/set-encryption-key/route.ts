import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Try to set the encryption key
    const { data, error } = await supabase.rpc('set_encryption_key', {
      key_value: 'test-encryption-key-12345'
    })

    if (error) {
      console.error('Error setting encryption key:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to set encryption key',
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Encryption key set successfully',
      data
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({
      success: false,
      error: 'Unexpected error occurred',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Test if we can read the current encryption key setting
    const { data, error } = await supabase.rpc('get_encryption_key')

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Cannot read encryption key',
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Encryption key status',
      hasKey: !!data,
      data
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Unexpected error occurred',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
