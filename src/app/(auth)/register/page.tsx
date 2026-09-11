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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Skema register disederhanakan
const registerSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
})
type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterFormData) => {
    setError(null)
    // Pendaftaran dengan email (Pastikan opsi Confirm Email nyala di Supabase)
    const { error: authError } = await supabase.auth.signUp({ 
      email: data.email, 
      password: data.password 
    })
    
    if (authError) { 
      setError(authError.message); 
      return 
    }
    
    toast.success("Pendaftaran berhasil! Silakan cek inbox/spam email Anda untuk verifikasi.")
    router.push('/login')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden islamic-gradient p-4 py-8">
      {/* ... (BIARKAN ORNAMEN ISLAMIC SAMA SEPERTI KODEMU SEBELUMNYA) ... */}
      <div className="absolute inset-0 islamic-pattern opacity-30" />
      
      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        {/* Header */}
        <div className="mb-5 text-center animate-fade-in">
          <p className="text-base font-medium text-white/80 tracking-wider mb-3" style={{ fontFamily: 'serif' }}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</p>
          <h1 className="text-2xl font-bold text-white mt-4">SI-ASRAMA</h1>
          <p className="mt-0.5 text-xs text-white/70">Daftar Akun Mahasiswa</p>
        </div>

        <div className="glass-card rounded-2xl p-5 animation-delay-200 animate-slide-up bg-white/10 backdrop-blur-md">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">{error}</div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-white">Email Aktif</Label>
              <Input type="email" placeholder="nama@email.com" className="h-11 rounded-xl" {...register('email')} />
              {errors.email && <p className="text-xs text-red-300">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-white">Password</Label>
              <Input type="password" placeholder="••••••••" className="h-11 rounded-xl" {...register('password')} />
              {errors.password && <p className="text-xs text-red-300">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="mt-2 h-12 w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg transition-all" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mendaftar...</> : 'Daftar & Verifikasi Email'}
            </Button>

            <p className="text-center text-sm text-white/70 pt-2">
              Sudah verifikasi akun? <Link href="/login" className="font-semibold text-white hover:underline">Masuk</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
