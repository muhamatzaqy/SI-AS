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

// Skema validasi yang menyertakan semester
const profileSchema = z.object({
  nama: z.string().min(3, "Nama minimal 3 karakter"),
  nim: z.string().min(5, "NIM tidak valid"),
  angkatan: z.coerce.number().min(2000, "Tahun tidak valid"),
  semester: z.string().min(1, "Semester wajib dipilih"),
})

export default function EditProfilPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  const form = useForm({ 
    resolver: zodResolver(profileSchema),
    defaultValues: { nama: '', nim: '', angkatan: 2024, semester: '' }
  })

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('nama, nim, angkatan, semester')
          .eq('id', user.id)
          .single()
        
        if (data) {
          form.reset({
            ...data,
            semester: data.semester ? data.semester.toString() : ''
          })
        }
        setLoading(false)
      }
    }
    loadProfile()
  }, [supabase, form])

  const onSubmit = async (data: any) => {
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    // Konversi semester kembali ke integer sebelum kirim ke DB
    const payload = { ...data, semester: parseInt(data.semester) }
    
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user?.id)
    
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui' })
    }
    setSubmitting(false)
  }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <PageHeader title="Edit Profil" description="Perbarui informasi diri Anda" />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input {...form.register('nama')} />
            </div>
            <div className="space-y-2">
              <Label>NIM</Label>
              <Input {...form.register('nim')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Angkatan</Label>
                <Input type="number" {...form.register('angkatan')} />
              </div>
              <div className="space-y-2">
                <Label>Semester</Label>
                <Controller 
                  control={form.control} 
                  name="semester" 
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Pilih Semester" /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7,8].map(s => <SelectItem key={s} value={s.toString()}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <Button className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
