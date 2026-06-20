import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/shared/stat-card'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Calendar, CheckSquare, CreditCard, ArrowRight, BarChart3 } from 'lucide-react'
import { formatDate, formatCurrency, formatLabel, calcAttendancePercentage, getAttendanceBgColor } from '@/lib/utils'
import Link from 'next/link'

export default async function PengelolaDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'pengelola') redirect(`/${profile?.role ?? 'login'}`)

  // Mengambil total perhitungan stat card
  const [
    { count: totalMahasiswa }, 
    { count: totalJadwal }, 
    { count: pendingIzinSesi }, 
    { count: pendingIzinPulang }, 
    { count: pendingSpp }
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'mahasiswa').eq('is_active', true),
    supabase.from('sesi').select('*', { count: 'exact', head: true }).eq('tanggal', new Date().toISOString().split('T')[0]),
    supabase.from('izin_sesi').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('izin_pulang').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('tagihan_spp').select('*', { count: 'exact', head: true }).eq('status', 'menunggu_verifikasi'),
  ])

  const pendingIzinTotal = (pendingIzinSesi ?? 0) + (pendingIzinPulang ?? 0)

  // Mengambil data perizinan terbaru (gabungan dari izin sesi dan izin pulang)
  const { data: recentIzinSesiData } = await supabase
    .from('izin_sesi')
    .select('*, profiles(nama, nim)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: recentIzinPulangData } = await supabase
    .from('izin_pulang')
    .select('*, profiles(nama, nim)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  // Menggabungkan dan mengurutkan berdasarkan yang terbaru
  const recentIzin = [
    ...(recentIzinSesiData || []).map(i => ({ ...i, type: 'Sesi', alasan: i.alasan_izin })),
    ...(recentIzinPulangData || []).map(i => ({ ...i, type: 'Pulang', alasan: i.keterangan }))
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // Fetch SPP terbaru (Join dengan master_tarif untuk mendapatkan nominal)
  const { data: recentSpp } = await supabase
    .from('tagihan_spp')
    .select('*, profiles(nama, nim), master_tarif(nominal)')
    .eq('status', 'menunggu_verifikasi')
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch presensi (Join berantai: presensi -> sesi -> nama_kegiatan)
  const { data: allPresensi } = await supabase
    .from('presensi')
    .select(`
      status, 
      sesi (
        nama_kegiatan (
          nama_kegiatan
        )
      )
    `)

  // Hitung rata-rata kehadiran
  const activityStats: Record<string, { nama: string; hadir: number; izin: number; alpha: number }> = {}
  ;(allPresensi ?? []).forEach((p: any) => {
    const nama = p.sesi?.nama_kegiatan?.nama_kegiatan ?? 'Lainnya'
    if (!activityStats[nama]) activityStats[nama] = { nama, hadir: 0, izin: 0, alpha: 0 }
    
    if (p.status === 'hadir') activityStats[nama].hadir++
    else if (p.status === 'izin') activityStats[nama].izin++
    else activityStats[nama].alpha++
  })
  const activityList = Object.values(activityStats)

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard Pengelola"
        description={`Hari ini ${formatDate(new Date())}`}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Mahasiswa Aktif"
          value={totalMahasiswa ?? 0}
          icon={Users}
          iconClassName="bg-emerald-100 [&_svg]:text-emerald-600"
        />
        <StatCard
          title="Sesi Hari Ini"
          value={totalJadwal ?? 0}
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

      {/* Average Attendance per Activity */}
      {activityList.length > 0 && (
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Rata-rata Kehadiran per Kegiatan</CardTitle>
              <Link
                href="/pengelola/laporan"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Lihat laporan <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityList.map((act) => {
                const total = act.hadir + act.izin + act.alpha
                const pct = calcAttendancePercentage(act.hadir, act.izin, act.alpha)
                return (
                  <div key={act.nama} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{act.nama}</span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground">{act.hadir}/{total} hadir</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getAttendanceBgColor(pct)}`}>
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

      {/* Recent Perizinan */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Perizinan Menunggu Persetujuan</CardTitle>
            <Link
              href="/pengelola/perizinan"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {pendingIzinTotal > 0 && recentIzin.length === 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div>
                  <p className="font-semibold text-sm text-amber-800">{pendingIzinTotal} perizinan menunggu persetujuan</p>
                  <p className="text-xs text-amber-600">Klik &quot;Lihat semua&quot; untuk mereview</p>
                </div>
                <Link href="/pengelola/perizinan" className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200 hover:bg-amber-200 transition-colors">
                  Review
                </Link>
              </div>
            </div>
          ) : recentIzin.length > 0 ? (
            <div className="space-y-2">
              {recentIzin.map((izin) => {
                const p = izin.profiles as { nama: string; nim: string } | null
                return (
                  <div
                    key={izin.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-sm text-foreground">{p?.nama ?? '-'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p?.nim} · <span className="font-medium">Izin {izin.type}</span>: {izin.alasan}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                      Pending
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckSquare className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Tidak ada perizinan menunggu.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent SPP Menunggu Verifikasi */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Pembayaran SPP Menunggu Verifikasi</CardTitle>
            <Link
              href="/pengelola/keuangan"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentSpp && recentSpp.length > 0 ? (
            <div className="space-y-2">
              {recentSpp.map((spp: any) => {
                const p = spp.profiles as { nama: string; nim: string } | null
                const nominal = spp.master_tarif?.nominal ?? 0
                return (
                  <div
                    key={spp.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-sm text-foreground">{p?.nama ?? '-'}</p>
                      <p className="text-xs text-muted-foreground">{p?.nim} · {formatCurrency(nominal)}</p>
                    </div>
                    <span className="ml-3 shrink-0 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                      Menunggu
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Tidak ada pembayaran menunggu verifikasi.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
export const dynamic = 'force-dynamic'
