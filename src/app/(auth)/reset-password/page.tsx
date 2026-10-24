// app/reset-password/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { resetPasswordSchema, type ResetPasswordData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const supabase = createClient()
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema)
  })

  const onSubmit = async (data: ResetPasswordData) => {
    setError(null)
    
    // Update password user yang sedang aktif (Supabase otomatis mendeteksi session dari URL token)
    const { error: updateError } = await supabase.auth.updateUser({
      password: data.password
    })

    if (updateError) {
      setError(updateError.message)
      return
    }

    // Jika sukses, arahkan ke login
    alert('Password berhasil diubah! Silakan login dengan password baru.')
    router.push('/login')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d5c36] p-4">
      <div className="absolute inset-0 islamic-pattern opacity-20" />

      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        <div className="rounded-3xl bg-[#f8fafc] p-7 shadow-2xl border border-slate-100">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-slate-800">Buat Password Baru</h2>
            <p className="mt-1 text-sm text-slate-500">Masukkan password baru Anda</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200 text-center">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password Baru</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">Konfirmasi Password Baru</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="h-12 rounded-xl border-slate-300 bg-white text-slate-900"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
            </div>

            <Button
              type="submit"
              className="mt-6 h-12 w-full rounded-xl bg-[#0d5c36] text-white text-[15px] font-semibold hover:bg-[#0a4a2b]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Menyimpan...</>
              ) : (
                'Simpan Password'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
