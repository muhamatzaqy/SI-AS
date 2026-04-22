'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginFormData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    if (authError) { setError('Email atau password salah.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const role = (profileData as { role: string } | null)?.role
      router.push(role ? `/${role}` : '/mahasiswa')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden islamic-gradient p-4">
      {/* Islamic geometric pattern overlay */}
      <div className="absolute inset-0 islamic-pattern opacity-30" />

      {/* Floating geometric ornaments */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float absolute -top-12 -left-12 h-48 w-48 rounded-full border border-white/10 opacity-20" />
        <div className="animate-float-reverse absolute top-1/4 -right-16 h-64 w-64 rounded-full border border-white/10 opacity-20" />
        <div className="animate-float-slow absolute bottom-16 -left-8 h-32 w-32 rotate-45 border border-white/10 opacity-20" />
        <div className="animate-float absolute bottom-1/4 right-8 h-24 w-24 rotate-12 border border-white/10 opacity-20" />
        <div className="animate-spin-slow absolute top-8 right-1/4 h-20 w-20 opacity-10">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 5L61 35H95L68 54L79 84L50 65L21 84L32 54L5 35H39L50 5Z" fill="white" />
          </svg>
        </div>
        <div className="animate-float-reverse absolute bottom-8 left-1/4 h-16 w-16 opacity-10">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 0L58 28L83 10L68 34L97 40L72 55L83 82L57 68L50 96L43 68L17 82L28 55L3 40L32 34L17 10L42 28L50 0Z" fill="white" />
          </svg>
        </div>
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        {/* Bismillah header */}
        <div className="mb-6 text-center animate-fade-in">
          <p className="text-lg font-medium text-white/80 tracking-wider mb-4" style={{ fontFamily: 'serif' }}>
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </p>

          {/* Logo */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-xl animate-pulse-glow">
            <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight">SANGAR</h1>
          <p className="mt-1 text-sm text-white/70">Sistem Absensi Ngaji dan Sorogan Asrama Ma&apos;had Aly &amp; LKIM</p>
        </div>

        {/* Glass morphism card */}
        <div className="glass-card rounded-2xl p-6 animation-delay-200 animate-slide-up">
          <div className="mb-5 text-center">
            <h2 className="text-xl font-semibold text-foreground">Selamat Datang</h2>
            <p className="mt-1 text-sm text-muted-foreground">Masuk dengan akun yang telah terdaftar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@email.com"
                className="h-12 rounded-xl"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-12 rounded-xl"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              className="mt-2 h-12 w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg transition-all hover:opacity-90 hover:shadow-xl active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Masuk...</>
              ) : (
                'Masuk'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground pt-1">
              Belum punya akun?{' '}
              <Link href="/register" className="font-semibold text-primary hover:underline">
                Daftar sekarang
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/50">
          © 2026 SANGAR Ma&apos;had Aly &amp; LKIM
        </p>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
