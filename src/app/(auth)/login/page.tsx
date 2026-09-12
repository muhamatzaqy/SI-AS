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

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const supabase = createClient()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({ 
    resolver: zodResolver(loginSchema) 
  })

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ 
      email: data.email, 
      password: data.password 
    })
    
    if (authError) { 
      setError('Email atau password salah.'); 
      return 
    }
    
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, is_completed')
        .eq('id', user.id)
        .single()
      
      const role = profileData?.role || 'mahasiswa'
      const isCompleted = profileData?.is_completed

      // LOGIKA REDIRECT: Lempar ke profil jika belum lengkap
      if (role === 'mahasiswa' && !isCompleted) {
        router.push('/mahasiswa/profil')
      } else {
        router.push(`/${role}`)
      }
    }
  }

  return (
    // Background utama menggunakan warna hijau khas SANGAR
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d5c36] p-4">
      {/* Islamic geometric pattern overlay (opsional jika kamu pakai) */}
      <div className="absolute inset-0 islamic-pattern opacity-20" />

      {/* Main card container */}
      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        
        {/* Bismillah & Header */}
        <div className="mb-8 text-center animate-fade-in">
          <p className="text-lg font-medium text-white/90 tracking-wider mb-5" style={{ fontFamily: 'serif' }}>
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </p>

          {/* Logo SANGAR */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-lg">
            <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight">SANGAR</h1>
          <p className="mt-1 text-sm text-white/80">Sistem Absensi Ngaji Asrama</p>
        </div>

        {/* Kotak Putih (Card) - Diperbaiki warna teksnya di sini! */}
        <div className="rounded-3xl bg-[#f8fafc] p-7 shadow-2xl animation-delay-200 animate-slide-up border border-slate-100">
          <div className="mb-6 text-center">
            {/* Teks dipaksa hitam/gelap agar terlihat di latar putih */}
            <h2 className="text-2xl font-bold text-slate-800">Selamat Datang</h2>
            <p className="mt-1 text-sm text-slate-500">Masuk dengan akun terdaftar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200 text-center">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@email.com"
                className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#0d5c36]"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#0d5c36] pr-10"
                  {...register('password')}
                />
                {/* Tombol Mata (Eye icon) */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              className="mt-4 h-12 w-full rounded-xl bg-[#0d5c36] text-white text-[15px] font-semibold shadow-md transition-all hover:bg-[#0a4a2b] hover:shadow-lg active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Masuk...</>
              ) : (
                'Masuk ke Sistem'
              )}
            </Button>

            <p className="text-center text-sm text-slate-500 pt-2">
              Belum punya akun?{' '}
              <Link href="/register" className="font-semibold text-[#0d5c36] hover:underline">
                Daftar sekarang
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-white/60">
          © 2026 SANGAR Ma&apos;had Aly &amp; LKIM
        </p>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
