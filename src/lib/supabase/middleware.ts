import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi di .env.local!')
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isDashboardPage = pathname.startsWith('/pengelola') || pathname.startsWith('/pengurus') || pathname.startsWith('/mahasiswa')

  if (!user && isDashboardPage) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isAuthPage) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = profile?.role ? `/${profile.role}` : '/mahasiswa'
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isDashboardPage) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile) {
      const role = profile.role as string
      if ((pathname.startsWith('/pengelola') && role !== 'pengelola') ||
        (pathname.startsWith('/pengurus') && role !== 'pengurus') ||
        (pathname.startsWith('/mahasiswa') && role !== 'mahasiswa')) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = `/${role}`
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  return supabaseResponse
}