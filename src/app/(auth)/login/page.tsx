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
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner' // Tambahkan sonner untuk notifikasi sukses

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false) // State untuk toggle password
  const supabase = createClient()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password })

    if (authError) { 
      setError('Email belum diverifikasi atau password salah.')
      return 
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Notifikasi sukses login sebelum redirect
      toast.success('Berhasil masuk! Menyiapkan dashboard...')

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, is_completed')
        .eq('id', user.id)
        .single()

      const role = profileData?.role || 'mahasiswa'
      const isCompleted = profileData?.is_completed

      if (role === 'mahasiswa' && !isCompleted) {
        router.push('/mahasiswa/profil')
      } else {
        router.push(`/${role}`)
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden islamic-gradient p-4">
      {/* Background Ornaments */}
      <div className="absolute inset-0 islamic-pattern opacity-30" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float absolute -top-12 -left-12 h-48 w-48 rounded-full border border-white/10 opacity-20" />
        <div className="animate-float-reverse absolute top-1/4 -right-16 h-64 w-64 rounded-full border border-white/10 opacity-20" />
        <div className="animate-float-slow absolute bottom-16 -left-8 h-32 w-32 rotate-45 border border-white/10 opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        {/* Header */}
        <div className="mb-6 text-center animate-fade-in">
          <p className="text-lg font-medium text-white/80 tracking-wider mb-4" style={{ fontFamily: 'serif' }}>
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </p>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-xl animate-pulse-glow">
            <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SANGAR</h1>
          <p className="mt-1 text-sm text-white/70">Sistem Absensi Ngaji Asrama</p>
        </div>

        {/* Form Card */}
        <div className="glass-card rounded-2xl p-6 animation-delay-200 animate-slide-up bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
          <div className="mb-5 text-center">
            <h2 className="text-xl font-semibold text-white">Selamat Datang</h2>
            <p className="mt-1 text-sm text-white/70">Masuk dengan akun terdaftar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-200 border border-red-500/30 flex items-center gap-2">
                <span className="shrink-0">⚠️</span> {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-white">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@email.com"
                className="h-12 rounded-xl bg-white/90 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-primary/50"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-red-300 font-medium">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-white">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 rounded-xl bg-white/90 text-black placeholder:text-gray-400 pr-10 focus:ring-2 focus:ring-primary/50"
                  {...register('password')}
                />
                {/* Tombol Toggle Password */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 transition-colors focus:outline-none"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-300 font-medium">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              className="mt-4 h-12 w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg transition-all hover:bg-primary/90 active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memproses...</>
              ) : (
                'Masuk ke Sistem'
              )}
            </Button>

            <p className="text-center text-sm text-white/70 pt-2">
              Belum punya akun?{' '}
              <Link href="/register" className="font-semibold text-white hover:underline underline-offset-4">
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
