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
import { 
  Plus, Pencil, Trash2, Loader2, AlertCircle, FolderOpen, 
  CalendarDays, Users, Search, CheckCircle2, Lock, 
  ChevronLeft, ChevronRight, ChevronDown 
} from 'lucide-react'
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
}).refine(data => data.jam_selesai > data.jam_mulai, {
  message: "Jam selesai harus lebih besar dari jam mulai",
  path: ["jam_selesai"]
})

type SesiFormData = z.infer<typeof sesiFormSchema>

const masterFormSchema = z.object({
  jenis_id: z.string().min(1, "Jenis kegiatan wajib dipilih"),
  nama_kegiatan: z.string().min(1, "Nama kegiatan wajib diisi"),
})
type MasterFormData = z.infer<typeof masterFormSchema>

// --- TYPE UNTUK GROUPING (Memperbaiki error TypeScript) ---
type GroupedData = {
  id: string;
  nama: string;
  jenis: string;
  sesiList: any[];
}

export default function JadwalDanMasterPage() {
  const supabase = createClient()
  const { toast } = useToast()

  const [jadwals, setJadwals] = useState<any[]>([])
  const [masterJenis, setMasterJenis] = useState<any[]>([])
  const [masterKegiatan, setMasterKegiatan] = useState<any[]>([])
  const [mahasiswaList, setMahasiswaList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [dialogSesiOpen, setDialogSesiOpen] = useState(false)
  const [editingSesi, setEditingSesi] = useState<any | null>(null)
  const [submittingSesi, setSubmittingSesi] = useState(false)
  const [searchMahasiswa, setSearchMahasiswa] = useState('') 

  const [dialogMasterOpen, setDialogMasterOpen] = useState(false)
  const [editingMaster, setEditingMaster] = useState<any | null>(null)
  const [submittingMaster, setSubmittingMaster] = useState(false)

  const [markAlpaDialogOpen, setMarkAlpaDialogOpen] = useState(false)
  const [selectedJadwalForAlpha, setSelectedJadwalForAlpha] = useState<any | null>(null)
  const [markAlpaLoading, setMarkAlpaLoading] = useState(false)
  const [checkingAlphaId, setCheckingAlphaId] = useState<string | null>(null)

  // --- STATE PAGINATION, SEARCH, & EXPAND (GROUPING) ---
  const ITEMS_PER_PAGE = 10
  
  // State Sesi
  const [searchSesi, setSearchSesi] = useState('')
  const [pageSesi, setPageSesi] = useState(1)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]) // Menyimpan ID kegiatan yang sedang dibuka
  
  // State Master
  const [searchMaster, setSearchMaster] = useState('')
  const [pageMaster, setPageMaster] = useState(1)

  const formSesi = useForm<SesiFormData>({ 
    resolver: zodResolver(sesiFormSchema), 
    defaultValues: { tipe_target: 'semua', target_custom_ids: [] }
  })
  
  const watchedJenisId = formSesi.watch('jenis_id')
  const watchedTipeTarget = formSesi.watch('tipe_target')
  const watchedUnit = formSesi.watch('target_unit')

  const formMaster = useForm<MasterFormData>({ 
    resolver: zodResolver(masterFormSchema)
  })

  const fetchMasterData = async () => {
    const [resJenis, resKegiatan, resMahasiswa] = await Promise.all([
      supabase.from('jenis_kegiatan').select('*').order('nama_jenis'),
      supabase.from('nama_kegiatan').select('*, jenis_kegiatan(nama_jenis)').order('nama_kegiatan'),
      supabase.from('profiles').select('id, nama, nim, unit, semester').eq('role', 'mahasiswa').neq('is_active', false).order('nama')
    ])
    setMasterJenis(resJenis.data ?? [])
    setMasterKegiatan(resKegiatan.data ?? [])
    setMahasiswaList(resMahasiswa.data ?? [])
  }

  const fetchJadwals = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sesi')
      .select('*, nama_kegiatan(id, nama_kegiatan, jenis_id, jenis_kegiatan(id, nama_jenis)), presensi(mahasiswa_id)')
      .order('tanggal', { ascending: false })
    
    setJadwals(data ?? [])
    setLoading(false)
  }

  useEffect(() => { 
    fetchMasterData()
    fetchJadwals() 
  }, [])

  // Reset page ke 1 setiap kali search bar diketik
  useEffect(() => { setPageSesi(1) }, [searchSesi])
  useEffect(() => { setPageMaster(1) }, [searchMaster])

  const isJadwalFinished = (jadwal: any): boolean => {
    try {
      const now = new Date()
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      
      if (jadwal.tanggal > todayStr) return false 
      if (jadwal.tanggal < todayStr) return true  
      
      const currentTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false })
      return currentTimeStr >= jadwal.jam_selesai
    } catch { 
      return false 
    }
  }

  // --- LOGIC GROUPING SESI BERDASARKAN NAMA KEGIATAN ---
  // 1. Filter dulu jadwalnya
  const filteredJadwals = jadwals.filter(j => {
    if (!searchSesi) return true
    const s = searchSesi.toLowerCase()
    return (
      j.nama_kegiatan?.nama_kegiatan?.toLowerCase().includes(s) ||
      j.nama_kegiatan?.jenis_kegiatan?.nama_jenis?.toLowerCase().includes(s)
    )
  })

  // 2. Lakukan Grouping berdasarkan nama_kegiatan_id (dengan Type Data spesifik agar TS tidak error)
  const groupedJadwals = filteredJadwals.reduce((acc, j) => {
    const actId = j.nama_kegiatan?.id || 'unknown'
    if (!acc[actId]) {
      acc[actId] = {
        id: actId,
        nama: j.nama_kegiatan?.nama_kegiatan || 'Tidak diketahui',
        jenis: j.nama_kegiatan?.jenis_kegiatan?.nama_jenis || '-',
        sesiList: []
      }
    }
    acc[actId].sesiList.push(j)
    return acc
  }, {} as Record<string, GroupedData>)

  // 3. Ubah object jadi array dan urutkan berdasarkan nama (Alphabetical)
  const groupedArray = Object.values(groupedJadwals).sort((a, b) => a.nama.localeCompare(b.nama))
  
  // 4. Pagination dilakukan pada level GRUP (bukan level sesi individu)
  const totalPagesSesi = Math.ceil(groupedArray.length / ITEMS_PER_PAGE)
  const currentGroupedSesi = groupedArray.slice((pageSesi - 1) * ITEMS_PER_PAGE, pageSesi * ITEMS_PER_PAGE)

  // Fungsi toggle buka/tutup grup
  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => 
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  // --- FILTER & PAGINATION LOGIC MASTER ---
  const filteredMaster = masterKegiatan.filter(m => {
    if (!searchMaster) return true
    const s = searchMaster.toLowerCase()
    return (
      m.nama_kegiatan?.toLowerCase().includes(s) ||
      m.jenis_kegiatan?.nama_jenis?.toLowerCase().includes(s)
    )
  })
  const totalPagesMaster = Math.ceil(filteredMaster.length / ITEMS_PER_PAGE)
  const currentDataMaster = filteredMaster.slice((pageMaster - 1) * ITEMS_PER_PAGE, pageMaster * ITEMS_PER_PAGE)


  const handleOpenMarkAlpha = async (jadwal: any) => {
    setCheckingAlphaId(jadwal.id)
    try {
      const { count, error } = await supabase
        .from('izin_sesi')
        .select('*', { count: 'exact', head: true })
        .eq('sesi_id', jadwal.id)
        .eq('status', 'pending')
        
      if (error) throw error

      if (count && count > 0) {
        toast({
          title: 'Aksi Tertahan ⚠️',
          description: `Masih ada ${count} pengajuan izin yang PENDING. Silakan setujui/tolak di menu Perizinan terlebih dahulu.`,
          variant: 'destructive'
        })
        return 
      }
      
      setSelectedJadwalForAlpha(jadwal)
      setMarkAlpaDialogOpen(true)
    } catch (err: any) {
      toast({ title: 'Error', description: 'Gagal mengecek status perizinan', variant: 'destructive' })
    } finally {
      setCheckingAlphaId(null)
    }
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
      
      if (data.alphaCreated === 0) {
        toast({ 
          title: 'Sudah Lengkap ✨', 
          description: data.message || 'Semua mahasiswa sudah memiliki status kehadiran (Hadir/Izin).',
        })
      } else {
        toast({ 
          title: 'Berhasil ✅', 
          description: `${data.alphaCreated} mahasiswa ditandai ALPHA.`, 
          variant: 'success' 
        })
      }

      setMarkAlpaDialogOpen(false)
      setSelectedJadwalForAlpha(null)
      fetchJadwals() 
      
    } catch (error: any) {
      toast({ title: 'Aksi Ditolak', description: error.message, variant: 'destructive' })
    } finally { 
      setMarkAlpaLoading(false) 
    }
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
        delete (payload as any).nama_kegiatan_id
        const { error } = await supabase.from('sesi').update(payload).eq('id', editingSesi.id)
        if (error) throw error
        toast({ title: 'Berhasil', description: 'Jadwal sesi diperbarui', variant: 'success' })
      } else {
        const { error } = await supabase.from('sesi').insert(payload)
        if (error) throw error
        toast({ title: 'Berhasil', description: 'Jadwal sesi tersimpan', variant: 'success' })
        // Otomatis expand grup baru yang baru ditambahkan
        setExpandedGroups(prev => prev.includes(payload.nama_kegiatan_id) ? prev : [...prev, payload.nama_kegiatan_id])
      }
      
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
      jenis_id: j.nama_kegiatan?.jenis_id || '',
      nama_kegiatan_id: j.nama_kegiatan_id || '', 
      tipe_target: j.tipe_target as any,
      target_unit: mappedUnit, 
      target_semester: mappedSemester,
      target_custom_ids: mappedCustomIds,
      tanggal: j.tanggal, 
      jam_mulai: j.jam_mulai ? j.jam_mulai.slice(0,5) : '', 
      jam_selesai: j.jam_selesai ? j.jam_selesai.slice(0,5) : '',
    })
    setDialogSesiOpen(true)
  }

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
      
      <Tabs defaultValue="sesi" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="sesi">Jadwal Sesi Aktif</TabsTrigger>
          <TabsTrigger value="master">Master Kegiatan</TabsTrigger>
        </TabsList>

        {/* TAB SESI */}
        <TabsContent value="sesi" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Daftar Sesi Kegiatan</h3>
              <p className="text-sm text-muted-foreground">Jadwal kegiatan yang sedang atau akan berlangsung dikelompokkan per kegiatan.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Cari kegiatan..." 
                  className="pl-9 bg-background h-9 text-sm"
                  value={searchSesi}
                  onChange={(e) => setSearchSesi(e.target.value)}
                />
              </div>
              <Button onClick={openCreateSesi} disabled={masterJenis.length === 0} className="w-full sm:w-auto h-9">
                <Plus className="mr-2 h-4 w-4" />Tambah Jadwal
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : currentGroupedSesi.length === 0 ? (
              <Card>
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                  <CalendarDays className="h-10 w-10 opacity-20 mb-3" />
                  <p>Tidak ada jadwal kegiatan yang ditemukan.</p>
                </div>
              </Card>
            ) : (
              currentGroupedSesi.map((group) => {
                const isExpanded = expandedGroups.includes(group.id)
                
                return (
                  <Card key={group.id} className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    {/* Header Grup (Accordion Trigger) */}
                    <div 
                      className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isExpanded ? 'bg-muted/30 border-b' : 'hover:bg-muted/30'}`}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${isExpanded ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          <FolderOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-base">{group.nama}</h4>
                            <Badge variant="secondary" className="font-normal text-[10px] px-1.5 h-5">{group.jenis}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{group.sesiList.length} sesi terjadwal dalam kegiatan ini</p>
                        </div>
                      </div>
                      <div className="shrink-0 ml-4 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </div>
                    </div>

                    {/* Isi Grup (List Jadwal) */}
                    {isExpanded && (
                      <div className="divide-y divide-border/50 bg-card">
                        {group.sesiList.map((j: any) => {
                          const finished = isJadwalFinished(j)
                          const audiensLabel = getAudiensLabel(j.tipe_target, j.target_audiens)

                          // Kalkulator kelengkapan
                          let targetMahasiswaIds: string[] = [];
                          if (j.tipe_target === 'semua') targetMahasiswaIds = mahasiswaList.map(m => m.id);
                          else if (j.tipe_target === 'unit') targetMahasiswaIds = mahasiswaList.filter(m => m.unit === j.target_audiens?.unit).map(m => m.id);
                          else if (j.tipe_target === 'unit_semester') targetMahasiswaIds = mahasiswaList.filter(m => m.unit === j.target_audiens?.unit && m.semester?.toString() === j.target_audiens?.semester?.toString()).map(m => m.id);
                          else if (j.tipe_target === 'custom') targetMahasiswaIds = j.target_audiens?.mahasiswa_ids || [];

                          const targetCount = targetMahasiswaIds.length;
                          const uniquePresensiIds = new Set((j.presensi || []).map((p: any) => p.mahasiswa_id));
                          const currentCount = uniquePresensiIds.size;
                          const isComplete = currentCount >= targetCount && targetCount > 0;
                          
                          return (
                            <div key={j.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 hover:bg-muted/20 transition-colors pl-6 md:pl-16">
                              <div className="space-y-1.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                    <CalendarDays className="h-4 w-4 text-primary/70" />
                                    {formatDate(j.tanggal)}
                                  </div>
                                  <span className="text-muted-foreground text-sm">•</span>
                                  <span className="text-sm">{j.jam_mulai.slice(0,5)} – {j.jam_selesai.slice(0,5)} WIB</span>
                                  {finished ? <Badge variant="destructive" className="text-[10px] ml-1">Selesai</Badge> : <Badge variant="outline" className="text-[10px] ml-1 bg-green-50 text-green-700 border-green-200">Berlangsung</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <Users className="h-3.5 w-3.5" /> Target Peserta: <span className="font-medium text-foreground/80">{audiensLabel}</span>
                                </p>
                              </div>
                              
                              <div className="flex gap-2 shrink-0 items-center">
                                {finished && (
                                  isComplete ? (
                                    <Badge variant="success" className="h-8 px-2.5 text-xs flex items-center gap-1.5 rounded-md font-medium border border-green-200 bg-green-50 text-green-700">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Presensi Lengkap ({currentCount}/{targetCount})
                                    </Badge>
                                  ) : (
                                    <Button 
                                      variant="outline"
                                      size="sm" 
                                      onClick={() => handleOpenMarkAlpha(j)}
                                      disabled={checkingAlphaId === j.id}
                                      className="h-8 text-xs border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
                                    >
                                      {checkingAlphaId === j.id ? (
                                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Mengecek...</>
                                      ) : (
                                        <><AlertCircle className="h-3.5 w-3.5 mr-1.5" /> Tandai Alpha ({currentCount}/{targetCount})</>
                                      )}
                                    </Button>
                                  )
                                )}
                                
                                <div className="h-6 w-px bg-border mx-1 hidden md:block"></div>

                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSesi(j)}><Pencil className="h-3.5 w-3.5 text-blue-600" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteSesi(j.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Card>
                )
              })
            )}

            {/* Paginasi Sesi Berdasarkan Group */}
            {totalPagesSesi > 1 && (
              <div className="flex items-center justify-between px-2 pt-2">
                <span className="text-xs text-muted-foreground">
                  Menampilkan {(pageSesi - 1) * ITEMS_PER_PAGE + 1} - {Math.min(pageSesi * ITEMS_PER_PAGE, groupedArray.length)} dari {groupedArray.length} kelompok kegiatan
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setPageSesi(p => Math.max(1, p - 1))}
                    disabled={pageSesi === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-medium px-2">Hal {pageSesi}</span>
                  <Button
                    variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => setPageSesi(p => Math.min(totalPagesSesi, p + 1))}
                    disabled={pageSesi === totalPagesSesi}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB MASTER (Tetap Seperti Sebelumnya, karena bentuknya tabel) */}
        <TabsContent value="master" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Katalog Master Kegiatan</h3>
              <p className="text-sm text-muted-foreground">Tambahkan nama acara atau rutinan asrama di sini.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Cari kegiatan..." 
                  className="pl-9 bg-background h-9 text-sm"
                  value={searchMaster}
                  onChange={(e) => setSearchMaster(e.target.value)}
                />
              </div>
              <Button onClick={openCreateMaster} variant="secondary" className="border w-full sm:w-auto h-9">
                <Plus className="mr-2 h-4 w-4" />Tambah Master Baru
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium w-16 text-center">No</th>
                      <th className="px-4 py-3 font-medium">Nama Kegiatan</th>
                      <th className="px-4 py-3 font-medium w-48">Kategori</th>
                      <th className="px-4 py-3 font-medium text-right w-28">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentDataMaster.length > 0 ? (
                      currentDataMaster.map((item: any, index: number) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-center text-muted-foreground">{(pageMaster - 1) * ITEMS_PER_PAGE + index + 1}</td>
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
                            <p>Tidak ada data master ditemukan.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Paginasi Master */}
              {totalPagesMaster > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                  <span className="text-xs text-muted-foreground">
                    Menampilkan {(pageMaster - 1) * ITEMS_PER_PAGE + 1} - {Math.min(pageMaster * ITEMS_PER_PAGE, filteredMaster.length)} dari {filteredMaster.length} data
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setPageMaster(p => Math.max(1, p - 1))}
                      disabled={pageMaster === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-medium px-2">Hal {pageMaster}</span>
                    <Button
                      variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setPageMaster(p => Math.min(totalPagesMaster, p + 1))}
                      disabled={pageMaster === totalPagesMaster}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG SESI */}
      <Dialog open={dialogSesiOpen} onOpenChange={setDialogSesiOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSesi ? 'Edit Waktu & Peserta Sesi' : 'Tambah Jadwal Sesi'}</DialogTitle>
            <DialogDescription>
              {editingSesi ? 'Anda hanya bisa mengubah waktu dan target peserta untuk jadwal yang sudah dibuat.' : 'Jadwalkan kajian atau kegiatan untuk mahasiswa.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={formSesi.handleSubmit(onSubmitSesi)} className="space-y-4">
            {formSesi.formState.errors.jam_selesai && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
                ⚠️ {formSesi.formState.errors.jam_selesai.message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  Jenis Kegiatan
                  {editingSesi && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Controller control={formSesi.control} name="jenis_id" render={({ field }) => (
                  <Select 
                    onValueChange={(val) => { field.onChange(val); formSesi.setValue('nama_kegiatan_id', '') }} 
                    value={field.value}
                    disabled={!!editingSesi}
                  >
                    <SelectTrigger className={`bg-background ${formSesi.formState.errors.jenis_id ? "border-red-500" : ""} disabled:opacity-70 disabled:bg-muted`}>
                      <SelectValue placeholder="Pilih jenis..." />
                    </SelectTrigger>
                    <SelectContent>{masterJenis.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.nama_jenis}</SelectItem>)}</SelectContent>
                  </Select>
                )}/>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  Nama Kegiatan
                  {editingSesi && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Controller control={formSesi.control} name="nama_kegiatan_id" render={({ field }) => (
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value} 
                    disabled={!!editingSesi || !watchedJenisId}
                  >
                    <SelectTrigger className={`bg-background ${formSesi.formState.errors.nama_kegiatan_id ? "border-red-500" : ""} disabled:opacity-70 disabled:bg-muted`}>
                      <SelectValue placeholder="Pilih kegiatan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredKegiatanForSesiDropdown.length === 0 ? (
                        <SelectItem value="empty" disabled>Belum ada data</SelectItem>
                      ) : filteredKegiatanForSesiDropdown.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.nama_kegiatan}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}/>
              </div>
            </div>

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
                            {[1,2,3,4,5,6,7,8].map(s => <SelectItem key={s} value={s.toString()}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}/>
                    </div>
                  )}
                </div>
              )}

              {watchedTipeTarget === 'custom' && (
                <div className="space-y-3 pt-2 border-t border-blue-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Pilih Mahasiswa</Label>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                      Terpilih: {formSesi.watch('target_custom_ids')?.length || 0}
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      placeholder="Cari nama atau NIM..." 
                      className="pl-9 bg-background h-9 text-sm"
                      value={searchMahasiswa}
                      onChange={(e) => setSearchMahasiswa(e.target.value)}
                    />
                  </div>

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
              {editingSesi ? 'Simpan Perubahan Waktu/Target' : 'Buat Sesi Baru'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG MASTER */}
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

      {/* DIALOG MARK ALPHA */}
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
