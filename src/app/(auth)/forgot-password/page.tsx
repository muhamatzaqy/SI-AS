// app/forgot-password/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { forgotPasswordSchema, type ForgotPasswordData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const supabase = createClient()
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema)
  })

  const onSubmit = async (data: ForgotPasswordData) => {
    setStatus('idle')
    setErrorMessage('')
    
    // Kirim email reset password. 
    // redirectTo akan mengarahkan user kembali ke web kita setelah klik link di email
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } else {
      setStatus('success')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d5c36] p-4">
      <div className="absolute inset-0 islamic-pattern opacity-20" />

      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        <div className="mb-8 text-center animate-fade-in">
          <h1 className="text-3xl font-bold text-white tracking-tight">SANGAR</h1>
        </div>

        <div className="rounded-3xl bg-[#f8fafc] p-7 shadow-2xl border border-slate-100">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-slate-800">Lupa Password</h2>
            <p className="mt-1 text-sm text-slate-500">Masukkan email akun Anda</p>
          </div>

          {status === 'success' ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
                <MailCheck className="h-8 w-8" />
              </div>
              <p className="text-sm text-slate-600">
                Link reset password telah dikirim ke email Anda. Silakan cek inbox atau folder spam.
              </p>
              <Link href="/login" className="mt-4 block w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                Kembali ke Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {status === 'error' && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-200 text-center">
                  {errorMessage || 'Terjadi kesalahan. Silakan coba lagi.'}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email Terdaftar</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#0d5c36]"
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <Button
                type="submit"
                className="mt-4 h-12 w-full rounded-xl bg-[#0d5c36] text-white text-[15px] font-semibold transition-all hover:bg-[#0a4a2b]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Mengirim...</>
                ) : (
                  'Kirim Link Reset'
                )}
              </Button>

              <div className="text-center mt-4">
                <Link href="/login" className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-slate-700">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
