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
import { Calendar, CreditCard, BarChart3, User, LogOut, Settings, CalendarX, Activity } from 'lucide-react'
import { formatDate, formatCurrency, formatLabel, calcAttendancePercentage, getAttendanceBgColor } from '@/lib/utils'

export default async function MahasiswaDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')
  
  // 1. Ambil data profil
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  
  // 2. Validasi Role & Kelengkapan Profil
  if (profile?.role !== 'mahasiswa') redirect(`/${profile?.role ?? 'login'}`)
  if (!profile?.is_completed) redirect('/mahasiswa/profil')

  // ==========================================
  // PERBAIKAN ZONA WAKTU (TIMEZONE FIX)
  // Memaksa server membaca waktu Asia/Jakarta (WIB)
  // ==========================================
  const now = new Date()
  
  // Ambil tanggal format YYYY-MM-DD sesuai zona waktu WIB
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  
  // Ambil jam (0-23) sesuai zona waktu WIB
  const hourString = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Jakarta', hour12: false, hour: 'numeric' })
  const hour = parseInt(hourString, 10)
  
  // Menentukan sapaan waktu dinamis (Pagi/Siang/Sore/Malam)
  let greetingTime = 'Selamat Pagi'
  if (hour >= 11 && hour < 15) greetingTime = 'Selamat Siang'
  else if (hour >= 15 && hour < 18) greetingTime = 'Selamat Sore'
  else if (hour >= 18 || hour < 3) greetingTime = 'Selamat Malam'
  
  // Mengambil data yang dibutuhkan (Tanpa Pelanggaran)
  const [
    { data: sesiHariIniData }, 
    { data: sppDataList }, 
    { data: presensiData }
  ] = await Promise.all([
    supabase
      .from('sesi')
      .select('*, nama_kegiatan(nama_kegiatan, jenis_kegiatan(nama_jenis))')
      .eq('tanggal', today) // Mencari jadwal berdasarkan tanggal WIB
      .order('jam_mulai', { ascending: true }),
    supabase
      .from('tagihan_spp')
      .select('*, master_tarif(nominal, master_periode(nama_periode))')
      .eq('mahasiswa_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('presensi').select('status, sesi(nama_kegiatan(nama_kegiatan))').eq('mahasiswa_id', user.id),
  ])

  // Filter sesi sesuai unit & angkatan/semester
  const jadwalHariIni = (sesiHariIniData ?? []).filter((s: any) => {
    if (s.tipe_target === 'semua') return true
    if (s.tipe_target === 'unit' && s.target_audiens?.unit === profile?.unit) return true
    if (s.tipe_target === 'unit_semester' && 
        s.target_audiens?.unit === profile?.unit && 
        s.target_audiens?.semester === profile?.semester) return true
    return false
  })

  const sppData = sppDataList?.[0]

  // Kalkulasi persentase kehadiran
  const presensiList = presensiData ?? []
  const totalHadir = presensiList.filter((p: any) => p.status === 'hadir').length
  const totalIzin = presensiList.filter((p: any) => p.status === 'izin').length
  const totalAlpha = presensiList.filter((p: any) => p.status === 'alpha').length
  const overallPercentage = calcAttendancePercentage(totalHadir, totalIzin, totalAlpha)

  // Breakdown kehadiran per kegiatan
  const activityMap: Record<string, { nama: string; hadir: number; izin: number; alpha: number }> = {}
  presensiList.forEach((p: any) => {
    const nama = p.sesi?.nama_kegiatan?.nama_kegiatan ?? 'Kegiatan Lainnya'
    if (!activityMap[nama]) activityMap[nama] = { nama, hadir: 0, izin: 0, alpha: 0 }
    
    if (p.status === 'hadir') activityMap[nama].hadir++
    else if (p.status === 'izin') activityMap[nama].izin++
    else activityMap[nama].alpha++
  })
  const activityBreakdown = Object.values(activityMap)

  // Server action untuk logout
  const handleLogout = async () => {
    'use server'
    const supabaseClient = createClient()
    await supabaseClient.auth.signOut()
    redirect('/login')
  }

  const namaPanggilan = profile?.nama ? profile.nama.split(' ')[0] : 'Mahasiswa'

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER DINAMIS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {greetingTime}, {namaPanggilan}! 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {/* Format date ini juga harus kita pastikan sinkron dengan sistem nanti, tapi untuk sekarang kita biarkan Utils bekerja */}
            Hari ini {formatDate(new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })))}
          </p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl border border-input bg-white px-4 py-2 text-sm font-medium shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring gap-2">
            <User className="h-4 w-4 text-primary" /> Menu Profil
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl p-2">
            <div className="px-2 py-1.5 mb-2 border-b">
              <p className="font-medium text-sm truncate">{profile?.nama}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.nim}</p>
            </div>
            <DropdownMenuItem className="cursor-pointer rounded-lg mb-1">
              <Link href="/mahasiswa/profil" className="flex w-full items-center">
                <Settings className="mr-2 h-4 w-4 text-slate-500" /> Pengaturan Profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer rounded-lg text-red-600 focus:bg-red-50 focus:text-red-700">
              <form action={handleLogout} className="w-full">
                <button type="submit" className="flex w-full items-center text-left">
                  <LogOut className="mr-2 h-4 w-4" /> Keluar Sistem
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* STATISTIK GRID 3 KOLOM */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard 
          title="Sesi Ngaji Hari Ini" 
          value={jadwalHariIni.length} 
          icon={Calendar} 
          iconClassName="bg-blue-100 [&_svg]:text-blue-700" 
        />
        <StatCard 
          title="Status SPP" 
          value={sppData ? formatLabel(sppData.status) : 'Belum Ada Tagihan'} 
          icon={CreditCard} 
          iconClassName={sppData?.status === 'lunas' ? 'bg-green-100 [&_svg]:text-green-700' : 'bg-yellow-100 [&_svg]:text-yellow-700'} 
        />
        <StatCard 
          title="Tingkat Kehadiran" 
          value={`${overallPercentage.toFixed(1)}%`} 
          icon={BarChart3} 
          iconClassName={overallPercentage >= 75 ? 'bg-green-100 [&_svg]:text-green-700' : overallPercentage >= 65 ? 'bg-yellow-100 [&_svg]:text-yellow-700' : 'bg-red-100 [&_svg]:text-red-700'} 
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        
        {/* JADWAL HARI INI */}
        <Card className="hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Jadwal Sesi Hari Ini
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {jadwalHariIni.length > 0 ? (
              <div className="space-y-3">
                {jadwalHariIni.map((j: any) => {
                  const namaKegiatan = j.nama_kegiatan?.nama_kegiatan ?? 'Kegiatan Tidak Diketahui'
                  const jenisKegiatan = j.nama_kegiatan?.jenis_kegiatan?.nama_jenis ?? '-'
                  
                  return (
                    <div key={j.id} className="group flex items-center justify-between rounded-xl border border-slate-100 p-3.5 hover:border-primary/30 hover:bg-primary/5 transition-all">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate text-slate-900 group-hover:text-primary transition-colors">{namaKegiatan}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                          {j.jam_mulai.slice(0, 5)} – {j.jam_selesai.slice(0, 5)} WIB
                        </p>
                      </div>
                      <Badge variant="secondary" className="font-normal shrink-0">{jenisKegiatan}</Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              // EMPTY STATE JADWAL
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <CalendarX className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">Tidak ada jadwal hari ini</p>
                <p className="text-xs text-slate-500 mt-1">Selamat beristirahat atau gunakan waktu untuk muraja'ah mandiri.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* REKAP KEHADIRAN VISUAL */}
        <Card className="hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Performa Kehadiran
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {activityBreakdown.length > 0 ? (
              <div className="space-y-5">
                {activityBreakdown.map((act) => {
                  const pct = calcAttendancePercentage(act.hadir, act.izin, act.alpha)
                  const barColor = pct >= 75 ? 'bg-green-500' : pct >= 65 ? 'bg-yellow-500' : 'bg-red-500'
                  
                  return (
                    <div key={act.nama} className="group relative">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-medium text-sm truncate text-slate-800">{act.nama}</p>
                        <span className={`text-xs font-bold ${pct >= 75 ? 'text-green-600' : pct >= 65 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      
                      {/* PROGRESS BAR */}
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      
                      {/* DETAIL STATS */}
                      <div className="flex gap-4 mt-1.5 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Hadir: {act.hadir}</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>Izin: {act.izin}</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>Alpha: {act.alpha}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // EMPTY STATE KEHADIRAN
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <BarChart3 className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">Belum ada data presensi</p>
                <p className="text-xs text-slate-500 mt-1">Rekap kehadiran akan muncul setelah Anda mengikuti sesi.</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
