import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/shared/stat-card'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Users, Calendar, CheckSquare, CreditCard, ArrowRight, 
  Clock, CheckCircle2, ShieldAlert, Wallet, TrendingUp 
} from 'lucide-react'
import { formatDate, formatCurrency, formatLabel, calcAttendancePercentage, getAttendanceBgColor } from '@/lib/utils'
import Link from 'next/link'

export default async function PengelolaDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'pengelola') redirect(`/${profile?.role ?? 'login'}`)

  // Tanggal hari ini format YYYY-MM-DD (Asia/Jakarta)
  const todayWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

  // 1. Fetching Perhitungan Stat Card Utama & Data Hari Ini
  const [
    { count: totalMahasiswa }, 
    { count: totalJadwalToday }, 
    { count: pendingIzinSesi }, 
    { count: pendingIzinPulang }, 
    { count: pendingSpp },
    { data: sesiToday },
    { data: recentIzinSesiData },
    { data: recentIzinPulangData },
    { data: recentSpp },
    { data: allPresensi }
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'mahasiswa').eq('is_active', true),
    supabase.from('sesi').select('*', { count: 'exact', head: true }).eq('tanggal', todayWIB),
    supabase.from('izin_sesi').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('izin_pulang').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('tagihan_spp').select('*', { count: 'exact', head: true }).eq('status', 'menunggu_verifikasi'),
    
    // Sesi hari ini (Query dioptimalkan tanpa mengambil data presensi karena sudah tidak diperlukan di UI)
    supabase.from('sesi')
      .select('*, nama_kegiatan(nama_kegiatan, jenis_kegiatan(nama_jenis))')
      .eq('tanggal', todayWIB)
      .order('jam_mulai', { ascending: true }),

    // Data Perizinan Pending Terbaru
    supabase.from('izin_sesi').select('*, profiles(nama, nim, unit)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
    supabase.from('izin_pulang').select('*, profiles(nama, nim, unit)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
    
    // Tagihan SPP Menunggu Verifikasi
    supabase.from('tagihan_spp').select('*, profiles(nama, nim, unit), master_tarif(nominal, master_periode(nama_periode))').eq('status', 'menunggu_verifikasi').order('created_at', { ascending: false }).limit(5),
    
    // Semua Rekap Presensi untuk Analitik Kehadiran & Warning System
    supabase.from('presensi').select('status, mahasiswa_id, profiles(nama, nim, unit), sesi(nama_kegiatan(nama_kegiatan))')
  ])

  const pendingIzinTotal = (pendingIzinSesi ?? 0) + (pendingIzinPulang ?? 0)

  // Gabungkan Perizinan Terbaru
  const recentIzin = [
    ...(recentIzinSesiData || []).map(i => ({ ...i, type: 'Sesi', alasan: i.alasan_izin })),
    ...(recentIzinPulangData || []).map(i => ({ ...i, type: 'Pulang', alasan: i.keterangan }))
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // 2. Kalkulasi Analitik Kehadiran Per Kegiatan & Per Mahasiswa (Untuk Risk Warning)
  const activityStats: Record<string, { nama: string; hadir: number; izin: number; alpha: number }> = {}
  const studentStats: Record<string, { nama: string; nim: string; unit: string; hadir: number; izin: number; alpha: number }> = {}

  ;(allPresensi ?? []).forEach((p: any) => {
    // Stat Kegiatan
    const namaKegiatan = p.sesi?.nama_kegiatan?.nama_kegiatan ?? 'Kegiatan Lainnya'
    if (!activityStats[namaKegiatan]) activityStats[namaKegiatan] = { nama: namaKegiatan, hadir: 0, izin: 0, alpha: 0 }
    
    if (p.status === 'hadir') activityStats[namaKegiatan].hadir++
    else if (p.status === 'izin') activityStats[namaKegiatan].izin++
    else activityStats[namaKegiatan].alpha++

    // Stat Mahasiswa (Mencari mahasiswa yang presensinya buruk)
    if (p.mahasiswa_id && p.profiles) {
      const mId = p.mahasiswa_id
      if (!studentStats[mId]) {
        studentStats[mId] = { 
          nama: p.profiles.nama, 
          nim: p.profiles.nim, 
          unit: p.profiles.unit, 
          hadir: 0, izin: 0, alpha: 0 
        }
      }
      if (p.status === 'hadir') studentStats[mId].hadir++
      else if (p.status === 'izin') studentStats[mId].izin++
      else studentStats[mId].alpha++
    }
  })

  const activityList = Object.values(activityStats)
  
  // Filter Mahasiswa Berisiko (Persentase < 70% dan total jadwal > 3)
  const riskyStudents = Object.values(studentStats)
    .map(s => {
      const total = s.hadir + s.izin + s.alpha
      const pct = calcAttendancePercentage(s.hadir, s.izin, s.alpha)
      return { ...s, total, pct }
    })
    .filter(s => s.total >= 3 && s.pct < 70)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 4)

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header + Quick Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Dashboard Pengelola"
          description={`Ringkasan operasional asrama hari ini · ${formatDate(new Date())}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/pengelola/perizinan">
            <Button variant="outline" size="sm" className="gap-1.5 bg-background shadow-sm">
              <CheckSquare className="h-4 w-4 text-amber-600" /> Review Izin ({pendingIzinTotal})
            </Button>
          </Link>
          
          <Link href="/pengelola/keuangan">
            <Button variant="outline" size="sm" className="gap-1.5 bg-background shadow-sm">
              <CreditCard className="h-4 w-4 text-purple-600" /> SPP ({pendingSpp})
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid Status Utama */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Mahasiswa Aktif"
          value={totalMahasiswa ?? 0}
          icon={Users}
          iconClassName="bg-emerald-100 [&_svg]:text-emerald-600"
        />
        <StatCard
          title="Sesi Hari Ini"
          value={totalJadwalToday ?? 0}
          icon={Calendar}
          iconClassName="bg-blue-100 [&_svg]:text-blue-600"
        />
        <StatCard
          title="Izin Menunggu"
          value={pendingIzinTotal}
          icon={CheckSquare}
          iconClassName="bg-amber-100 [&_svg]:text-amber-600"
        />
        <StatCard
          title="Verifikasi SPP"
          value={pendingSpp ?? 0}
          icon={CreditCard}
          iconClassName="bg-purple-100 [&_svg]:text-purple-600"
        />
      </div>

      {/* ROW 2: Sesi Hari Ini & Review Pending */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* Jadwal Sesi Hari Ini */}
        <Card className="border border-border/60 shadow-sm flex flex-col">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base font-semibold">Jadwal Sesi Hari Ini</CardTitle>
              </div>
              <Badge variant="secondary" className="font-normal">{sesiToday?.length || 0} Kegiatan</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1">
            {sesiToday && sesiToday.length > 0 ? (
              <div className="space-y-3">
                {sesiToday.map((sesi: any) => (
                  <div 
                    key={sesi.id} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {sesi.nama_kegiatan?.nama_kegiatan}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {sesi.nama_kegiatan?.jenis_kegiatan?.nama_jenis}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span>{sesi.jam_mulai.slice(0,5)}–{sesi.jam_selesai.slice(0,5)} WIB</span>
                        <span>•</span>
                        <span className="capitalize">Target: {formatLabel(sesi.tipe_target)}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 opacity-20 mb-2" />
                <p className="text-sm font-medium">Tidak ada kegiatan terjadwal hari ini</p>
                <p className="text-xs text-muted-foreground mt-0.5">Nikmati hari libur atau buat agenda baru.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Perizinan Menunggu Review */}
        <Card className="border border-border/60 shadow-sm flex flex-col">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-amber-600" />
                <CardTitle className="text-base font-semibold">Izin Menunggu Approval</CardTitle>
              </div>
              <Link
                href="/pengelola/perizinan"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Lihat semua <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1">
            {recentIzin.length > 0 ? (
              <div className="space-y-2.5">
                {recentIzin.map((izin) => {
                  const p = izin.profiles as { nama: string; nim: string; unit: string } | null
                  return (
                    <div
                      key={izin.id}
                      className="flex items-center justify-between rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-sm text-foreground">{p?.nama ?? '-'}</p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {formatLabel(p?.unit)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          <span className="font-medium text-amber-700">Izin {izin.type}</span>: &quot;{izin.alasan}&quot;
                        </p>
                      </div>
                      <Link 
                        href="/pengelola/perizinan" 
                        className="shrink-0 text-xs bg-amber-50 text-amber-700 font-medium px-2.5 py-1 rounded-md border border-amber-200 hover:bg-amber-100 transition-colors"
                      >
                        Review
                      </Link>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 opacity-20 text-emerald-600 mb-2" />
                <p className="text-sm font-medium">Semua Izin Telah Diproses</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tidak ada pengajuan izin yang tertunda.</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ROW 3: Mahasiswa Perlu Perhatian (Warning) & Verifikasi SPP */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* System Warning: Mahasiswa Kehadiran Rendah */}
        <Card className="border border-red-100 bg-red-50/10 shadow-sm">
          <CardHeader className="pb-3 border-b border-red-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                <CardTitle className="text-base font-semibold text-red-900">Perhatian: Kehadiran Rendah (&lt;70%)</CardTitle>
              </div>
              <Badge variant="destructive" className="text-[10px]">
                {riskyStudents.length} Mahasiswa
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {riskyStudents.length > 0 ? (
              <div className="space-y-2.5">
                {riskyStudents.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-red-200 bg-background">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{s.nama}</p>
                      <p className="text-xs text-muted-foreground">{s.nim} · {formatLabel(s.unit)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                        {s.pct.toFixed(1)}% Kehadiran
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1">{s.alpha}x Alpha dari {s.total} Sesi</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 opacity-40 mb-1" />
                <p className="text-xs font-medium">Kedisiplinan Mahasiswa Baik</p>
                <p className="text-[11px] text-muted-foreground">Tidak ada mahasiswa dengan persentase kehadiran kritis.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verifikasi SPP Menunggu */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-purple-600" />
                <CardTitle className="text-base font-semibold">Verifikasi Pembayaran SPP</CardTitle>
              </div>
              <Link href="/pengelola/keuangan" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Kelola SPP <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {recentSpp && recentSpp.length > 0 ? (
              <div className="space-y-2.5">
                {recentSpp.map((spp: any) => {
                  const p = spp.profiles as { nama: string; nim: string } | null
                  const nominal = spp.master_tarif?.nominal ?? 0
                  const periode = spp.master_tarif?.master_periode?.nama_periode ?? '-'
                  return (
                    <div
                      key={spp.id}
                      className="flex items-center justify-between rounded-lg border p-2.5 bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-sm text-foreground">{p?.nama ?? '-'}</p>
                        <p className="text-xs text-muted-foreground">{p?.nim} · Periode {periode}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-purple-700">{formatCurrency(nominal)}</p>
                        <span className="inline-block mt-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                          Menunggu Verifikasi
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                <CreditCard className="mx-auto h-8 w-8 opacity-20 mb-1" />
                <p className="text-xs font-medium">Tidak ada antrean verifikasi SPP</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ROW 4: Rekap Rata-rata Kehadiran Per Kegiatan */}
      {activityList.length > 0 && (
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-base font-semibold">Tingkat Kehadiran per Jenis Kegiatan</CardTitle>
              </div>
              <Link href="/pengelola/laporan" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Laporan Lengkap <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activityList.map((act) => {
                const total = act.hadir + act.izin + act.alpha
                const pct = calcAttendancePercentage(act.hadir, act.izin, act.alpha)
                return (
                  <div key={act.nama} className="space-y-1.5 p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-sm truncate">{act.nama}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground">{act.hadir}/{total} Hadir</span>
                        <span className={`rounded-full px-2 py-0.5 font-bold ${getAttendanceBgColor(pct)}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pct >= 75 ? 'bg-green-500' : pct >= 65 ? 'bg-yellow-500' : pct >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}

export const dynamic = 'force-dynamic'
