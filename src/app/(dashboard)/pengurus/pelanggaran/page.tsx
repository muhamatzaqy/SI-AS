'use client'
import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { pelanggaranSchema, type PelanggaranFormData } from '@/lib/validations/pelanggaran'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Plus, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { IMAGE_COMPRESSION_OPTIONS } from '@/lib/constants'

export default function PelanggaranPage() {
  const [pelanggaran, setPelanggaran] = useState<any[]>([])
  const [mahasiswas, setMahasiswas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const { toast } = useToast()
  const supabase = createClient()
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<PelanggaranFormData>({ resolver: zodResolver(pelanggaranSchema), defaultValues: { poin: 10 } })

  const fetchData = async () => {
    setLoading(true)
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('pelanggaran').select('*, profiles(nama, nim)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nama, nim').eq('role', 'mahasiswa').eq('is_active', true),
    ])
    setPelanggaran(p ?? [])
    setMahasiswas(m ?? [])
    setLoading(false)
  }
  useEffect(() => { fetchData() }, []) // eslint-disable-line

  const onSubmit = async (data: PelanggaranFormData) => {
    setSubmitting(true)
    try {
      let fotoUrl: string | null = null
      if (fotoFile) {
        const imageCompression = (await import('browser-image-compression')).default
        const compressed = await imageCompression(fotoFile, IMAGE_COMPRESSION_OPTIONS)
        const { data: uploaded } = await supabase.storage.from('violation-photos').upload(`${Date.now()}.jpg`, compressed, { contentType: 'image/jpeg' })
        if (uploaded) fotoUrl = supabase.storage.from('violation-photos').getPublicUrl(uploaded.path).data.publicUrl
      }
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('pelanggaran').insert({ ...data, bukti_foto_url: fotoUrl, dicatat_oleh: user?.id })
      toast({ title: 'Berhasil', description: 'Pelanggaran dicatat', variant: 'success' })
      setDialogOpen(false); reset(); setFotoFile(null); fetchData()
    } catch { toast({ title: 'Error', description: 'Gagal menyimpan', variant: 'destructive' }) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pelanggaran" description="Catat pelanggaran mahasiswa">
        <Button onClick={() => { reset(); setDialogOpen(true) }}><Plus className="mr-2 h-4 w-4" />Catat Pelanggaran</Button>
      </PageHeader>
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="space-y-3 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          : pelanggaran.length === 0 ? <p className="p-6 text-center text-muted-foreground">Belum ada pelanggaran.</p>
          : <div className="divide-y">{pelanggaran.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
              <div className="space-y-1 min-w-0">
                <p className="font-medium text-sm">{p.profiles?.nama ?? '-'} — <span className="text-destructive">{p.nama_pelanggaran}</span></p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{p.profiles?.nim} · {p.poin} poin · {formatDate(p.created_at)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.sudah_dijalankan ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.sudah_dijalankan ? 'Selesai' : 'Belum'}</span>
            </div>
          ))}</div>}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Catat Pelanggaran</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2"><Label>Mahasiswa</Label>
              <Controller control={control} name="mahasiswa_id" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Pilih mahasiswa" /></SelectTrigger>
                  <SelectContent>{mahasiswas.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nama} — {m.nim}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-2"><Label>Nama Pelanggaran</Label><Input {...register('nama_pelanggaran')} placeholder="Tidak ikut ngaji" /></div>
            <div className="space-y-2"><Label>Poin Sanksi</Label><Input {...register('poin', { valueAsNumber: true })} type="number" min={1} max={100} /></div>
            <div className="space-y-2"><Label>Keterangan</Label><Textarea {...register('keterangan')} placeholder="Detail pelanggaran..." /></div>
            <div className="space-y-2"><Label>Sanksi</Label><Input {...register('sanksi')} placeholder="Bersih-bersih selama 3 hari" /></div>
            <div className="space-y-2"><Label>Bukti Foto (Opsional)</Label><Input type="file" accept="image/*" onChange={e => setFotoFile(e.target.files?.[0] ?? null)} /></div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
