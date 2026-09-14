import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type UpdatePasswordBody = {
  accessToken?: string
  refreshToken?: string
  password?: string
}

function mapAuthError(error: { code?: string; message?: string }) {
  const code = error.code ?? ''
  const message = error.message ?? ''

  if (code === 'weak_password') return 'La contraseña es muy débil. Prueba con una más larga o combina letras y números.'
  if (code === 'same_password') return 'La contraseña nueva debe ser diferente a la anterior.'
  if (code === 'session_expired' || code === 'session_not_found' || code === 'bad_jwt' || code === 'refresh_token_already_used' || code === 'refresh_token_not_found') {
    return 'La sesión del enlace ya no está activa. Solicita un enlace nuevo o pide una clave temporal al colegio.'
  }
  if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('session')) {
    return 'La sesión del enlace ya no está activa. Solicita un enlace nuevo o pide una clave temporal al colegio.'
  }

  return 'No se pudo guardar la contraseña. Intenta de nuevo o pide ayuda al colegio.'
}

export async function POST(request: NextRequest) {
  let body: UpdatePasswordBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Solicitud inválida.' }, { status: 400 })
  }

  const accessToken = body.accessToken?.trim()
  const refreshToken = body.refreshToken?.trim()
  const password = body.password ?? ''

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ ok: false, message: 'Faltan los datos del enlace.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, message: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, message: 'Falta configuración de autenticación.' }, { status: 500 })
  }

  const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (sessionError || !sessionData.session) {
    console.error('[update-password-from-link] setSession', sessionError)
    return NextResponse.json({ ok: false, message: mapAuthError(sessionError ?? { code: 'session_not_found' }) }, { status: 401 })
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    console.error('[update-password-from-link] getUser', userError)
    return NextResponse.json({ ok: false, message: mapAuthError(userError ?? { code: 'session_not_found' }) }, { status: 401 })
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    console.error('[update-password-from-link] updateUser', {
      code: updateError.code,
      message: updateError.message,
      status: updateError.status,
    })
    return NextResponse.json({ ok: false, message: mapAuthError(updateError), code: updateError.code }, { status: 400 })
  }

  return NextResponse.json({ ok: true, email: userData.user.email })
}
