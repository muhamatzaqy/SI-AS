'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { UNIT_OPTIONS } from '@/lib/constants'

const profileSchema = z.object({
  nama: z.string().min(3, "Nama minimal harus 3 karakter"),
  nim: z.string().min(5, "NIM minimal harus 5 karakter"),
  unit: z.enum(['mahad_aly', 'lkim'], { required_error: "Pilih unit asrama" }),
  angkatan: z.coerce.number().min(2000, "Tahun angkatan tidak valid"),
  semester: z.string().optional().or(z.literal('')), 
})

export default function EditProfilPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  
  const supabase = createClient()
  const form = useForm({ 
    resolver: zodResolver(profileSchema),
    defaultValues: { nama: '', nim: '', angkatan: new Date().getFullYear(), semester: '', unit: undefined }
  })
  
  const { errors } = form.formState
  const currentUnit = form.watch('unit')

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('nama, nim, angkatan, semester, unit, role, is_completed')
          .eq('id', user.id)
          .single()
        
        if (error) throw error

        if (data) {
          setIsCompleted(data.is_completed)
          form.reset({
            nama: data.nama || '',
            nim: data.nim || '',
            unit: (data.unit as 'mahad_aly' | 'lkim') || undefined,
            angkatan: data.angkatan || new Date().getFullYear(),
            semester: data.semester ? data.semester.toString() : ''
          })
        }
      } catch (err: any) {
        console.error('Gagal mengambil data:', err.message)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [supabase, form, router])

  const onSubmit = async (data: z.infer<typeof profileSchema>) => {
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Sesi habis, silakan login kembali.")
      
      const payload = { 
        nama: data.nama,
        nim: data.nim,
        unit: data.unit,
        angkatan: data.angkatan,
        semester: data.semester ? parseInt(data.semester) : null,
        is_completed: true // Menandakan form profil sudah diisi
      }
      
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
      if (error) throw error

      toast.success('Profil berhasil disimpan!')
      
      // Jika profil baru saja dilengkapi, tendang langsung ke dashboard
      if (!isCompleted) {
          router.push('/mahasiswa')
      }
      
    } catch (err: any) {
      toast.error(`Gagal Menyimpan: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <PageHeader 
        title={!isCompleted ? "Lengkapi Profil Anda" : "Edit Profil"} 
        description={!isCompleted ? "Silakan lengkapi data diri Anda sebelum masuk ke sistem." : "Perbarui informasi diri Anda"} 
      />
      <Card>
        {!isCompleted && (
           <CardHeader className="bg-yellow-50 rounded-t-xl border-b mb-4">
             <CardTitle className="text-yellow-800 text-lg">Perhatian</CardTitle>
             <CardDescription className="text-yellow-700">Anda wajib mengisi form ini dengan benar sebelum bisa melakukan absensi.</CardDescription>
           </CardHeader>
        )}
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input {...form.register('nama')} className={errors.nama ? "border-red-500" : ""} />
              {errors.nama && <p className="text-xs text-red-500">{errors.nama.message as string}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>NIM / Nomor Induk</Label>
              <Input {...form.register('nim')} className={errors.nim ? "border-red-500" : ""} />
              {errors.nim && <p className="text-xs text-red-500">{errors.nim.message as string}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit Asrama</Label>
                <Controller 
                  control={form.control} 
                  name="unit" 
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <SelectTrigger className={errors.unit ? "border-red-500" : ""}>
                        <SelectValue placeholder="Pilih Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.unit && <p className="text-xs text-red-500">{errors.unit.message as string}</p>}
              </div>

              <div className="space-y-2">
                <Label>Tahun Angkatan</Label>
                <Input type="number" {...form.register('angkatan')} className={errors.angkatan ? "border-red-500" : ""} />
                {errors.angkatan && <p className="text-xs text-red-500">{errors.angkatan.message as string}</p>}
              </div>
            </div>
            
            {/* Hanya tampil jika milih Ma'had Aly */}
            {currentUnit === 'mahad_aly' && (
              <div className="space-y-2 w-1/2">
                <Label>Semester</Label>
                <Controller 
                  control={form.control} 
                  name="semester" 
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <SelectTrigger><SelectValue placeholder="Pilih Semester" /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7,8].map(s => <SelectItem key={s} value={s.toString()}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
            
            <Button type="submit" className="w-full !mt-6" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan & Lanjutkan'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
