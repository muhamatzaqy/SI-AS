'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { type JadwalKegiatan } from '@/types'
import { jadwalSchema, type JadwalFormData } from '@/lib/validations/jadwal'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { JENIS_KEGIATAN_OPTIONS, UNIT_OPTIONS } from '@/lib/constants'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { formatDate, formatLabel } from '@/lib/utils'

export default function KegiatanPage() {
  const [kegiatan, setKegiatan] = useState<JadwalKegiatan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKegiatan, setEditingKegiatan] = useState<JadwalKegiatan | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<JadwalFormData>({ resolver: zodResolver(jadwalSchema), defaultValues: { wajib_foto: false } })

  const fetchKegiatan = async () => {
    setLoading(true)
    const { data } = await supabase.from('jadwal_kegiatan').select('*').neq('jenis', 'ngaji').order('tanggal', { ascending: false })
    setKegiatan(data ?? [])
    setLoading(false)
  }
  useEffect(() => { fetchKegiatan() }, []) // eslint-disable-line

  const checkConflict = async (tanggal: string, jamMulai: string, jamSelesai: string, excludeId?: string) => {
    const { data: ngajiJadwal } = await supabase.from('jadwal_kegiatan').select('*').eq('jenis', 'ngaji').eq('tanggal', tanggal)
    return (ngajiJadwal ?? []).some((j: any) => {
      if (excludeId && j.id === excludeId) return false
      return !(jamSelesai <= j.jam_mulai || jamMulai >= j.jam_selesai)
    })
  }

  const onSubmit = async (data: JadwalFormData) => {
    setSubmitting(true)
    try {
      const hasConflict = await checkConflict(data.tanggal, data.jam_mulai, data.jam_selesai, editingKegiatan?.id)
      if (hasConflict) { toast({ title: 'Konflik Jadwal', description: 'Waktu bertabrakan dengan jadwal ngaji!', variant: 'destructive' }); setSubmitting(false); return }
      const payload = { ...data, batas_absen: data.batas_absen || null, updated_at: new Date().toISOString() }
      if (editingKegiatan) {
        await supabase.from('jadwal_kegiatan').update(payload).eq('id', editingKegiatan.id)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('jadwal_kegiatan').insert({ ...payload, created_by: user?.id })
      }
      toast({ title: 'Berhasil', description: 'Kegiatan tersimpan', variant: 'success' })
      setDialogOpen(false); fetchKegiatan()
    } catch { toast({ title: 'Error', description: 'Gagal menyimpan', variant: 'destructive' }) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus?')) return
    await supabase.from('jadwal_kegiatan').delete().eq('id', id)
    fetchKegiatan()
  }

  const openCreate = () => { setEditingKegiatan(null); reset({ wajib_foto: false }); setDialogOpen(true) }
  const openEdit = (k: JadwalKegiatan) => {
    setEditingKegiatan(k)
    reset({ nama_kegiatan: k.nama_kegiatan, jenis: k.jenis, target_unit: k.target_unit, tanggal: k.tanggal, jam_mulai: k.jam_mulai, jam_selesai: k.jam_selesai, batas_absen: k.batas_absen ?? '', wajib_foto: k.wajib_foto })
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Manajemen Kegiatan" description="Kelola kegiatan non-ngaji">
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Tambah Kegiatan</Button>
      </PageHeader>
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="space-y-3 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          : kegiatan.length === 0 ? <p className="p-6 text-center text-muted-foreground">Belum ada kegiatan.</p>
          : <div className="divide-y">{kegiatan.map(k => (
            <div key={k.id} className="flex items-center justify-between gap-2 p-3 sm:p-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap"><p className="font-medium text-sm">{k.nama_kegiatan}</p><Badge variant="secondary">{formatLabel(k.jenis)}</Badge></div>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{formatDate(k.tanggal)} · {k.jam_mulai}–{k.jam_selesai} · {formatLabel(k.target_unit)}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(k)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(k.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}</div>}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingKegiatan ? 'Edit Kegiatan' : 'Tambah Kegiatan'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2"><Label>Nama Kegiatan</Label><Input {...register('nama_kegiatan')} placeholder="Rapat Organisasi" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Jenis</Label>
                <Select onValueChange={v => setValue('jenis', v as JadwalFormData['jenis'])} defaultValue={editingKegiatan?.jenis}>
                  <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                  <SelectContent>{JENIS_KEGIATAN_OPTIONS.filter(o => o.value !== 'ngaji').map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Target Unit</Label>
                <Select onValueChange={v => setValue('target_unit', v as JadwalFormData['target_unit'])} defaultValue={editingKegiatan?.target_unit}>
                  <SelectTrigger><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                  <SelectContent><SelectItem value="gabungan">Gabungan</SelectItem>{UNIT_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Tanggal</Label><Input {...register('tanggal')} type="date" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Jam Mulai</Label><Input {...register('jam_mulai')} type="time" /></div>
              <div className="space-y-2"><Label>Jam Selesai</Label><Input {...register('jam_selesai')} type="time" /></div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{editingKegiatan ? 'Simpan' : 'Tambah'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
