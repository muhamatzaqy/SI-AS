'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff, Info } from 'lucide-react'
import { toast } from 'sonner'

// Skema register
const registerSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
})
type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false) 
  
  const supabase = createClient()
  
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({ 
    resolver: zodResolver(registerSchema) 
  })

  // Pantau ketikan password secara real-time untuk mengubah warna indikator
  const passwordValue = watch('password', '')

  const onSubmit = async (data: RegisterFormData) => {
    setError(null)
    
    // Proses Pendaftaran ke Supabase
    const { error: authError } = await supabase.auth.signUp({ 
      email: data.email, 
      password: data.password 
    })
    
    if (authError) { 
      setError(authError.message)
      toast.error("Pendaftaran gagal: " + authError.message) 
      return 
    }
    
    // Toast interaktif jika berhasil
    toast.success("Pendaftaran berhasil!", {
      description: "Silakan cek inbox atau folder spam email Anda untuk link verifikasi.",
      duration: 6000,
    })
    
    router.push('/login')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d5c36] p-4 py-8">
      
      {/* Pattern & Ornaments */}
      <div className="absolute inset-0 islamic-pattern opacity-20" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float absolute -top-10 -right-10 h-40 w-40 rounded-full border border-white/10 opacity-20" />
        <div className="animate-float-reverse absolute top-1/3 -left-12 h-52 w-52 rounded-full border border-white/10 opacity-20" />
      </div>
      
      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        {/* Header */}
        <div className="mb-8 text-center animate-fade-in">
          <p className="text-lg font-medium text-white/90 tracking-wider mb-5" style={{ fontFamily: 'serif' }}>
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </p>

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

        {/* Kotak Form (Terang/Putih dengan teks gelap) */}
        <div className="rounded-3xl bg-[#f8fafc] p-7 shadow-2xl animation-delay-200 animate-slide-up border border-slate-100">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-slate-800">Daftar Akun</h2>
            <p className="mt-1 text-sm text-slate-500">Buat akun mahasiswa baru</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200 text-center">
                {error}
              </div>
            )}

            {/* Input Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email Aktif</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nama@email.com" 
                className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#0d5c36]" 
                {...register('email')} 
              />
              <div className="flex items-start gap-1.5 mt-1">
                <Info className="h-3.5 w-3.5 text-[#0d5c36] mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-500 leading-tight">
                  Wajib gunakan email aktif untuk menerima link verifikasi akun.
                </p>
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            {/* Input Password dengan Toggle Mata */}
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
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {/* Keterangan Interaktif Password */}
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`h-1.5 w-1.5 rounded-full transition-colors ${passwordValue?.length >= 6 ? 'bg-green-500' : 'bg-slate-300'}`} />
                <p className={`text-[11px] transition-colors ${passwordValue?.length >= 6 ? 'text-green-600 font-medium' : 'text-slate-500'}`}>
                  Minimal 6 karakter
                </p>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            <Button 
              type="submit" 
              className="mt-6 h-12 w-full rounded-xl bg-[#0d5c36] text-white text-[15px] font-semibold shadow-md transition-all hover:bg-[#0a4a2b] hover:shadow-lg active:scale-[0.98]" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Mendaftarkan...</>
              ) : (
                'Daftar & Kirim Verifikasi'
              )}
            </Button>

            <p className="text-center text-sm text-slate-500 pt-3">
              Sudah verifikasi akun?{' '}
              <Link href="/login" className="font-semibold text-[#0d5c36] hover:underline">
                Masuk di sini
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-white/60">
          © 2026 SANGAR Ma'had Aly & LKIM
        </p>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
