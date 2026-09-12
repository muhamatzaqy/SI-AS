'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Plus, Loader2, CalendarDays, Home, Info, AlertCircle, Trash2, FileText } from 'lucide-react'
import { formatDate, formatLabel } from '@/lib/utils'

// --- PENGATURAN WHATSAPP PENGURUS ---
const PENGURUS_WA_NUMBER = '6285641659901' 

// --- SKEMA VALIDASI ZOD LOKAL ---
const izinSesiSchema = z.object({
  sesi_id: z.string().min(1, "Pilih jadwal sesi yang akan ditinggalkan"),
  alasan_izin: z.string().min(5, "Berikan alasan yang jelas (minimal 5 karakter)"),
})
type IzinSesiFormData = z.infer<typeof izinSesiSchema>

const izinPulangSchema = z.object({
  tgl_pulang: z.string().min(1, "Tanggal pulang wajib diisi"),
  tgl_kembali: z.string().min(1, "Tanggal kembali wajib diisi"),
  keterangan: z.string().min(5, "Berikan keterangan pulang yang jelas"),
}).refine(data => new Date(data.tgl_kembali) >= new Date(data.tgl_pulang), {
  message: "Tanggal kembali tidak boleh lebih awal dari tanggal pulang",
  path: ["tgl_kembali"]
})
type IzinPulangFormData = z.infer<typeof izinPulangSchema>

export default function PerizinanMahasiswaPage() {
  const [izinSesiData, setIzinSesiData] = useState<any[]>([])
  const [izinPulangData, setIzinPulangData] = useState<any[]>([])
  const [jadwals, setJadwals] = useState<any[]>([]) 
  const [sesiSudahDiabsen, setSesiSudahDiabsen] = useState<string[]>([])
  const [userProfile, setUserProfile] = useState<any>(null)
  
  const [loading, setLoading] = useState(true)
  const [dialogSesiOpen, setDialogSesiOpen] = useState(false)
  const [dialogPulangOpen, setDialogPulangOpen] = useState(false)
  
  const [submittingSesi, setSubmittingSesi] = useState(false)
  const [submittingPulang, setSubmittingPulang] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { toast } = useToast()
  const supabase = createClient()

  const formSesi = useForm<IzinSesiFormData>({ resolver: zodResolver(izinSesiSchema) })
  const formPulang = useForm<IzinPulangFormData>({ resolver: zodResolver(izinPulangSchema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const { data: profile } = await supabase.from('profiles').select('nama, nim, unit, semester').eq('id', user.id).single()
      setUserProfile(profile)

      const [resSesi, resPulang] = await Promise.all([
        supabase
          .from('izin_sesi')
          .select('*, sesi(tanggal, jam_mulai, nama_kegiatan(nama_kegiatan))')
          .eq('mahasiswa_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('izin_pulang')
          .select('*')
          .eq('mahasiswa_id', user.id)
          .order('created_at', { ascending: false })
      ])

      const dataIzinSesi = resSesi.data ?? []
      setIzinSesiData(dataIzinSesi)
      setIzinPulangData(resPulang.data ?? [])

      const { data: presensiMahasiswa } = await supabase
        .from('presensi')
        .select('sesi_id')
        .eq('mahasiswa_id', user.id)

      const sudahAbsenIds = (presensiMahasiswa ?? []).map(p => p.sesi_id)
      const sudahIzinIds = dataIzinSesi.map(i => i.sesi_id)
      setSesiSudahDiabsen([...sudahAbsenIds, ...sudahIzinIds])

      // FIX ZONA WAKTU: Ambil tanggal hari ini format YYYY-MM-DD sesuai WIB
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

      const { data: sesiList } = await supabase
        .from('sesi')
        .select('*, nama_kegiatan(nama_kegiatan)')
        .gte('tanggal', today)
        .order('tanggal', { ascending: true })

      const validSesi = (sesiList ?? []).filter((s: any) => {
        if (s.tipe_target === 'semua') return true
        if (s.tipe_target === 'unit' && s.target_audiens?.unit === profile?.unit) return true
        if (s.tipe_target === 'unit_semester' && s.target_audiens?.unit === profile?.unit && s.target_audiens?.semester === profile?.semester) return true
        return false
      })

      setJadwals(validSesi)
    } catch (error) {
      toast({ title: 'Error', description: 'Gagal memuat data perizinan', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [supabase, toast])

  useEffect(() => { fetchData() }, [fetchData])

  // --- FITUR BATALKAN PENGAJUAN (DELETE PENDING) ---
  const handleCancelIzin = async (id: string, type: 'sesi' | 'pulang') => {
    const tableName = type === 'sesi' ? 'izin_sesi' : 'izin_pulang'
    setDeletingId(id)
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)
        .eq('status', 'pending') // Keamanan ekstra: hanya bisa hapus jika masih pending

      if (error) throw error

      toast({ title: 'Berhasil', description: 'Pengajuan izin berhasil dibatalkan.' })
      fetchData()
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.message || 'Tidak dapat membatalkan izin.', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  // --- SUBMIT IZIN SESI ---
  const onSubmitSesi = async (data: IzinSesiFormData) => {
    if (sesiSudahDiabsen.includes(data.sesi_id)) {
      toast({ title: 'Aksi Ditolak', description: 'Anda sudah tercatat absen/izin untuk sesi ini.', variant: 'destructive' })
      return
    }

    setSubmittingSesi(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('izin_sesi').insert({
        mahasiswa_id: user.id,
        sesi_id: data.sesi_id,
        alasan_izin: data.alasan_izin,
        status: 'pending'
      })

      if (error) throw error

      toast({ title: 'Berhasil', description: 'Izin diajukan. Mengarahkan ke WhatsApp...', variant: 'success' })
      
      const selectedSesi = jadwals.find(j => j.id === data.sesi_id)
      const namaKajian = selectedSesi?.nama_kegiatan?.nama_kegiatan ?? '-'
      const tanggalKajian = selectedSesi?.tanggal ? formatDate(selectedSesi.tanggal) : '-'
      const jamKajian = selectedSesi?.jam_mulai?.slice(0,5) ?? '-'

      const waText = `Assalamu'alaikum, Pengurus Asrama.\n\nSaya ingin mengonfirmasi pengajuan *IZIN SESI KEGIATAN* di aplikasi SI-ASRAMA.\n\n*Data Mahasiswa:*\nNama: ${userProfile?.nama}\nNIM: ${userProfile?.nim}\n\n*Detail Izin:*\nKegiatan: ${namaKajian}\nJadwal: ${tanggalKajian} (Jam ${jamKajian})\nAlasan: ${data.alasan_izin}\n\nBerikut saya lampirkan foto/dokumen bukti perizinan saya. Mohon untuk direview. Terima kasih. 🙏`
      
      window.open(`https://wa.me/${PENGURUS_WA_NUMBER}?text=${encodeURIComponent(waText)}`, '_blank')

      setDialogSesiOpen(false)
      formSesi.reset()
      fetchData()
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.message || 'Gagal mengajukan izin sesi', variant: 'destructive' })
    } finally {
      setSubmittingSesi(false)
    }
  }

  // --- SUBMIT IZIN PULANG ---
  const onSubmitPulang = async (data: IzinPulangFormData) => {
    setSubmittingPulang(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('izin_pulang').insert({
        mahasiswa_id: user.id,
        tgl_pulang: data.tgl_pulang,
        tgl_kembali: data.tgl_kembali,
        keterangan: data.keterangan,
        status: 'pending'
      })

      if (error) throw error

      toast({ title: 'Berhasil', description: 'Izin diajukan. Mengarahkan ke WhatsApp...', variant: 'success' })
      
      const waText = `Assalamu'alaikum, Pengurus Asrama.\n\nSaya ingin mengonfirmasi pengajuan *IZIN PULANG ASRAMA* di aplikasi SI-ASRAMA.\n\n*Data Mahasiswa:*\nNama: ${userProfile?.nama}\nNIM: ${userProfile?.nim}\n\n*Detail Izin:*\nBerangkat: ${formatDate(data.tgl_pulang)}\nKembali: ${formatDate(data.tgl_kembali)}\nKeterangan: ${data.keterangan}\n\nBerikut saya lampirkan bukti persetujuan orang tua. Mohon izinnya untuk direview. Terima kasih. 🙏`

      window.open(`https://wa.me/${PENGURUS_WA_NUMBER}?text=${encodeURIComponent(waText)}`, '_blank')

      setDialogPulangOpen(false)
      formPulang.reset()
      fetchData()
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.message || 'Gagal mengajukan izin pulang', variant: 'destructive' })
    } finally {
      setSubmittingPulang(false)
    }
  }

  const availableJadwals = jadwals.filter(j => !sesiSudahDiabsen.includes(j.id))

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Perizinan Saya" description="Kelola dan ajukan perizinan kegiatan atau izin pulang asrama" />

      <Tabs defaultValue="sesi" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="sesi" className="flex items-center gap-2"><CalendarDays className="h-4 w-4"/> Izin Sesi</TabsTrigger>
          <TabsTrigger value="pulang" className="flex items-center gap-2"><Home className="h-4 w-4"/> Izin Pulang</TabsTrigger>
        </TabsList>

        {/* --- TAB 1: IZIN SESI --- */}
        <TabsContent value="sesi" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Riwayat Izin Kegiatan</h3>
              <p className="text-xs text-muted-foreground">Daftar pengajuan izin tidak mengikuti sesi ngaji/kegiatan</p>
            </div>
            <Button onClick={() => { formSesi.reset(); setDialogSesiOpen(true) }} className="rounded-xl shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Ajukan Izin Sesi
            </Button>
          </div>

          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
              ) : izinSesiData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <FileText className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Belum ada riwayat izin sesi</p>
                  <p className="text-xs text-slate-500 mt-1">Anda belum pernah mengajukan izin tidak mengikuti kegiatan.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {izinSesiData.map((p: any) => (
                    <div key={p.id} className="flex items-start sm:items-center justify-between p-4 gap-4 flex-col sm:flex-row hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm truncate">{p.sesi?.nama_kegiatan?.nama_kegiatan ?? 'Kegiatan Dihapus'}</p>
                          <Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'destructive' : 'warning'}>
                            {formatLabel(p.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Jadwal: <span className="font-medium text-slate-700">{p.sesi?.tanggal ? formatDate(p.sesi.tanggal) : '-'}</span> · Diajukan: {formatDate(p.created_at)}
                        </p>
                        <p className="text-xs text-slate-700 bg-slate-100/70 p-2 rounded-lg border border-slate-200/50">
                          <span className="font-semibold">Alasan:</span> {p.alasan_izin}
                        </p>
                        {p.catatan_admin && (
                          <div className="bg-blue-50 text-blue-800 text-xs p-2.5 rounded-lg flex items-start gap-2 border border-blue-100">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <p><span className="font-semibold">Catatan Admin:</span> {p.catatan_admin}</p>
                          </div>
                        )}
                      </div>

                      {/* Tombol Hapus jika masih pending */}
                      {p.status === 'pending' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shrink-0 self-end sm:self-center"
                          onClick={() => handleCancelIzin(p.id, 'sesi')}
                          disabled={deletingId === p.id}
                        >
                          {deletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                          Batalkan
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 2: IZIN PULANG --- */}
        <TabsContent value="pulang" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Riwayat Izin Pulang</h3>
              <p className="text-xs text-muted-foreground">Daftar pengajuan izin meninggalkan asrama dalam beberapa hari</p>
            </div>
            <Button onClick={() => { formPulang.reset(); setDialogPulangOpen(true) }} className="rounded-xl shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Ajukan Izin Pulang
            </Button>
          </div>

          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
              ) : izinPulangData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Home className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Belum ada riwayat izin pulang</p>
                  <p className="text-xs text-slate-500 mt-1">Anda belum pernah mengajukan izin pulang asrama.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {izinPulangData.map((p: any) => (
                    <div key={p.id} className="flex items-start sm:items-center justify-between p-4 gap-4 flex-col sm:flex-row hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">Izin Pulang Asrama</p>
                          <Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'destructive' : 'warning'}>
                            {formatLabel(p.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Diajukan pada: {formatDate(p.created_at)}</p>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-normal bg-slate-50 text-slate-700">Berangkat: {formatDate(p.tgl_pulang)}</Badge>
                          <Badge variant="outline" className="font-normal bg-slate-50 text-slate-700">Kembali: {formatDate(p.tgl_kembali)}</Badge>
                        </div>
                        
                        <p className="text-xs text-slate-700 bg-slate-100/70 p-2 rounded-lg border border-slate-200/50">
                          <span className="font-semibold">Keterangan:</span> {p.keterangan}
                        </p>
                        
                        {p.catatan_admin && (
                          <div className="bg-blue-50 text-blue-800 text-xs p-2.5 rounded-lg flex items-start gap-2 border border-blue-100">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <p><span className="font-semibold">Catatan Admin:</span> {p.catatan_admin}</p>
                          </div>
                        )}
                      </div>

                      {/* Tombol Hapus jika masih pending */}
                      {p.status === 'pending' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shrink-0 self-end sm:self-center"
                          onClick={() => handleCancelIzin(p.id, 'pulang')}
                          disabled={deletingId === p.id}
                        >
                          {deletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                          Batalkan
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- DIALOG AJUKAN IZIN SESI --- */}
      <Dialog open={dialogSesiOpen} onOpenChange={setDialogSesiOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Ajukan Izin Sesi Kegiatan</DialogTitle>
            <DialogDescription className="text-xs">Pilih jadwal kegiatan yang ingin Anda tinggalkan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={formSesi.handleSubmit(onSubmitSesi)} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Pilih Jadwal Kegiatan</Label>
              <Controller
                control={formSesi.control}
                name="sesi_id"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className={`rounded-xl ${formSesi.formState.errors.sesi_id ? "border-red-500" : ""}`}>
                      <SelectValue placeholder="Pilih jadwal..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableJadwals.length === 0 ? (
                        <SelectItem value="empty" disabled>Tidak ada jadwal yang tersedia</SelectItem>
                      ) : (
                        availableJadwals.map((j: any) => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.nama_kegiatan?.nama_kegiatan} — {formatDate(j.tanggal)} ({j.jam_mulai.slice(0,5)})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {formSesi.formState.errors.sesi_id && <p className="text-xs text-red-500">{formSesi.formState.errors.sesi_id.message}</p>}
              
              {jadwals.length > availableJadwals.length && (
                <div className="flex items-start gap-2 mt-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>Beberapa jadwal tersembunyi karena Anda sudah diabsen atau sedang mengajukan izin pada sesi tersebut.</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Alasan Izin</Label>
              <Textarea 
                {...formSesi.register('alasan_izin')} 
                placeholder="Contoh: Sedang sakit demam / keperluan mendadak..." 
                className={`rounded-xl resize-none ${formSesi.formState.errors.alasan_izin ? "border-red-500" : ""}`}
                rows={3}
              />
              {formSesi.formState.errors.alasan_izin && <p className="text-xs text-red-500">{formSesi.formState.errors.alasan_izin.message}</p>}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex gap-2.5 items-start">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
              <p>Setelah menekan tombol di bawah, Anda akan <b>diarahkan ke WhatsApp</b> pengurus untuk mengirimkan bukti dukung (surat sakit/dll).</p>
            </div>

            <Button type="submit" className="w-full rounded-xl" disabled={submittingSesi}>
              {submittingSesi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ajukan & Buka WhatsApp
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG AJUKAN IZIN PULANG --- */}
      <Dialog open={dialogPulangOpen} onOpenChange={setDialogPulangOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Ajukan Izin Pulang Asrama</DialogTitle>
            <DialogDescription className="text-xs">Tentukan rentang tanggal kepulangan Anda.</DialogDescription>
          </DialogHeader>
          <form onSubmit={formPulang.handleSubmit(onSubmitPulang)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Berangkat</Label>
                <Input type="date" {...formPulang.register('tgl_pulang')} className={`rounded-xl ${formPulang.formState.errors.tgl_pulang ? "border-red-500" : ""}`} />
                {formPulang.formState.errors.tgl_pulang && <p className="text-xs text-red-500">{formPulang.formState.errors.tgl_pulang.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Tanggal Kembali</Label>
                <Input type="date" {...formPulang.register('tgl_kembali')} className={`rounded-xl ${formPulang.formState.errors.tgl_kembali ? "border-red-500" : ""}`} />
                {formPulang.formState.errors.tgl_kembali && <p className="text-xs text-red-500">{formPulang.formState.errors.tgl_kembali.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Keterangan Pulang</Label>
              <Textarea 
                {...formPulang.register('keterangan')} 
                placeholder="Contoh: Ada acara keluarga / pulang kampung..." 
                className={`rounded-xl resize-none ${formPulang.formState.errors.keterangan ? "border-red-500" : ""}`}
                rows={3}
              />
              {formPulang.formState.errors.keterangan && <p className="text-xs text-red-500">{formPulang.formState.errors.keterangan.message}</p>}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex gap-2.5 items-start">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
              <p>Setelah menekan tombol di bawah, Anda akan <b>diarahkan ke WhatsApp</b> pengurus untuk mengirimkan bukti persetujuan orang tua.</p>
            </div>

            <Button type="submit" className="w-full rounded-xl" disabled={submittingPulang}>
              {submittingPulang ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ajukan & Buka WhatsApp
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
