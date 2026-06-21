import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/shared/stat-card'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Calendar, CreditCard, AlertTriangle, BarChart3, User, LogOut, Settings } from 'lucide-react'
import { formatDate, formatCurrency, formatLabel, calcAttendancePercentage, getAttendanceBgColor } from '@/lib/utils'

export default async function MahasiswaDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'mahasiswa') redirect(`/${profile?.role ?? 'login'}`)

  const today = new Date().toISOString().split('T')[0]
  
  // Mengambil semua data yang dibutuhkan secara paralel
  const [
    { data: sesiHariIniData }, 
    { data: sppDataList }, 
    { data: pelanggaran }, 
    { data: presensiData }
  ] = await Promise.all([
    supabase
      .from('sesi')
      .select('*, nama_kegiatan(nama_kegiatan, jenis_kegiatan(nama_jenis))')
      .eq('tanggal', today)
      .order('jam_mulai', { ascending: true }),
    supabase
      .from('tagihan_spp')
      .select('*, master_tarif(nominal, master_periode(nama_periode))')
      .eq('mahasiswa_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1), // Ambil tagihan terbaru
    supabase.from('pelanggaran').select('poin').eq('mahasiswa_id', user.id),
    supabase.from('presensi').select('status, sesi(nama_kegiatan(nama_kegiatan))').eq('mahasiswa_id', user.id),
  ])

  // Filter sesi berdasarkan unit & semester (Eksekusi logic tipe_target JSONB)
  const jadwalHariIni = (sesiHariIniData ?? []).filter((s: any) => {
    if (s.tipe_target === 'semua') return true
    if (s.tipe_target === 'unit' && s.target_audiens?.unit === profile?.unit) return true
    if (s.tipe_target === 'unit_semester' && 
        s.target_audiens?.unit === profile?.unit && 
        s.target_audiens?.semester === profile?.semester) return true
    return false
  })

  const sppData = sppDataList?.[0] // Data SPP terkini
  const totalPoin = (pelanggaran ?? []).reduce((sum: number, p: any) => sum + p.poin, 0)

  // Kalkulasi persentase kehadiran keseluruhan
  const presensiList = presensiData ?? []
  const totalHadir = presensiList.filter((p: any) => p.status === 'hadir').length
  const totalIzin = presensiList.filter((p: any) => p.status === 'izin').length
  const totalAlpha = presensiList.filter((p: any) => p.status === 'alpha').length
  const overallPercentage = calcAttendancePercentage(totalHadir, totalIzin, totalAlpha)

  // Breakdown kehadiran per nama kegiatan
  const activityMap: Record<string, { nama: string; hadir: number; izin: number; alpha: number }> = {}
  presensiList.forEach((p: any) => {
    const nama = p.sesi?.nama_kegiatan?.nama_kegiatan ?? 'Kegiatan Lainnya'
    if (!activityMap[nama]) activityMap[nama] = { nama, hadir: 0, izin: 0, alpha: 0 }
    
    if (p.status === 'hadir') activityMap[nama].hadir++
    else if (p.status === 'izin') activityMap[nama].izin++
    else activityMap[nama].alpha++
  })
  const activityBreakdown = Object.values(activityMap)

  // --- SERVER ACTION UNTUK LOGOUT ---
  const handleLogout = async () => {
    'use server'
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      
      {/* HEADER DENGAN MENU PROFIL DROPDOWN */}
      <div className="flex justify-between items-start">
        <PageHeader 
          title={`Halo, ${profile?.nama?.split(' ')[0] ?? 'Mahasiswa'}!`} 
          description={`Hari ini ${formatDate(new Date())}`} 
        />
        
        <DropdownMenu>
          {/* Hapus asChild dan gunakan styling tombol bawaan Tailwind */}
          <DropdownMenuTrigger className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring gap-2 mt-1">
            <User className="h-4 w-4" /> Profil
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="cursor-pointer">
              <Link href="/mahasiswa/profil" className="flex w-full items-center">
                <Settings className="mr-2 h-4 w-4" /> Edit Profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
              <form action={handleLogout} className="w-full">
                <button type="submit" className="flex w-full items-center text-left">
                  <LogOut className="mr-2 h-4 w-4" /> Keluar
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard 
          title="Sesi Hari Ini" 
          value={jadwalHariIni.length} 
          icon={Calendar} 
        />
        <StatCard 
          title="Status SPP" 
          value={sppData ? formatLabel(sppData.status) : 'Belum Ada'} 
          icon={CreditCard} 
          iconClassName="bg-blue-100 [&_svg]:text-blue-600" 
        />
        <StatCard 
          title="Poin Pelanggaran" 
          value={totalPoin} 
          icon={AlertTriangle} 
          iconClassName={totalPoin > 0 ? 'bg-red-100 [&_svg]:text-red-600' : 'bg-green-100 [&_svg]:text-green-600'} 
        />
        <StatCard 
          title="Persentase Hadir" 
          value={`${overallPercentage.toFixed(1)}%`} 
          icon={BarChart3} 
          iconClassName={overallPercentage >= 75 ? 'bg-green-100 [&_svg]:text-green-600' : overallPercentage >= 65 ? 'bg-yellow-100 [&_svg]:text-yellow-600' : 'bg-red-100 [&_svg]:text-red-600'} 
        />
      </div>

      {/* Breakdown Kehadiran per Kegiatan */}
      {activityBreakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Rekap Kehadiran per Kegiatan</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityBreakdown.map((act) => {
                const pct = calcAttendancePercentage(act.hadir, act.izin, act.alpha)
                return (
                  <div key={act.nama} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{act.nama}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="text-green-600">H: {act.hadir}</span> · 
                        <span className="text-yellow-600"> I: {act.izin}</span> · 
                        <span className="text-red-600"> A: {act.alpha}</span>
                      </p>
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

      {/* Jadwal Sesi Hari Ini */}
      {jadwalHariIni.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Jadwal Sesi Hari Ini</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jadwalHariIni.map((j: any) => {
                const namaKegiatan = j.nama_kegiatan?.nama_kegiatan ?? 'Kegiatan Tidak Diketahui'
                const jenisKegiatan = j.nama_kegiatan?.jenis_kegiatan?.nama_jenis ?? '-'
                
                return (
                  <div key={j.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium truncate text-foreground">{namaKegiatan}</p>
                      <p className="text-sm text-muted-foreground">{j.jam_mulai.slice(0, 5)} – {j.jam_selesai.slice(0, 5)} WIB</p>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <Badge variant="secondary" className="font-normal">{jenisKegiatan}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informasi SPP */}
      {sppData && (
        <Card>
          <CardHeader><CardTitle>Tagihan SPP Terkini</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-muted-foreground">{sppData.master_tarif?.master_periode?.nama_periode ?? '-'}</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {formatCurrency(sppData.master_tarif?.nominal ?? 0)}
                </p>
              </div>
              <Badge variant={sppData.status === 'lunas' ? 'success' : sppData.status === 'menunggu_verifikasi' ? 'warning' : 'destructive'}>
                {formatLabel(sppData.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'
