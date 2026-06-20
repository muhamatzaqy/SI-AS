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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Loader2, AlertCircle, FolderOpen, CalendarDays } from 'lucide-react'
import { formatDate, formatLabel } from '@/lib/utils'

// --- SKEMA VALIDASI ZOD ---
const sesiFormSchema = z.object({
  jenis_id: z.string().min(1, "Jenis kegiatan wajib dipilih"),
  nama_kegiatan_id: z.string().min(1, "Nama kegiatan wajib dipilih"),
  target_unit: z.string().min(1, "Target audiens wajib dipilih"),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  jam_mulai: z.string().min(1, "Jam mulai wajib diisi"),
  jam_selesai: z.string().min(1, "Jam selesai wajib diisi"),
})
type SesiFormData = z.infer<typeof sesiFormSchema>

const masterFormSchema = z.object({
  jenis_id: z.string().min(1, "Jenis kegiatan wajib dipilih"),
  nama_kegiatan: z.string().min(1, "Nama kegiatan wajib diisi"),
})
type MasterFormData = z.infer<typeof masterFormSchema>

export default function JadwalDanMasterPage() {
  const supabase = createClient()
  const { toast } = useToast()

  // --- STATE DATA ---
  const [jadwals, setJadwals] = useState<any[]>([])
  const [masterJenis, setMasterJenis] = useState<any[]>([])
  const [masterKegiatan, setMasterKegiatan] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // --- STATE MODAL SESI ---
  const [dialogSesiOpen, setDialogSesiOpen] = useState(false)
  const [editingSesi, setEditingSesi] = useState<any | null>(null)
  const [submittingSesi, setSubmittingSesi] = useState(false)

  // --- STATE MODAL MASTER ---
  const [dialogMasterOpen, setDialogMasterOpen] = useState(false)
  const [editingMaster, setEditingMaster] = useState<any | null>(null)
  const [submittingMaster, setSubmittingMaster] = useState(false)

  // --- STATE MARK ALPHA ---
  const [markAlpaDialogOpen, setMarkAlpaDialogOpen] = useState(false)
  const [selectedJadwalForAlpha, setSelectedJadwalForAlpha] = useState<any | null>(null)
  const [markAlpaLoading, setMarkAlpaLoading] = useState(false)

  // --- FORMS ---
  const formSesi = useForm<SesiFormData>({ 
    resolver: zodResolver(sesiFormSchema), defaultValues: { target_unit: 'semua' }
  })
  const selectedJenisIdForSesi = formSesi.watch('jenis_id')

  const formMaster = useForm<MasterFormData>({ 
    resolver: zodResolver(masterFormSchema)
  })

  // --- FETCHING DATA ---
  const fetchMasterData = async () => {
    const [resJenis, resKegiatan] = await Promise.all([
      supabase.from('jenis_kegiatan').select('*').order('nama_jenis'),
      supabase.from('nama_kegiatan').select('*, jenis_kegiatan(nama_jenis)').order('nama_kegiatan')
    ])
    setMasterJenis(resJenis.data ?? [])
    setMasterKegiatan(resKegiatan.data ?? [])
  }

  const fetchJadwals = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sesi')
      .select('*, nama_kegiatan(nama_kegiatan, jenis_kegiatan(nama_jenis))')
      .order('tanggal', { ascending: false })
    setJadwals(data ?? [])
    setLoading(false)
  }

  useEffect(() => { 
    fetchMasterData()
    fetchJadwals() 
  }, []) // eslint-disable-line

  // --- LOGIKA SESI (JADWAL) ---
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
    } catch { return false }
  }

  const handleMarkAlpha = async () => {
    if (!selectedJadwalForAlpha) return
    setMarkAlpaLoading(true)
    try {
      const response = await fetch('/api/attendance/mark-alpa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jadwal_id: selectedJadwalForAlpha.id })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Gagal menandai alpha')
      toast({ title: 'Berhasil ✅', description: `${data.alphaCreated} mahasiswa ditandai ALPHA`, variant: 'success' })
      setMarkAlpaDialogOpen(false)
      setSelectedJadwalForAlpha(null)
      fetchJadwals()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally { setMarkAlpaLoading(false) }
  }

  const onSubmitSesi = async (data: SesiFormData) => {
    setSubmittingSesi(true)
    try {
      const tipeTarget = data.target_unit === 'semua' ? 'semua' : 'unit'
      const targetAudiens = data.target_unit === 'semua' ? {} : { unit: data.target_unit }
      const payload = { ...data, tipe_target: tipeTarget, target_audiens: targetAudiens }
      delete (payload as any).target_unit // hapus target_unit dari payload karena tidak ada di db

      if (editingSesi) {
        const { error } = await supabase.from('sesi').update(payload).eq('id', editingSesi.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('sesi').insert(payload)
        if (error) throw error
      }
      toast({ title: 'Berhasil', description: 'Jadwal sesi tersimpan', variant: 'success' })
      setDialogSesiOpen(false)
      fetchJadwals()
    } catch (err: any) { 
      toast({ title: 'Error', description: err.message, variant: 'destructive' }) 
    } finally { setSubmittingSesi(false) }
  }

  const deleteSesi = async (id: string) => {
    if (!confirm('Yakin hapus jadwal sesi ini?')) return
    await supabase.from('sesi').delete().eq('id', id)
    fetchJadwals()
    toast({ title: 'Berhasil', description: 'Jadwal dihapus', variant: 'success' })
  }

  const openCreateSesi = () => {
    setEditingSesi(null)
    formSesi.reset({ target_unit: 'semua', jenis_id: '', nama_kegiatan_id: '', tanggal: '', jam_mulai: '', jam_selesai: '' })
    setDialogSesiOpen(true)
  }

  const openEditSesi = (j: any) => {
    setEditingSesi(j)
    const mappedTargetUnit = j.tipe_target === 'unit' && j.target_audiens?.unit ? j.target_audiens.unit : 'semua'
    formSesi.reset({ 
      jenis_id: j.nama_kegiatan?.jenis_kegiatan?.id || '',
      nama_kegiatan_id: j.nama_kegiatan_id, target_unit: mappedTargetUnit, 
      tanggal: j.tanggal, jam_mulai: j.jam_mulai.slice(0,5), jam_selesai: j.jam_selesai.slice(0,5),
    })
    setDialogSesiOpen(true)
  }

  // --- LOGIKA MASTER KEGIATAN ---
  const onSubmitMaster = async (data: MasterFormData) => {
    setSubmittingMaster(true)
    try {
      if (editingMaster) {
        const { error } = await supabase.from('nama_kegiatan').update(data).eq('id', editingMaster.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('nama_kegiatan').insert(data)
        if (error) throw error
      }
      toast({ title: 'Berhasil', description: 'Master kegiatan tersimpan', variant: 'success' })
      setDialogMasterOpen(false)
      fetchMasterData() // Refresh tabel master & dropdown
    } catch (err: any) { 
      toast({ title: 'Error', description: err.message, variant: 'destructive' }) 
    } finally { setSubmittingMaster(false) }
  }

  const deleteMaster = async (id: string) => {
    if (!confirm('Yakin hapus data master ini? PERHATIAN: Semua sesi yang menggunakan kegiatan ini juga akan ikut terhapus!')) return
    await supabase.from('nama_kegiatan').delete().eq('id', id)
    fetchMasterData()
    fetchJadwals() // Karena cascade delete
    toast({ title: 'Berhasil', description: 'Master kegiatan dihapus', variant: 'success' })
  }

  const openCreateMaster = () => {
    setEditingMaster(null)
    formMaster.reset({ jenis_id: '', nama_kegiatan: '' })
    setDialogMasterOpen(true)
  }

  const openEditMaster = (m: any) => {
    setEditingMaster(m)
    formMaster.reset({ jenis_id: m.jenis_id, nama_kegiatan: m.nama_kegiatan })
    setDialogMasterOpen(true)
  }

  const filteredKegiatanForSesiDropdown = masterKegiatan.filter(k => k.jenis_id === selectedJenisIdForSesi)

  return (
    <div className="space-y-6">
      <PageHeader title="Manajemen Jadwal & Kegiatan" description="Kelola jadwal pelaksanaan dan master data kegiatan asrama" />
      
      {/* --- SISTEM TABS --- */}
      <Tabs defaultValue="sesi" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="sesi">Jadwal Sesi Aktif</TabsTrigger>
          <TabsTrigger value="master">Master Kegiatan</TabsTrigger>
        </TabsList>

        {/* --- TAB 1: JADWAL SESI --- */}
        <TabsContent value="sesi" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Daftar Sesi Kegiatan</h3>
              <p className="text-sm text-muted-foreground">Jadwal kegiatan yang sedang atau akan berlangsung.</p>
            </div>
            <Button onClick={openCreateSesi} disabled={masterJenis.length === 0}>
              <Plus className="mr-2 h-4 w-4" />Tambah Jadwal
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : jadwals.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <CalendarDays className="h-10 w-10 opacity-20 mb-3" />
                  <p>Belum ada sesi kegiatan terjadwal.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {jadwals.map(j => {
                    const finished = isJadwalFinished(j)
                    const namaKegiatan = j.nama_kegiatan?.nama_kegiatan || 'Tidak diketahui'
                    const jenisKegiatan = j.nama_kegiatan?.jenis_kegiatan?.nama_jenis || '-'
                    const audiensLabel = j.tipe_target === 'semua' ? 'Gabungan' : (j.target_audiens?.unit ? formatLabel(j.target_audiens.unit) : j.tipe_target)
                    
                    return (
                      <div key={j.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{namaKegiatan}</p>
                            <Badge variant="secondary" className="font-normal">{jenisKegiatan}</Badge>
                            {finished ? <Badge variant="destructive" className="text-xs">Selesai</Badge> : <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Berlangsung</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(j.tanggal)} · {j.jam_mulai.slice(0,5)}–{j.jam_selesai.slice(0,5)} · Peserta: {audiensLabel}
                          </p>
                        </div>
                        
                        <div className="flex gap-1 shrink-0 ml-4">
                          {finished && (
                            <Button variant="outline" size="icon" title="Tandai Alpha" onClick={() => { setSelectedJadwalForAlpha(j); setMarkAlpaDialogOpen(true) }}>
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEditSesi(j)}><Pencil className="h-4 w-4 text-blue-600" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteSesi(j.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 2: MASTER KEGIATAN --- */}
        <TabsContent value="master" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Katalog Master Kegiatan</h3>
              <p className="text-sm text-muted-foreground">Tambahkan nama kitab atau rutinan asrama di sini.</p>
            </div>
            <Button onClick={openCreateMaster} variant="secondary" className="border">
              <Plus className="mr-2 h-4 w-4" />Tambah Master Baru
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium w-16 text-center">No</th>
                    <th className="px-4 py-3 font-medium">Nama Kegiatan / Kitab</th>
                    <th className="px-4 py-3 font-medium w-48">Kategori</th>
                    <th className="px-4 py-3 font-medium text-right w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {masterKegiatan.length > 0 ? (
                    masterKegiatan.map((item: any, index: number) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-center text-muted-foreground">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{item.nama_kegiatan}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border-amber-200">
                            {item.jenis_kegiatan?.nama_jenis || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEditMaster(item)} className="text-blue-600 hover:underline text-xs font-medium mr-3">Edit</button>
                          <button onClick={() => deleteMaster(item.id)} className="text-destructive hover:underline text-xs font-medium">Hapus</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center">
                          <FolderOpen className="h-10 w-10 opacity-20 mb-3" />
                          <p>Belum ada master data kegiatan.</p>
                          <p className="text-xs mt-1">Silakan tambah master baru terlebih dahulu.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- DIALOG MODAL SESI (JADWAL) --- */}
      <Dialog open={dialogSesiOpen} onOpenChange={setDialogSesiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSesi ? 'Edit Jadwal Sesi' : 'Tambah Jadwal Sesi'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={formSesi.handleSubmit(onSubmitSesi)} className="space-y-4">
            <div className="space-y-2">
              <Label>Jenis Kegiatan</Label>
              <Controller control={formSesi.control} name="jenis_id" render={({ field }) => (
                <Select onValueChange={(val) => { field.onChange(val); formSesi.setValue('nama_kegiatan_id', '') }} value={field.value}>
                  <SelectTrigger className={formSesi.formState.errors.jenis_id ? "border-red-500" : ""}><SelectValue placeholder="Pilih jenis..." /></SelectTrigger>
                  <SelectContent>{masterJenis.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.nama_jenis}</SelectItem>)}</SelectContent>
                </Select>
              )}/>
            </div>
            <div className="space-y-2">
              <Label>Nama Kegiatan</Label>
              <Controller control={formSesi.control} name="nama_kegiatan_id" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedJenisIdForSesi}>
                  <SelectTrigger className={formSesi.formState.errors.nama_kegiatan_id ? "border-red-500" : ""}><SelectValue placeholder="Pilih kegiatan..." /></SelectTrigger>
                  <SelectContent>
                    {filteredKegiatanForSesiDropdown.length === 0 ? (
                      <SelectItem value="empty" disabled>Belum ada kegiatan di jenis ini</SelectItem>
                    ) : filteredKegiatanForSesiDropdown.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.nama_kegiatan}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}/>
              <p className="text-xs text-muted-foreground mt-1">Tidak ada di pilihan? Tambahkan dulu di Tab Master Kegiatan.</p>
            </div>
            <div className="space-y-2">
              <Label>Target Audiens</Label>
              <Controller control={formSesi.control} name="target_unit" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className={formSesi.formState.errors.target_unit ? "border-red-500" : ""}><SelectValue placeholder="Pilih target..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Gabungan (Semua Unit)</SelectItem>
                    <SelectItem value="mahad_aly">Mahad Aly</SelectItem>
                    <SelectItem value="lkim">LKIM</SelectItem>
                  </SelectContent>
                </Select>
              )}/>
            </div>
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input {...formSesi.register('tanggal')} type="date" className={formSesi.formState.errors.tanggal ? "border-red-500" : ""} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input {...formSesi.register('jam_mulai')} type="time" className={formSesi.formState.errors.jam_mulai ? "border-red-500" : ""} />
              </div>
              <div className="space-y-2">
                <Label>Jam Selesai</Label>
                <Input {...formSesi.register('jam_selesai')} type="time" className={formSesi.formState.errors.jam_selesai ? "border-red-500" : ""} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submittingSesi}>
              {submittingSesi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingSesi ? 'Simpan Perubahan' : 'Buat Sesi Baru'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG MODAL MASTER KEGIATAN --- */}
      <Dialog open={dialogMasterOpen} onOpenChange={setDialogMasterOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMaster ? 'Edit Master Kegiatan' : 'Tambah Master Kegiatan'}</DialogTitle>
            <DialogDescription>Masukkan nama acara atau kitab kajian rutin baru.</DialogDescription>
          </DialogHeader>
          <form onSubmit={formMaster.handleSubmit(onSubmitMaster)} className="space-y-4">
            <div className="space-y-2">
              <Label>Jenis Kegiatan</Label>
              <Controller control={formMaster.control} name="jenis_id" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className={formMaster.formState.errors.jenis_id ? "border-red-500" : ""}><SelectValue placeholder="Pilih jenis..." /></SelectTrigger>
                  <SelectContent>{masterJenis.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.nama_jenis}</SelectItem>)}</SelectContent>
                </Select>
              )}/>
            </div>
            <div className="space-y-2">
              <Label>Nama Kegiatan / Kitab</Label>
              <Input {...formMaster.register('nama_kegiatan')} placeholder="Misal: Kajian Fathul Mu'in" className={formMaster.formState.errors.nama_kegiatan ? "border-red-500" : ""} />
            </div>
            <Button type="submit" className="w-full" disabled={submittingMaster}>
              {submittingMaster ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingMaster ? 'Simpan Perubahan' : 'Tambah Master'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG MARK ALPHA --- */}
      {markAlpaDialogOpen && selectedJadwalForAlpha && (
        <Dialog open={markAlpaDialogOpen} onOpenChange={setMarkAlpaDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Tandai Kehadiran sebagai ALPHA?</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 space-y-1">
                <p className="text-sm font-medium text-orange-900">{selectedJadwalForAlpha.nama_kegiatan?.nama_kegiatan}</p>
                <p className="text-xs text-orange-700">{formatDate(selectedJadwalForAlpha.tanggal)} · {selectedJadwalForAlpha.jam_mulai.slice(0,5)}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setMarkAlpaDialogOpen(false)} disabled={markAlpaLoading}>Batal</Button>
                <Button className="flex-1" onClick={handleMarkAlpha} disabled={markAlpaLoading}>
                  {markAlpaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertCircle className="mr-2 h-4 w-4" />} Konfirmasi
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
export const dynamic = 'force-dynamic'
