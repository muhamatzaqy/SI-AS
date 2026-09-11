import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Jika ada parameter 'next', arahkan ke sana (misal: /mahasiswa/profil)
  const next = searchParams.get('next') ?? '/mahasiswa/profil'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Jika gagal verifikasi, kembalikan ke halaman login dengan pesan error
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}
