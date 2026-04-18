'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { registerSchema, type RegisterFormData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { UNIT_OPTIONS } from '@/lib/constants'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterFormData) => {
    setError(null)
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: data.email, password: data.password })
    if (authError) { setError(authError.message); return }
    if (authData.user) {
      const { error: profileError } = await supabase.from('profiles').insert({ id: authData.user.id, nama: data.nama, nim: data.nim, unit: data.unit, angkatan: data.angkatan, role: 'mahasiswa' })
      if (profileError) { setError(profileError.message); return }
      router.push('/mahasiswa')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden islamic-gradient p-4 py-8">
      {/* Islamic geometric pattern overlay */}
      <div className="absolute inset-0 islamic-pattern opacity-30" />

      {/* Floating geometric ornaments */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float absolute -top-10 -right-10 h-40 w-40 rounded-full border border-white/10 opacity-20" />
        <div className="animate-float-reverse absolute top-1/3 -left-12 h-52 w-52 rounded-full border border-white/10 opacity-20" />
        <div className="animate-float-slow absolute bottom-10 -right-6 h-28 w-28 rotate-45 border border-white/10 opacity-20" />
        <div className="animate-spin-slow absolute bottom-1/4 left-1/4 h-16 w-16 opacity-10">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 5L61 35H95L68 54L79 84L50 65L21 84L32 54L5 35H39L50 5Z" fill="white" />
          </svg>
        </div>
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        {/* Header */}
        <div className="mb-5 text-center animate-fade-in">
          <p className="text-base font-medium text-white/80 tracking-wider mb-3" style={{ fontFamily: 'serif' }}>
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </p>

          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-xl">
            <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white">SI-ASRAMA</h1>
          <p className="mt-0.5 text-xs text-white/70">Sistem Informasi Asrama Ma&apos;had Aly &amp; LKIM</p>
        </div>

        {/* Glass card */}
        <div className="glass-card rounded-2xl p-5 animation-delay-200 animate-slide-up">
          <div className="mb-4 text-center">
            <h2 className="text-lg font-semibold text-foreground">Daftar Akun</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Buat akun baru sebagai mahasiswa asrama</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {error && (
              <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nama Lengkap</Label>
              <Input placeholder="Ahmad Fauzi" className="h-11 rounded-xl" {...register('nama')} />
              {errors.nama && <p className="text-xs text-destructive">{errors.nama.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">NIM</Label>
              <Input placeholder="2024001" className="h-11 rounded-xl" {...register('nim')} />
              {errors.nim && <p className="text-xs text-destructive">{errors.nim.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Email</Label>
              <Input type="email" placeholder="nama@email.com" className="h-11 rounded-xl" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Password</Label>
              <Input type="password" placeholder="••••••••" className="h-11 rounded-xl" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Unit</Label>
                <Select onValueChange={(v) => setValue('unit', v as 'mahad_aly' | 'lkim')}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                  <SelectContent>{UNIT_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Angkatan</Label>
                <Input type="number" placeholder="2024" className="h-11 rounded-xl" {...register('angkatan')} />
              </div>
            </div>

            <Button
              type="submit"
              className="mt-1 h-12 w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg transition-all hover:opacity-90 hover:shadow-xl active:scale-[0.98]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mendaftar...</>
              ) : (
                'Daftar'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground pt-1">
              Sudah punya akun?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Masuk
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-white/50">
          © 2024 SI-ASRAMA Ma&apos;had Aly &amp; LKIM
        </p>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
