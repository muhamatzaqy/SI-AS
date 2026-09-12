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
import { Loader2, Pencil, X } from 'lucide-react'
import { UNIT_OPTIONS } from '@/lib/constants'

const profileSchema = z.object({
  nama: z.string().min(3, "Nama minimal harus 3 karakter"),
  nim: z.string().min(5, "NIM minimal harus 5 karakter"),
  unit: z.enum(['mahad_aly', 'lkim'], { required_error: "Pilih unit asrama" }),
  angkatan: z.coerce.number().min(2000, "Tahun angkatan tidak valid"),
  semester: z.string().optional().or(z.literal('')), 
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function EditProfilPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  
  // State baru untuk mengatur mode Edit & menyimpan data asli untuk fitur Batal
  const [isEditing, setIsEditing] = useState(false)
  const [originalData, setOriginalData] = useState<ProfileFormData | null>(null)
  
  const supabase = createClient()
  const form = useForm<ProfileFormData>({ 
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
          const fetchedData = {
            nama: data.nama || '',
            nim: data.nim || '',
            unit: (data.unit === 'mahad_aly' || data.unit === 'lkim') ? data.unit : undefined,
            angkatan: data.angkatan || new Date().getFullYear(),
            semester: data.semester ? data.semester.toString() : ''
          }
          
          setIsCompleted(data.is_completed ?? false)
          form.reset(fetchedData)
          setOriginalData(fetchedData) // Simpan sebagai backup untuk fitur 'Batal'

          // Jika profil belum lengkap, paksa masuk ke mode Edit
          if (!data.is_completed) {
            setIsEditing(true)
          }
        }
      } catch (err: any) {
        console.error('Gagal mengambil data:', err.message)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [supabase, form, router])

  // Fungsi untuk membatalkan edit dan mengembalikan data seperti semula
  const handleCancel = () => {
    if (originalData) {
      form.reset(originalData)
    }
    setIsEditing(false)
  }

  const onSubmit = async (data: ProfileFormData) => {
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
        is_completed: true 
      }
      
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
      if (error) throw error

      toast.success('Profil berhasil disimpan!')
      setOriginalData(data) // Perbarui data backup
      
      if (!isCompleted) {
        // Jika ini adalah pengisian pertama (isCompleted false), delay 1.5 detik agar toast terbaca, baru redirect
        setIsCompleted(true)
        setTimeout(() => {
          router.push('/mahasiswa')
          router.refresh()
        }, 1500)
      } else {
        // Jika hanya update biasa, langsung kembalikan ke mode Lihat (View Mode)
        setIsEditing(false)
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
        title={!isCompleted ? "Lengkapi Profil Anda" : "Informasi Profil"} 
        description={!isCompleted ? "Silakan lengkapi data diri Anda sebelum masuk ke sistem." : "Kelola informasi data diri Anda"} 
      />
      <Card>
        {!isCompleted && (
           <CardHeader className="bg-yellow-50 rounded-t-xl border-b mb-4">
             <CardTitle className="text-yellow-800 text-lg">Perhatian</CardTitle>
             <CardDescription className="text-yellow-700">Anda wajib mengisi form ini dengan benar sebelum bisa melakukan absensi.</CardDescription>
           </CardHeader>
        )}
        
        {/* Tombol Edit muncul di header card jika profil sudah lengkap & sedang tidak di mode edit */}
        {isCompleted && !isEditing && (
          <div className="px-6 pt-6 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Data
            </Button>
          </div>
        )}

        <CardContent className={isCompleted && !isEditing ? "pt-2 pb-8" : "pt-6"}>
          
          {/* MODE VIEW (READ-ONLY) */}
          {!isEditing && originalData ? (
            <div className="space-y-5">
              <div className="grid grid-cols-3 border-b pb-3">
                <span className="text-sm font-medium text-muted-foreground">Nama Lengkap</span>
                <span className="col-span-2 font-medium">{originalData.nama}</span>
              </div>
              <div className="grid grid-cols-3 border-b pb-3">
                <span className="text-sm font-medium text-muted-foreground">NIM</span>
                <span className="col-span-2 font-medium">{originalData.nim}</span>
              </div>
              <div className="grid grid-cols-3 border-b pb-3">
                <span className="text-sm font-medium text-muted-foreground">Unit Asrama</span>
                <span className="col-span-2 font-medium">
                  {UNIT_OPTIONS.find(u => u.value === originalData.unit)?.label || originalData.unit}
                </span>
              </div>
              <div className="grid grid-cols-3 border-b pb-3">
                <span className="text-sm font-medium text-muted-foreground">Angkatan</span>
                <span className="col-span-2 font-medium">{originalData.angkatan}</span>
              </div>
              {originalData.unit === 'mahad_aly' && (
                <div className="grid grid-cols-3 border-b pb-3">
                  <span className="text-sm font-medium text-muted-foreground">Semester</span>
                  <span className="col-span-2 font-medium">{originalData.semester}</span>
                </div>
              )}
            </div>
          ) : (
            
            /* MODE EDIT (FORM) */
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input {...form.register('nama')} className={errors.nama ? "border-red-500" : ""} />
                {errors.nama && <p className="text-xs text-red-500">{errors.nama.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label>NIM / Nomor Induk</Label>
                <Input {...form.register('nim')} className={errors.nim ? "border-red-500" : ""} />
                {errors.nim && <p className="text-xs text-red-500">{errors.nim.message}</p>}
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
                  {errors.unit && <p className="text-xs text-red-500">{errors.unit.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Tahun Angkatan</Label>
                  <Input type="number" {...form.register('angkatan')} className={errors.angkatan ? "border-red-500" : ""} />
                  {errors.angkatan && <p className="text-xs text-red-500">{errors.angkatan.message}</p>}
                </div>
              </div>
              
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
              
              <div className="flex gap-3 !mt-8">
                {/* Tombol Batal hanya muncul jika profil sudah lengkap (isCompleted true) */}
                {isCompleted && (
                  <Button type="button" variant="outline" className="w-full" onClick={handleCancel} disabled={submitting}>
                    <X className="mr-2 h-4 w-4" /> Batal
                  </Button>
                )}
                
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Profil'}
                </Button>
              </div>
            </form>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
