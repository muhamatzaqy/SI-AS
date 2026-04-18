import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/shared/stat-card'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, CreditCard, AlertTriangle, BarChart3 } from 'lucide-react'
import { formatDate, formatCurrency, formatLabel, calcAttendancePercentage, getAttendanceBgColor } from '@/lib/utils'
import { CURRENT_SEMESTER } from '@/lib/constants'

export default async function MahasiswaDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'mahasiswa') redirect(`/${profile?.role ?? 'login'}`)

  const today = new Date().toISOString().split('T')[0]
  const [{ data: jadwalHariIni }, { data: sppData }, { data: pelanggaran }, { data: presensiData }] = await Promise.all([
    supabase.from('jadwal_kegiatan').select('*').eq('tanggal', today).or(`target_unit.eq.${profile?.unit},target_unit.eq.gabungan`),
    supabase.from('pembayaran_spp').select('*').eq('mahasiswa_id', user.id).eq('semester', CURRENT_SEMESTER).single(),
    supabase.from('pelanggaran').select('poin').eq('mahasiswa_id', user.id),
    supabase.from('presensi').select('*, jadwal_kegiatan(nama_kegiatan, jenis)').eq('mahasiswa_id', user.id),
  ])

  const totalPoin = (pelanggaran ?? []).reduce((sum: number, p: any) => sum + p.poin, 0)

  // Calculate attendance percentages per activity
  const presensiList = presensiData ?? []
  const totalHadir = presensiList.filter((p: any) => p.status === 'hadir').length
  const totalIzin = presensiList.filter((p: any) => p.status === 'izin').length
  const totalAlpha = presensiList.filter((p: any) => p.status === 'alpha').length
  const overallPercentage = calcAttendancePercentage(totalHadir, totalIzin, totalAlpha)

  // Per-activity breakdown
  const activityMap: Record<string, { nama: string; hadir: number; izin: number; alpha: number }> = {}
  presensiList.forEach((p: any) => {
    const nama = p.jadwal_kegiatan?.nama_kegiatan ?? 'Lainnya'
    if (!activityMap[nama]) activityMap[nama] = { nama, hadir: 0, izin: 0, alpha: 0 }
    if (p.status === 'hadir') activityMap[nama].hadir++
    else if (p.status === 'izin') activityMap[nama].izin++
    else activityMap[nama].alpha++
  })
  const activityBreakdown = Object.values(activityMap)

  return (
    <div className="space-y-6">
      <PageHeader title={`Halo, ${profile?.nama?.split(' ')[0] ?? 'Mahasiswa'}!`} description={`Hari ini ${formatDate(new Date())}`} />
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard title="Jadwal Hari Ini" value={jadwalHariIni?.length ?? 0} icon={Calendar} />
        <StatCard title="Status SPP" value={sppData ? formatLabel(sppData.status) : 'Belum Ada'} icon={CreditCard} iconClassName="bg-blue-100" />
        <StatCard title="Poin Pelanggaran" value={totalPoin} icon={AlertTriangle} iconClassName={totalPoin > 0 ? 'bg-red-100' : 'bg-green-100'} />
        <StatCard title="Kehadiran" value={`${overallPercentage.toFixed(1)}%`} icon={BarChart3} iconClassName={overallPercentage >= 75 ? 'bg-green-100' : overallPercentage >= 65 ? 'bg-yellow-100' : 'bg-red-100'} />
      </div>

      {/* Attendance per activity */}
      {activityBreakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Persentase Kehadiran per Kegiatan</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityBreakdown.map((act) => {
                const pct = calcAttendancePercentage(act.hadir, act.izin, act.alpha)
                return (
                  <div key={act.nama} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{act.nama}</p>
                      <p className="text-xs text-muted-foreground">H: {act.hadir} · I: {act.izin} · A: {act.alpha}</p>
                    </div>
                    <span className={`shrink-0 ml-3 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getAttendanceBgColor(pct)}`}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {jadwalHariIni && jadwalHariIni.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Jadwal Hari Ini</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jadwalHariIni.map((j: any) => (
                <div key={j.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0"><p className="font-medium truncate">{j.nama_kegiatan}</p><p className="text-sm text-muted-foreground">{j.jam_mulai}–{j.jam_selesai}</p></div>
                  <div className="flex gap-2 shrink-0 flex-wrap"><Badge variant="secondary">{formatLabel(j.jenis)}</Badge>{j.wajib_foto && <Badge variant="info">Foto</Badge>}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {sppData && (
        <Card>
          <CardHeader><CardTitle>Status SPP</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div><p className="font-medium">{sppData.semester}</p><p className="text-2xl font-bold mt-1">{formatCurrency(sppData.nominal)}</p></div>
              <Badge variant={sppData.status === 'lunas' ? 'success' : sppData.status === 'menunggu_verifikasi' ? 'warning' : 'destructive'}>{formatLabel(sppData.status)}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export const dynamic = 'force-dynamic'
