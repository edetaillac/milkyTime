import { NextRequest, NextResponse } from 'next/server'

interface User {
  id: string
  username: string
  password: string
  babyBirthDate: string
}

// Récupérer les utilisateurs depuis la variable d'environnement (côté serveur)
const getUsers = (): User[] => {
  try {
    const usersData = process.env.USERS_DATA
    if (!usersData) {
      console.error('❌ USERS_DATA environment variable not found')
      return []
    }
    
    return JSON.parse(usersData)
  } catch (error) {
    console.error('❌ Error parsing USERS_DATA:', error)
    return []
  }
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

    const users = getUsers()
    const user = users.find(u => u.username === username && u.password === password)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Retourner les données utilisateur sans le mot de passe
    const { password: _, ...userWithoutPassword } = user
    return NextResponse.json({ user: userWithoutPassword })

  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
