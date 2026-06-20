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
import { Plus, Pencil, Trash2, Loader2, AlertCircle, FolderOpen, CalendarDays, Users, Search, CheckCircle2 } from 'lucide-react'
import { formatDate, formatLabel } from '@/lib/utils'

// --- SKEMA VALIDASI ZOD ---
const sesiFormSchema = z.object({
  jenis_id: z.string().min(1, "Jenis kegiatan wajib dipilih"),
  nama_kegiatan_id: z.string().min(1, "Nama kegiatan wajib dipilih"),
  tipe_target: z.enum(['semua', 'unit', 'unit_semester', 'custom']),
  target_unit: z.string().optional(),
  target_semester: z.string().optional(),
  target_custom_ids: z.array(z.string()).optional(),
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
  const [mahasiswaList, setMahasiswaList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // State baru untuk melacak sesi mana saja yang sudah di-Mark Alpha
  const [markedAlphaSesiIds, setMarkedAlphaSesiIds] = useState<string[]>([])

  // --- STATE MODAL SESI ---
  const [dialogSesiOpen, setDialogSesiOpen] = useState(false)
  const [editingSesi, setEditingSesi] = useState<any | null>(null)
  const [submittingSesi, setSubmittingSesi] = useState(false)
  const [searchMahasiswa, setSearchMahasiswa] = useState('') 

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
    resolver: zodResolver(sesiFormSchema), defaultValues: { tipe_target: 'semua', target_custom_ids: [] }
  })
  
  const watchedJenisId = formSesi.watch('jenis_id')
  const watchedTipeTarget = formSesi.watch('tipe_target')
  const watchedUnit = formSesi.watch('target_unit')

  const formMaster = useForm<MasterFormData>({ 
    resolver: zodResolver(masterFormSchema)
  })

  // --- FETCHING DATA ---
  const fetchMasterData = async () => {
    const [resJenis, resKegiatan, resMahasiswa] = await Promise.all([
      supabase.from('jenis_kegiatan').select('*').order('nama_jenis'),
      supabase.from('nama_kegiatan').select('*, jenis_kegiatan(nama_jenis)').order('nama_kegiatan'),
      supabase.from('profiles').select('id, nama, nim, unit').eq('role', 'mahasiswa').eq('is_active', true).order('nama')
    ])
    setMasterJenis(resJenis.data ?? [])
    setMasterKegiatan(resKegiatan.data ?? [])
    setMahasiswaList(resMahasiswa.data ?? [])
  }

  const fetchJadwals = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sesi')
      .select('*, nama_kegiatan(nama_kegiatan, jenis_kegiatan(nama_jenis))')
      .order('tanggal', { ascending: false })
    
    setJadwals(data ?? [])
    
    // --- Lacak Sesi yang sudah di-Alpha ---
    if (data && data.length > 0) {
      const sesiIds = data.map(d => d.id)
      const { data: presensiAlpha } = await supabase
        .from('presensi')
        .select('sesi_id')
        .eq('status', 'alpha')
        .in('sesi_id', sesiIds)
      
      if (presensiAlpha) {
        // Ambil ID unik sesi yang memiliki setidaknya 1 status alpha
        const uniqueIds = Array.from(new Set(presensiAlpha.map(p => p.sesi_id)))
        setMarkedAlphaSesiIds(uniqueIds)
      }
    }
    
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
      fetchJadwals() // Memuat ulang data agar state markedAlphaSesiIds ter-update
    } catch (error: any) {
      toast({ title: 'Aksi Ditolak', description: error.message, variant: 'destructive' })
    } finally { setMarkAlpaLoading(false) }
  }

  const onSubmitSesi = async (data: SesiFormData) => {
    setSubmittingSesi(true)
    try {
      let targetAudiens = {}
      
      if (data.tipe_target === 'unit') {
        if (!data.target_unit) throw new Error("Unit wajib dipilih")
        targetAudiens = { unit: data.target_unit }
      } 
      else if (data.tipe_target === 'unit_semester') {
        if (!data.target_unit || !data.target_semester) throw new Error("Unit dan Semester wajib dipilih")
        targetAudiens = { unit: data.target_unit, semester: parseInt(data.target_semester) }
      } 
      else if (data.tipe_target === 'custom') {
        if (!data.target_custom_ids || data.target_custom_ids.length === 0) throw new Error("Pilih minimal 1 mahasiswa untuk target custom")
        targetAudiens = { mahasiswa_ids: data.target_custom_ids }
      }

      const payload = { 
        nama_kegiatan_id: data.nama_kegiatan_id,
        tanggal: data.tanggal,
        jam_mulai: data.jam_mulai,
        jam_selesai: data.jam_selesai,
        tipe_target: data.tipe_target,
        target_audiens: targetAudiens
      }

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
    setSearchMahasiswa('') 
    formSesi.reset({ 
      tipe_target: 'semua', target_unit: '', target_semester: '', target_custom_ids: [], 
      jenis_id: '', nama_kegiatan_id: '', tanggal: '', jam_mulai: '', jam_selesai: '' 
    })
    setDialogSesiOpen(true)
  }

  const openEditSesi = (j: any) => {
    setEditingSesi(j)
    setSearchMahasiswa('') 
    
    let mappedUnit = ''
    let mappedSemester = ''
    let mappedCustomIds: string[] = []

    if (j.target_audiens) {
      if (j.target_audiens.unit) mappedUnit = j.target_audiens.unit
      if (j.target_audiens.semester) mappedSemester = j.target_audiens.semester.toString()
      if (j.target_audiens.mahasiswa_ids) mappedCustomIds = j.target_audiens.mahasiswa_ids
    }

    formSesi.reset({ 
      jenis_id: j.nama_kegiatan?.jenis_kegiatan?.id || '',
      nama_kegiatan_id: j.nama_kegiatan_id, 
      tipe_target: j.tipe_target as any,
      target_unit: mappedUnit, 
      target_semester: mappedSemester,
      target_custom_ids: mappedCustomIds,
      tanggal: j.tanggal, 
      jam_mulai: j.jam_mulai.slice(0,5), 
      jam_selesai: j.jam_selesai.slice(0,5),
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
      fetchMasterData() 
    } catch (err: any) { 
      toast({ title: 'Error', description: err.message, variant: 'destructive' }) 
    } finally { setSubmittingMaster(false) }
  }

  const deleteMaster = async (id: string) => {
    if (!confirm('Yakin hapus data master ini? PERHATIAN: Semua sesi yang menggunakan kegiatan ini juga akan ikut terhapus!')) return
    await supabase.from('nama_kegiatan').delete().eq('id', id)
    fetchMasterData()
    fetchJadwals() 
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

  const getAudiensLabel = (tipe: string, audiens: any) => {
    if (tipe === 'semua') return 'Gabungan (Semua Unit)'
    if (tipe === 'unit') return `Unit: ${formatLabel(audiens?.unit)}`
    if (tipe === 'unit_semester') return `Unit: ${formatLabel(audiens?.unit)} (Smt ${audiens?.semester})`
    if (tipe === 'custom') return `Custom (${audiens?.mahasiswa_ids?.length || 0} orang)`
    return '-'
  }

  const filteredKegiatanForSesiDropdown = masterKegiatan.filter(k => k.jenis_id === watchedJenisId)

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
                    const isMarkedAlpha = markedAlphaSesiIds.includes(j.id)
                    const namaKegiatan = j.nama_kegiatan?.nama_kegiatan || 'Tidak diketahui'
                    const jenisKegiatan = j.nama_kegiatan?.jenis_kegiatan?.nama_jenis || '-'
                    const audiensLabel = getAudiensLabel(j.tipe_target, j.target_audiens)
                    
                    return (
                      <div key={j.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 hover:bg-muted/30 transition-colors">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground text-base">{namaKegiatan}</p>
                            <Badge variant="secondary" className="font-normal">{jenisKegiatan}</Badge>
                            {finished ? <Badge variant="destructive" className="text-xs">Selesai</Badge> : <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Berlangsung</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(j.tanggal)} · {j.jam_mulai.slice(0,5)}–{j.jam_selesai.slice(0,5)} WIB
                          </p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Peserta: </span><span className="font-medium text-foreground/80">{audiensLabel}</span>
                          </p>
                        </div>
                        
                        <div className="flex gap-2 shrink-0 items-center">
                          {/* --- TOMBOL MARK ALPHA --- */}
                          {finished && (
                            <Button 
                              variant={isMarkedAlpha ? "secondary" : "outline"}
                              size="sm" 
                              onClick={() => { setSelectedJadwalForAlpha(j); setMarkAlpaDialogOpen(true) }}
                              disabled={isMarkedAlpha}
                              className={isMarkedAlpha ? "bg-muted text-muted-foreground opacity-70" : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800"}
                            >
                              {isMarkedAlpha ? (
                                <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Sudah Ditandai</>
                              ) : (
                                <><AlertCircle className="h-4 w-4 mr-1.5" /> Tandai Alpha</>
                              )}
                            </Button>
                          )}
                          
                          <div className="h-8 w-px bg-border mx-1 hidden md:block"></div>

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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSesi ? 'Edit Jadwal Sesi' : 'Tambah Jadwal Sesi'}</DialogTitle>
            <DialogDescription>Jadwalkan kajian atau kegiatan untuk mahasiswa.</DialogDescription>
          </DialogHeader>

          <form onSubmit={formSesi.handleSubmit(onSubmitSesi)} className="space-y-4">
            
            {/* Pemilihan Kegiatan */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                <Label>Jenis Kegiatan</Label>
                <Controller control={formSesi.control} name="jenis_id" render={({ field }) => (
                  <Select onValueChange={(val) => { field.onChange(val); formSesi.setValue('nama_kegiatan_id', '') }} value={field.value}>
                    <SelectTrigger className={`bg-background ${formSesi.formState.errors.jenis_id ? "border-red-500" : ""}`}><SelectValue placeholder="Pilih jenis..." /></SelectTrigger>
                    <SelectContent>{masterJenis.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.nama_jenis}</SelectItem>)}</SelectContent>
                  </Select>
                )}/>
              </div>
              <div className="space-y-2">
                <Label>Nama Kegiatan</Label>
                <Controller control={formSesi.control} name="nama_kegiatan_id" render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={!watchedJenisId}>
                    <SelectTrigger className={`bg-background ${formSesi.formState.errors.nama_kegiatan_id ? "border-red-500" : ""}`}><SelectValue placeholder="Pilih kegiatan..." /></SelectTrigger>
                    <SelectContent>
                      {filteredKegiatanForSesiDropdown.length === 0 ? (
                        <SelectItem value="empty" disabled>Belum ada data</SelectItem>
                      ) : filteredKegiatanForSesiDropdown.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.nama_kegiatan}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}/>
              </div>
            </div>

            {/* Target Audiens Dinamis */}
            <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <div className="space-y-2">
                <Label className="text-blue-900 font-semibold flex items-center"><Users className="h-4 w-4 mr-2"/> Tipe Target Peserta</Label>
                <Controller control={formSesi.control} name="tipe_target" render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Pilih tipe target..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semua">Gabungan (Semua Unit)</SelectItem>
                      <SelectItem value="unit">Per Unit (Satu Unit Penuh)</SelectItem>
                      <SelectItem value="unit_semester">Unit & Spesifik Semester</SelectItem>
                      <SelectItem value="custom">Custom (Pilih Perorangan)</SelectItem>
                    </SelectContent>
                  </Select>
                )}/>
              </div>

              {/* Conditional Fields: Unit & Semester */}
              {(watchedTipeTarget === 'unit' || watchedTipeTarget === 'unit_semester') && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-2">
                    <Label className="text-xs">Pilih Unit</Label>
                    <Controller control={formSesi.control} name="target_unit" render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="bg-background"><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mahad_aly">Mahad Aly</SelectItem>
                          <SelectItem value="lkim">LKIM</SelectItem>
                        </SelectContent>
                      </Select>
                    )}/>
                  </div>
                  {watchedTipeTarget === 'unit_semester' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Pilih Semester</Label>
                      <Controller control={formSesi.control} name="target_semester" render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={watchedUnit === 'lkim'}>
                          <SelectTrigger className="bg-background"><SelectValue placeholder="Pilih semester" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Semester 1</SelectItem>
                            <SelectItem value="2">Semester 2</SelectItem>
                            <SelectItem value="3">Semester 3</SelectItem>
                            <SelectItem value="4">Semester 4</SelectItem>
                            <SelectItem value="5">Semester 5</SelectItem>
                            <SelectItem value="6">Semester 6</SelectItem>
                          </SelectContent>
                        </Select>
                      )}/>
                    </div>
                  )}
                </div>
              )}

              {/* Conditional Fields: Custom (Daftar Checkbox + Search) */}
              {watchedTipeTarget === 'custom' && (
                <div className="space-y-3 pt-2 border-t border-blue-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Pilih Mahasiswa</Label>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                      Terpilih: {formSesi.watch('target_custom_ids')?.length || 0}
                    </span>
                  </div>

                  {/* Input Search Mahasiswa */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      placeholder="Cari nama atau NIM..." 
                      className="pl-9 bg-background h-9 text-sm"
                      value={searchMahasiswa}
                      onChange={(e) => setSearchMahasiswa(e.target.value)}
                    />
                  </div>

                  {/* Daftar Checkbox yang bisa di-filter */}
                  <div className="max-h-48 overflow-y-auto border bg-background rounded-md p-2 space-y-1">
                    {mahasiswaList.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Tidak ada data mahasiswa aktif.</p>
                    ) : (
                      mahasiswaList.map(m => {
                        const isMatch = m.nama.toLowerCase().includes(searchMahasiswa.toLowerCase()) || 
                                        m.nim.toLowerCase().includes(searchMahasiswa.toLowerCase());
                        
                        return (
                          <label 
                            key={m.id} 
                            className={`flex items-center space-x-3 hover:bg-muted/50 p-2 rounded cursor-pointer transition-colors ${isMatch ? '' : 'hidden'}`}
                          >
                            <input 
                              type="checkbox" 
                              value={m.id} 
                              {...formSesi.register('target_custom_ids')} 
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                            />
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm font-medium">{m.nama}</span>
                              <span className="text-xs text-muted-foreground">{m.nim} • {formatLabel(m.unit)}</span>
                            </div>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Waktu Pelaksanaan */}
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

            <Button type="submit" className="w-full mt-4" disabled={submittingSesi}>
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
            <DialogHeader>
              <DialogTitle className="flex items-center text-orange-700">
                <AlertCircle className="h-5 w-5 mr-2" />
                Konfirmasi Tandai Alpha
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Tindakan ini akan secara otomatis memberikan status <b>"Alpha"</b> kepada seluruh mahasiswa yang menjadi target audiens sesi ini, yang <b>belum melakukan absensi</b> atau <b>belum mengajukan izin</b>.
              </p>
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 space-y-1">
                <p className="text-sm font-semibold text-orange-900">{selectedJadwalForAlpha.nama_kegiatan?.nama_kegiatan}</p>
                <p className="text-xs text-orange-800">{formatDate(selectedJadwalForAlpha.tanggal)} · Jam {selectedJadwalForAlpha.jam_mulai.slice(0,5)} WIB</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setMarkAlpaDialogOpen(false)} disabled={markAlpaLoading}>Batal</Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white" onClick={handleMarkAlpha} disabled={markAlpaLoading}>
                  {markAlpaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Ya, Tandai Alpha
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
