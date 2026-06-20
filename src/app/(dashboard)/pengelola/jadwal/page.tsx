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
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { formatDate, formatLabel } from '@/lib/utils'

// 1. Definisikan Skema Validasi Form Lokal (Sesuai Database Baru)
const sesiFormSchema = z.object({
  jenis_id: z.string().min(1, "Jenis kegiatan wajib dipilih"),
  nama_kegiatan_id: z.string().min(1, "Nama kegiatan wajib dipilih"),
  target_unit: z.string().min(1, "Target audiens wajib dipilih"),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  jam_mulai: z.string().min(1, "Jam mulai wajib diisi"),
  jam_selesai: z.string().min(1, "Jam selesai wajib diisi"),
})
type SesiFormData = z.infer<typeof sesiFormSchema>

export default function JadwalPage() {
  const [jadwals, setJadwals] = useState<any[]>([])
  const [masterJenis, setMasterJenis] = useState<any[]>([])
  const [masterKegiatan, setMasterKegiatan] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingJadwal, setEditingJadwal] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
  // State untuk Dialog Mark Alpha
  const [markAlpaDialogOpen, setMarkAlpaDialogOpen] = useState(false)
  const [selectedJadwalForAlpha, setSelectedJadwalForAlpha] = useState<any | null>(null)
  const [markAlpaLoading, setMarkAlpaLoading] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()
  
  const { register, handleSubmit, setValue, reset, watch, control, formState: { errors } } = useForm<SesiFormData>({ 
    resolver: zodResolver(sesiFormSchema),
    defaultValues: { target_unit: 'semua' }
  })
  
  const selectedJenisId = watch('jenis_id')

  // 2. Fetch Data Master & Transaksi Sesi
  const fetchMasterData = async () => {
    const [resJenis, resKegiatan] = await Promise.all([
      supabase.from('jenis_kegiatan').select('*').order('nama_jenis'),
      supabase.from('nama_kegiatan').select('*').order('nama_kegiatan')
    ])
    setMasterJenis(resJenis.data ?? [])
    setMasterKegiatan(resKegiatan.data ?? [])
  }

  const fetchJadwals = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sesi')
      .select(`
        *,
        nama_kegiatan (
          id,
          nama_kegiatan,
          jenis_kegiatan (
            id,
            nama_jenis
          )
        )
      `)
      .order('tanggal', { ascending: false })
      
    setJadwals(data ?? [])
    setLoading(false)
  }

  useEffect(() => { 
    fetchMasterData()
    fetchJadwals() 
  }, []) // eslint-disable-line

  // 3. Logika Pengecekan Waktu
  const isJadwalFinished = (jadwal: any): boolean => {
    try {
      const now = new Date()
      const jadwalDate = new Date(jadwal.tanggal)
      if (jadwalDate > now) return false
      if (jadwalDate.toDateString() === now.toDateString()) {
        const [hour, min] = jadwal.jam_selesai.split(':').map(Number)
        const jamSelesaiDate = new Date(now)
        jamSelesaiDate.setHours(hour, min, 0, 0)
        return now > jamSelesaiDate
      }
      return true
    } catch (error) {
      console.error('Error checking jadwal finished:', error)
      return false
    }
  }

  // 4. Mark Alpha Handler
  const handleMarkAlpha = async () => {
    if (!selectedJadwalForAlpha) return
    setMarkAlpaLoading(true)
    try {
      const response = await fetch('/api/attendance/mark-alpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jadwal_id: selectedJadwalForAlpha.id }) // Pastikan backend API membaca ID sesi ini
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to mark alpha')

      toast({
        title: 'Success! ✅',
        description: `${data.alphaCreated} mahasiswa marked as ALPHA, ${data.skipped} skipped.`,
        variant: 'success'
      })
      setMarkAlpaDialogOpen(false)
      setSelectedJadwalForAlpha(null)
      fetchJadwals()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to mark alpha', variant: 'destructive' })
    } finally {
      setMarkAlpaLoading(false)
    }
  }

  // 5. Submit Handler (Mapping Form ke Database)
  const onSubmit = async (data: SesiFormData) => {
    setSubmitting(true)
    try {
      // Mapping dari target_unit form ke tipe_target & JSONB target_audiens
      let tipeTarget = 'unit'
      let targetAudiens = {}
      
      if (data.target_unit === 'semua') {
        tipeTarget = 'semua'
        targetAudiens = {}
      } else {
        tipeTarget = 'unit'
        targetAudiens = { unit: data.target_unit } // Menyimpan format JSONB
      }

      const payload = {
        nama_kegiatan_id: data.nama_kegiatan_id,
        tanggal: data.tanggal,
        jam_mulai: data.jam_mulai,
        jam_selesai: data.jam_selesai,
        tipe_target: tipeTarget,
        target_audiens: targetAudiens,
      }

      if (editingJadwal) {
        const { error } = await supabase.from('sesi').update(payload).eq('id', editingJadwal.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('sesi').insert(payload)
        if (error) throw error
      }

      toast({ title: 'Berhasil', description: 'Jadwal sesi tersimpan', variant: 'success' })
      setDialogOpen(false)
      fetchJadwals()
    } catch (err: any) { 
      toast({ title: 'Error', description: err.message || 'Gagal menyimpan', variant: 'destructive' }) 
    } finally { 
      setSubmitting(false) 
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus jadwal sesi ini?')) return
    await supabase.from('sesi').delete().eq('id', id)
    fetchJadwals()
    toast({ title: 'Berhasil', description: 'Jadwal dihapus', variant: 'success' })
  }

  const openCreate = () => {
    setEditingJadwal(null)
    reset({ target_unit: 'semua', jenis_id: '', nama_kegiatan_id: '', tanggal: '', jam_mulai: '', jam_selesai: '' })
    setDialogOpen(true)
  }

  const openEdit = (j: any) => {
    setEditingJadwal(j)
    // Ekstrak data JSONB target_audiens untuk form
    let mappedTargetUnit = 'semua'
    if (j.tipe_target === 'unit' && j.target_audiens?.unit) {
      mappedTargetUnit = j.target_audiens.unit
    }

    reset({ 
      jenis_id: j.nama_kegiatan?.jenis_kegiatan?.id || '',
      nama_kegiatan_id: j.nama_kegiatan_id, 
      target_unit: mappedTargetUnit, 
      tanggal: j.tanggal, 
      jam_mulai: j.jam_mulai.slice(0,5), // Buang detik '00' jika ada
      jam_selesai: j.jam_selesai.slice(0,5),
    })
    setDialogOpen(true)
  }

  // Filter daftar kegiatan berdasarkan jenis yang dipilih
  const filteredKegiatan = masterKegiatan.filter(k => k.jenis_id === selectedJenisId)

  return (
    <div className="space-y-6">
      <PageHeader title="Jadwal Sesi Kegiatan" description="Kelola jadwal pelaksanaan kegiatan asrama">
        <Button onClick={openCreate} disabled={masterJenis.length === 0}>
          <Plus className="mr-2 h-4 w-4" />Tambah Jadwal
        </Button>
      </PageHeader>
      
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : jadwals.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Belum ada sesi kegiatan terjadwal.</p>
          ) : (
            <div className="divide-y">
              {jadwals.map(j => {
                const finished = isJadwalFinished(j)
                const namaKegiatan = j.nama_kegiatan?.nama_kegiatan || 'Tidak diketahui'
                const jenisKegiatan = j.nama_kegiatan?.jenis_kegiatan?.nama_jenis || '-'
                
                // Ekstrak label audiens dari JSONB
                const audiensLabel = j.tipe_target === 'semua' 
                  ? 'Gabungan' 
                  : (j.target_audiens?.unit ? formatLabel(j.target_audiens.unit) : j.tipe_target)
                
                return (
                  <div key={j.id} className="flex items-center justify-between p-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{namaKegiatan}</p>
                        <Badge variant="secondary">{jenisKegiatan}</Badge>
                        
                        {finished ? (
                          <Badge variant="destructive" className="text-xs">Selesai</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Berlangsung</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(j.tanggal)} · {j.jam_mulai.slice(0,5)}–{j.jam_selesai.slice(0,5)} · Peserta: {audiensLabel}
                      </p>
                    </div>
                    
                    <div className="flex gap-1 shrink-0">
                      {finished && (
                        <Button 
                          variant="outline" size="icon" title="Tandai Alpha"
                          onClick={() => { setSelectedJadwalForAlpha(j); setMarkAlpaDialogOpen(true) }}
                        >
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(j)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(j.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Mark Alpha */}
      {markAlpaDialogOpen && selectedJadwalForAlpha && (
        <Dialog open={markAlpaDialogOpen} onOpenChange={setMarkAlpaDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Tandai Kehadiran sebagai ALPHA?</DialogTitle>
              <DialogDescription>
                Tandai semua mahasiswa yang tidak memiliki rekam presensi pada sesi ini menjadi ALPHA.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 space-y-2">
                <p className="text-sm font-medium text-orange-900">
                  {selectedJadwalForAlpha.nama_kegiatan?.nama_kegiatan}
                </p>
                <p className="text-xs text-orange-700">
                  {formatDate(selectedJadwalForAlpha.tanggal)} · {selectedJadwalForAlpha.jam_mulai.slice(0,5)}–{selectedJadwalForAlpha.jam_selesai.slice(0,5)}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setMarkAlpaDialogOpen(false)} disabled={markAlpaLoading}>
                  Batal
                </Button>
                <Button className="flex-1" onClick={handleMarkAlpha} disabled={markAlpaLoading}>
                  {markAlpaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertCircle className="mr-2 h-4 w-4" />}
                  Konfirmasi
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog Create/Edit Jadwal Sesi */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJadwal ? 'Edit Jadwal Sesi' : 'Tambah Jadwal Sesi'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Jenis Kegiatan (Pilih untuk menampilkan daftar)</Label>
              <Controller
                control={control}
                name="jenis_id"
                render={({ field }) => (
                  <Select 
                    onValueChange={(val) => { 
                      field.onChange(val); 
                      setValue('nama_kegiatan_id', '') // Reset kegiatan jika jenis berubah
                    }} 
                    value={field.value}
                  >
                    <SelectTrigger className={errors.jenis_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Pilih jenis..." />
                    </SelectTrigger>
                    <SelectContent>
                      {masterJenis.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.nama_jenis}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Nama Kegiatan</Label>
              <Controller
                control={control}
                name="nama_kegiatan_id"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedJenisId}>
                    <SelectTrigger className={errors.nama_kegiatan_id ? "border-red-500" : ""}>
                      <SelectValue placeholder={selectedJenisId ? "Pilih kegiatan..." : "Pilih jenis terlebih dahulu"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredKegiatan.length === 0 ? (
                        <SelectItem value="empty" disabled>Belum ada data untuk jenis ini</SelectItem>
                      ) : (
                        filteredKegiatan.map(opt => (
                          <SelectItem key={opt.id} value={opt.id}>{opt.nama_kegiatan}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Target Audiens</Label>
              <Controller
                control={control}
                name="target_unit"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className={errors.target_unit ? "border-red-500" : ""}>
                      <SelectValue placeholder="Pilih target..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semua">Gabungan (Semua Unit)</SelectItem>
                      <SelectItem value="mahad_aly">Mahad Aly</SelectItem>
                      <SelectItem value="lkim">LKIM</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input {...register('tanggal')} type="date" className={errors.tanggal ? "border-red-500" : ""} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input {...register('jam_mulai')} type="time" className={errors.jam_mulai ? "border-red-500" : ""} />
              </div>
              <div className="space-y-2">
                <Label>Jam Selesai</Label>
                <Input {...register('jam_selesai')} type="time" className={errors.jam_selesai ? "border-red-500" : ""} />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingJadwal ? 'Simpan Perubahan' : 'Buat Sesi Baru'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const dynamic = 'force-dynamic'
