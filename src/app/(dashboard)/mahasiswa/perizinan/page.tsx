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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Plus, Loader2, CalendarDays, Home, Info, AlertCircle } from 'lucide-react'
import { formatDate, formatLabel } from '@/lib/utils'

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
  const [jadwals, setJadwals] = useState<any[]>([]) // Untuk dropdown sesi
  
  // State untuk melacak ID sesi yang sudah diabsen atau diajukan izinnya
  const [sesiSudahDiabsen, setSesiSudahDiabsen] = useState<string[]>([])
  
  const [loading, setLoading] = useState(true)

  const [dialogSesiOpen, setDialogSesiOpen] = useState(false)
  const [dialogPulangOpen, setDialogPulangOpen] = useState(false)
  
  const [submittingSesi, setSubmittingSesi] = useState(false)
  const [submittingPulang, setSubmittingPulang] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  // Form Handlers
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
      // 1. Ambil Profil Mahasiswa (untuk filter sesi)
      const { data: profile } = await supabase.from('profiles').select('unit, semester').eq('id', user.id).single()

      // 2. Ambil Riwayat Izin
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

      // 3. Ambil data Presensi yang sudah dilakukan mahasiswa ini
      const { data: presensiMahasiswa } = await supabase
        .from('presensi')
        .select('sesi_id')
        .eq('mahasiswa_id', user.id)

      // Gabungkan ID Sesi yang SUDAH diabsen atau SUDAH diajukan izinnya
      const sudahAbsenIds = (presensiMahasiswa ?? []).map(p => p.sesi_id)
      const sudahIzinIds = dataIzinSesi.map(i => i.sesi_id)
      setSesiSudahDiabsen([...sudahAbsenIds, ...sudahIzinIds])

      // 4. Ambil Jadwal Sesi ke depan untuk Dropdown Izin Sesi
      const today = new Date().toISOString().split('T')[0]
      const { data: sesiList } = await supabase
        .from('sesi')
        .select('*, nama_kegiatan(nama_kegiatan)')
        .gte('tanggal', today)
        .order('tanggal', { ascending: true })

      // Filter sesi sesuai unit mahasiswa (seperti di absensi)
      const validSesi = (sesiList ?? []).filter((s: any) => {
        if (s.tipe_target === 'semua') return true
        if (s.tipe_target === 'unit' && s.target_audiens?.unit === profile?.unit) return true
        if (s.tipe_target === 'unit_semester' && s.target_audiens?.unit === profile?.unit && s.target_audiens?.semester === profile?.semester) return true
        return false
      })

      setJadwals(validSesi)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({ title: 'Error', description: 'Gagal memuat data perizinan', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [supabase, toast])

  useEffect(() => { fetchData() }, [fetchData])

  // --- SUBMIT IZIN SESI ---
  const onSubmitSesi = async (data: IzinSesiFormData) => {
    // Validasi Ganda (Mencegah Bypass)
    if (sesiSudahDiabsen.includes(data.sesi_id)) {
      toast({ title: 'Aksi Ditolak', description: 'Anda sudah tercatat absen atau sedang mengajukan izin untuk sesi ini.', variant: 'destructive' })
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

      toast({ title: 'Berhasil', description: 'Izin sesi berhasil diajukan', variant: 'success' })
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

      toast({ title: 'Berhasil', description: 'Izin pulang berhasil diajukan', variant: 'success' })
      setDialogPulangOpen(false)
      formPulang.reset()
      fetchData()
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.message || 'Gagal mengajukan izin pulang', variant: 'destructive' })
    } finally {
      setSubmittingPulang(false)
    }
  }

  // Menentukan mana jadwal yang bisa dipilih di dropdown (disaring)
  const availableJadwals = jadwals.filter(j => !sesiSudahDiabsen.includes(j.id))

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Perizinan Saya" description="Ajukan izin tidak mengikuti kegiatan atau izin pulang" />

      <Tabs defaultValue="sesi" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="sesi" className="flex items-center gap-2"><CalendarDays className="h-4 w-4"/> Izin Sesi</TabsTrigger>
          <TabsTrigger value="pulang" className="flex items-center gap-2"><Home className="h-4 w-4"/> Izin Pulang</TabsTrigger>
        </TabsList>

        {/* --- TAB 1: IZIN SESI --- */}
        <TabsContent value="sesi" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Riwayat Izin Kegiatan</h3>
            <Button onClick={() => { formSesi.reset(); setDialogSesiOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />Ajukan Izin Sesi
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : izinSesiData.length === 0 ? (
                <p className="p-12 text-center text-muted-foreground">Belum ada riwayat izin sesi kegiatan.</p>
              ) : (
                <div className="divide-y">
                  {izinSesiData.map((p: any) => (
                    <div key={p.id} className="flex items-start sm:items-center justify-between p-4 gap-3 flex-col sm:flex-row hover:bg-muted/30">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{p.sesi?.nama_kegiatan?.nama_kegiatan ?? 'Kegiatan Dihapus'}</p>
                          <Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'destructive' : 'warning'}>
                            {formatLabel(p.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Jadwal: {p.sesi?.tanggal ? formatDate(p.sesi.tanggal) : '-'} · Diajukan: {formatDate(p.created_at)}
                        </p>
                        <p className="text-sm text-foreground/80"><span className="font-medium">Alasan:</span> {p.alasan_izin}</p>
                        {p.catatan_admin && (
                          <div className="mt-2 bg-blue-50 text-blue-800 text-xs p-2 rounded flex items-start gap-2 border border-blue-100">
                            <Info className="h-4 w-4 shrink-0" />
                            <p><span className="font-semibold">Catatan Admin:</span> {p.catatan_admin}</p>
                          </div>
                        )}
                      </div>
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
            <h3 className="text-lg font-semibold">Riwayat Izin Pulang</h3>
            <Button onClick={() => { formPulang.reset(); setDialogPulangOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />Ajukan Izin Pulang
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : izinPulangData.length === 0 ? (
                <p className="p-12 text-center text-muted-foreground">Belum ada riwayat izin pulang.</p>
              ) : (
                <div className="divide-y">
                  {izinPulangData.map((p: any) => (
                    <div key={p.id} className="flex items-start sm:items-center justify-between p-4 gap-3 flex-col sm:flex-row hover:bg-muted/30">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">Izin Pulang Asrama</p>
                          <Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'destructive' : 'warning'}>
                            {formatLabel(p.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Diajukan pada: {formatDate(p.created_at)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="font-normal bg-muted">Berangkat: {formatDate(p.tgl_pulang)}</Badge>
                          <Badge variant="outline" className="font-normal bg-muted">Kembali: {formatDate(p.tgl_kembali)}</Badge>
                        </div>
                        <p className="text-sm text-foreground/80 mt-1"><span className="font-medium">Keterangan:</span> {p.keterangan}</p>
                        
                        {p.catatan_admin && (
                          <div className="mt-2 bg-blue-50 text-blue-800 text-xs p-2 rounded flex items-start gap-2 border border-blue-100">
                            <Info className="h-4 w-4 shrink-0" />
                            <p><span className="font-semibold">Catatan Admin:</span> {p.catatan_admin}</p>
                          </div>
                        )}
                      </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajukan Izin Sesi Kegiatan</DialogTitle>
          </DialogHeader>
          <form onSubmit={formSesi.handleSubmit(onSubmitSesi)} className="space-y-4">
            <div className="space-y-2">
              <Label>Pilih Jadwal Kegiatan</Label>
              <Controller
                control={formSesi.control}
                name="sesi_id"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className={formSesi.formState.errors.sesi_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Pilih jadwal yang akan ditinggalkan" />
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
              
              {/* Pesan Info jika ada jadwal yang disembunyikan */}
              {jadwals.length > availableJadwals.length && (
                <div className="flex items-start gap-2 mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>Beberapa jadwal tidak ditampilkan karena Anda sudah tercatat absen atau sedang mengajukan izin pada sesi tersebut.</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Alasan Izin</Label>
              <Textarea 
                {...formSesi.register('alasan_izin')} 
                placeholder="Contoh: Sedang sakit demam..." 
                className={formSesi.formState.errors.alasan_izin ? "border-red-500" : ""}
              />
              {formSesi.formState.errors.alasan_izin && <p className="text-xs text-red-500">{formSesi.formState.errors.alasan_izin.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={submittingSesi}>
              {submittingSesi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ajukan Izin Sesi
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG AJUKAN IZIN PULANG --- */}
      <Dialog open={dialogPulangOpen} onOpenChange={setDialogPulangOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajukan Izin Pulang</DialogTitle>
          </DialogHeader>
          <form onSubmit={formPulang.handleSubmit(onSubmitPulang)} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Pulang</Label>
                <Input type="date" {...formPulang.register('tgl_pulang')} className={formPulang.formState.errors.tgl_pulang ? "border-red-500" : ""} />
                {formPulang.formState.errors.tgl_pulang && <p className="text-xs text-red-500">{formPulang.formState.errors.tgl_pulang.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Tanggal Kembali</Label>
                <Input type="date" {...formPulang.register('tgl_kembali')} className={formPulang.formState.errors.tgl_kembali ? "border-red-500" : ""} />
                {formPulang.formState.errors.tgl_kembali && <p className="text-xs text-red-500">{formPulang.formState.errors.tgl_kembali.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Keterangan Pulang</Label>
              <Textarea 
                {...formPulang.register('keterangan')} 
                placeholder="Contoh: Ada acara keluarga / pulang kampung..." 
                className={formPulang.formState.errors.keterangan ? "border-red-500" : ""}
              />
              {formPulang.formState.errors.keterangan && <p className="text-xs text-red-500">{formPulang.formState.errors.keterangan.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={submittingPulang}>
              {submittingPulang ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ajukan Izin Pulang
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const dynamic = 'force-dynamic'
