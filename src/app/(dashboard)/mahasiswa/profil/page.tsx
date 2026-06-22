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
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

// Skema validasi diselaraskan dengan tipe data tabel profiles
const profileSchema = z.object({
  nama: z.string().min(3, "Nama minimal harus 3 karakter"),
  nim: z.string().min(5, "NIM minimal harus 5 karakter"),
  angkatan: z.coerce.number().min(2000, "Tahun angkatan tidak valid"),
  semester: z.string().min(1, "Semester wajib dipilih"),
})

export default function EditProfilPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

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

        const { data, error } = await supabase
          .from('profiles')
          .select('nama, nim, angkatan, semester')
          .eq('id', user.id)
          .single()
        
        if (error) throw error

        if (data) {
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

  // SOS: Fungsi ini akan berjalan JIKA kiriman data lolos validasi Zod
  const onSubmit = async (data: any) => {
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Sesi habis, silakan login kembali.")
      
      const payload = { 
        nama: data.nama,
        nim: data.nim,
        angkatan: data.angkatan,
        semester: parseInt(data.semester) 
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
      
      if (error) throw error

      toast({ title: 'Berhasil ✅', description: 'Profil Anda berhasil diperbarui' })
    } catch (err: any) {
      toast({ title: 'Gagal Menyimpan', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // SOS: Fungsi ini otomatis berjalan JIKA tombol ditekan tapi ada validasi yang GAGAL
  const onValidationError = (formErrors: any) => {
    console.log("Kelemahan Validasi Form:", formErrors)
    
    // Memunculkan pesan error spesifik kolom mana yang bermasalah lewat Toast
    const firstErrorField = Object.keys(formErrors)[0]
    const errorMessage = formErrors[firstErrorField]?.message || "Periksa kembali isian Anda."
    
    toast({
      title: "Gagal Mengirim Form ❌",
      description: `${firstErrorField.toUpperCase()}: ${errorMessage}`,
      variant: "destructive"
    })
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <PageHeader title="Edit Profil" description="Perbarui informasi diri Anda" />
      <Card>
        <CardContent className="pt-6">
          {/* Daftarkan onSubmit dan onValidationError di sini */}
          <form onSubmit={form.handleSubmit(onSubmit, onValidationError)} className="space-y-4">
            
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input {...form.register('nama')} className={errors.nama ? "border-red-500" : ""} />
              {errors.nama && <p className="text-xs text-red-500">{errors.nama.message as string}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>NIM</Label>
              <Input {...form.register('nim')} className={errors.nim ? "border-red-500" : ""} />
              {errors.nim && <p className="text-xs text-red-500">{errors.nim.message as string}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Angkatan</Label>
                <Input type="number" {...form.register('angkatan')} className={errors.angkatan ? "border-red-500" : ""} />
                {errors.angkatan && <p className="text-xs text-red-500">{errors.angkatan.message as string}</p>}
              </div>
              
              <div className="space-y-2">
                <Label>Semester</Label>
                <Controller 
                  control={form.control} 
                  name="semester" 
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className={errors.semester ? "border-red-500" : ""}>
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
            </div>
            
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
            </Button>
            
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
