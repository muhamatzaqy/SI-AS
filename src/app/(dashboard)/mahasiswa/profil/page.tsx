'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner' // Menggunakan Sonner langsung
import { Loader2 } from 'lucide-react'

// 1. Skema Zod diperbarui: Semester opsional dan boleh string kosong
const profileSchema = z.object({
  nama: z.string().min(3, "Nama minimal harus 3 karakter"),
  nim: z.string().min(5, "NIM minimal harus 5 karakter"),
  angkatan: z.coerce.number().min(2000, "Tahun angkatan tidak valid"),
  semester: z.string().optional().or(z.literal('')), 
})

export default function EditProfilPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // State khusus untuk menampung data yang tidak boleh diedit
  const [infoReadOnly, setInfoReadOnly] = useState({ unit: '', role: '' }) 
  
  const supabase = createClient()

  const form = useForm({ 
    resolver: zodResolver(profileSchema),
    defaultValues: { nama: '', nim: '', angkatan: new Date().getFullYear(), semester: '' }
  })

  const { errors } = form.formState

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 2. Tambahkan 'unit' dan 'role' dalam query fetch
        const { data, error } = await supabase
          .from('profiles')
          .select('nama, nim, angkatan, semester, unit, role')
          .eq('id', user.id)
          .single()
        
        if (error) throw error

        if (data) {
          // Simpan data read-only ke state terpisah
          setInfoReadOnly({ unit: data.unit, role: data.role }) 
          
          form.reset({
            nama: data.nama || '',
            nim: data.nim || '',
            angkatan: data.angkatan || new Date().getFullYear(),
            semester: data.semester ? data.semester.toString() : ''
          })
        }
      } catch (err: any) {
        console.error('Gagal mengambil data profil:', err.message)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [supabase, form])

  const onSubmit = async (data: any) => {
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Sesi habis, silakan login kembali.")
      
      // 3. Konversi semester ke null jika kosong, int jika ada
      const payload = { 
        nama: data.nama,
        nim: data.nim,
        angkatan: data.angkatan,
        semester: data.semester ? parseInt(data.semester) : null 
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
      
      if (error) throw error

      toast.success('Profil Anda berhasil diperbarui')
    } catch (err: any) {
      toast.error(`Gagal Menyimpan: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const onValidationError = (formErrors: any) => {
    const firstErrorField = Object.keys(formErrors)[0]
    const errorMessage = formErrors[firstErrorField]?.message || "Periksa kembali isian Anda."
    toast.error(`Gagal: ${firstErrorField.toUpperCase()} - ${errorMessage}`)
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <PageHeader title="Edit Profil" description="Perbarui informasi diri Anda" />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(onSubmit, onValidationError)} className="space-y-4">
            
            {/* --- BAGIAN INFORMASI READ-ONLY --- */}
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div className="space-y-2">
                <Label>Role Akses</Label>
                <Input 
                  value={infoReadOnly.role.toUpperCase()} 
                  disabled 
                  className="bg-muted text-muted-foreground font-semibold cursor-not-allowed" 
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Asrama</Label>
                <Input 
                  value={infoReadOnly.unit === 'mahad_aly' ? "Ma'had Aly" : infoReadOnly.unit === 'lkim' ? "LKIM" : infoReadOnly.unit} 
                  disabled 
                  className="bg-muted text-muted-foreground font-semibold cursor-not-allowed" 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Lengkap</Label>
              <Input id="nama" {...form.register('nama')} className={errors.nama ? "border-red-500" : ""} />
              {errors.nama && <p className="text-xs text-red-500">{errors.nama.message as string}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nim">NIM</Label>
              <Input id="nim" {...form.register('nim')} className={errors.nim ? "border-red-500" : ""} />
              {errors.nim && <p className="text-xs text-red-500">{errors.nim.message as string}</p>}
            </div>
            
            {/* --- BAGIAN DINAMIS: GRID BERUBAH TERGANTUNG UNIT --- */}
            <div className={`grid ${infoReadOnly.unit === 'mahad_aly' ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              <div className="space-y-2">
                <Label htmlFor="angkatan">Angkatan</Label>
                <Input id="angkatan" type="number" {...form.register('angkatan')} className={errors.angkatan ? "border-red-500" : ""} />
                {errors.angkatan && <p className="text-xs text-red-500">{errors.angkatan.message as string}</p>}
              </div>
              
              {/* KOLOM SEMESTER HANYA MUNCUL JIKA UNIT = MAHAD ALY */}
              {infoReadOnly.unit === 'mahad_aly' && (
                <div className="space-y-2">
                  <Label htmlFor="semester">Semester</Label>
                  <Controller 
                    control={form.control} 
                    name="semester" 
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="semester" className={errors.semester ? "border-red-500" : ""}>
                          <SelectValue placeholder="Pilih Semester" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6,7,8].map(s => (
                            <SelectItem key={s} value={s.toString()}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.semester && <p className="text-xs text-red-500">{errors.semester.message as string}</p>}
                </div>
              )}
            </div>
            
            <Button type="submit" className="w-full !mt-6" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
            </Button>
            
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
