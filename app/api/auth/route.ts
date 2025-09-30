import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import { getSupabaseClient } from '@/src/lib/supabase/client'

type AppUserRow = {
  id: string
  username: string
  password_hash: string
  baby_birth_date: string | null
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('app_users')
      .select('id, username, password_hash, baby_birth_date')
      .eq('username', username)
      .maybeSingle()

    const user = data as AppUserRow | null

    if (error) {
      console.error('❌ Error fetching user from Supabase:', error)
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 500 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const userPayload = {
      id: user.id,
      username: user.username,
      babyBirthDate: user.baby_birth_date ?? '',
    }

    return NextResponse.json({ user: userPayload })

  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
