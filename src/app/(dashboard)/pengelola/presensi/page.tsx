'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatLabel } from '@/lib/utils'
import { Search, MapPin, FilterX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PresensiPage() {
  const [presensi, setPresensi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // State untuk pencarian dan filter
  const [search, setSearch] = useState('')
  const [unitFilter, setUnitFilter] = useState('all')
  const [semesterFilter, setSemesterFilter] = useState('all')
  const [jenisFilter, setJenisFilter] = useState('all')
  const [kegiatanFilter, setKegiatanFilter] = useState('all')

  const supabase = createClient()

  useEffect(() => {
    const fetchPresensi = async () => {
      setLoading(true)
      // Query disesuaikan dengan skema tabel sesi dan master kegiatan baru
      const { data } = await supabase
        .from('presensi')
        .select(`
          *,
          profiles (nama, nim, unit, semester),
          sesi (
            tanggal,
            nama_kegiatan (
              nama_kegiatan,
              jenis_kegiatan (
                nama_jenis
              )
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500) // Limit diperbesar agar filter client-side lebih efektif
        
      setPresensi(data ?? [])
      setLoading(false)
    }
    fetchPresensi()
  }, []) // eslint-disable-line

  // Mengekstrak opsi unik untuk dropdown filter dari data yang ada
  const uniqueSemesters = Array.from(new Set(presensi.map(p => p.profiles?.semester).filter(Boolean))).sort((a, b) => a - b)
  const uniqueJenis = Array.from(new Set(presensi.map(p => p.sesi?.nama_kegiatan?.jenis_kegiatan?.nama_jenis).filter(Boolean)))
  const uniqueKegiatan = Array.from(new Set(presensi.map(p => p.sesi?.nama_kegiatan?.nama_kegiatan).filter(Boolean)))

  // Logika Multi-Filter
  const filtered = presensi.filter(p => {
    const matchSearch = !search || (p.profiles?.nama?.toLowerCase().includes(search.toLowerCase()) || p.profiles?.nim?.includes(search))
    const matchUnit = unitFilter === 'all' || p.profiles?.unit === unitFilter
    const matchSemester = semesterFilter === 'all' || p.profiles?.semester?.toString() === semesterFilter
    const matchJenis = jenisFilter === 'all' || p.sesi?.nama_kegiatan?.jenis_kegiatan?.nama_jenis === jenisFilter
    const matchKegiatan = kegiatanFilter === 'all' || p.sesi?.nama_kegiatan?.nama_kegiatan === kegiatanFilter

    return matchSearch && matchUnit && matchSemester && matchJenis && matchKegiatan
  })

  // Fungsi untuk reset semua filter
  const resetFilters = () => {
    setSearch('')
    setUnitFilter('all')
    setSemesterFilter('all')
    setJenisFilter('all')
    setKegiatanFilter('all')
  }

  const activeFiltersCount = [unitFilter, semesterFilter, jenisFilter, kegiatanFilter].filter(f => f !== 'all').length

  return (
    <div className="space-y-6">
      <PageHeader title="Rekap Presensi" description="Monitor dan filter kehadiran mahasiswa di berbagai kegiatan" />
      
      {/* --- AREA PENCARIAN & FILTER --- */}
      <div className="space-y-3 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              className="pl-9 bg-background" 
              placeholder="Cari nama atau NIM mahasiswa..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="outline" onClick={resetFilters} className="shrink-0 text-muted-foreground" title="Reset Filter">
              <FilterX className="h-4 w-4 mr-2" /> Reset
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Filter Unit */}
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Semua Unit" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Unit</SelectItem>
              <SelectItem value="mahad_aly">Mahad Aly</SelectItem>
              <SelectItem value="lkim">LKIM</SelectItem>
            </SelectContent>
          </Select>

          {/* Filter Semester */}
          <Select value={semesterFilter} onValueChange={setSemesterFilter} disabled={unitFilter === 'lkim'}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Semua Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Semester</SelectItem>
              {uniqueSemesters.map(sem => (
                <SelectItem key={sem} value={sem.toString()}>Semester {sem}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter Jenis Kegiatan */}
          <Select value={jenisFilter} onValueChange={setJenisFilter}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Semua Jenis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jenis</SelectItem>
              {uniqueJenis.map(jenis => (
                <SelectItem key={jenis} value={jenis}>{jenis}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter Nama Kegiatan */}
          <Select value={kegiatanFilter} onValueChange={setKegiatanFilter}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Semua Kegiatan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kegiatan</SelectItem>
              {uniqueKegiatan.map(kegiatan => (
                <SelectItem key={kegiatan} value={kegiatan}>{kegiatan}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* --- DAFTAR PRESENSI --- */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
              <Search className="h-10 w-10 opacity-20 mb-3" />
              <p>Tidak ada data presensi yang sesuai dengan filter.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((p: any) => {
                const namaKegiatan = p.sesi?.nama_kegiatan?.nama_kegiatan ?? 'Kegiatan Dihapus'
                const jenisKegiatan = p.sesi?.nama_kegiatan?.jenis_kegiatan?.nama_jenis ?? '-'
                const tanggalSesi = p.sesi?.tanggal ? formatDate(p.sesi.tanggal) : '-'

                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-sm text-foreground">{p.profiles?.nama ?? 'User Terhapus'}</p>
                        <Badge variant={p.status === 'hadir' ? 'success' : p.status === 'izin' ? 'warning' : 'destructive'}>
                          {formatLabel(p.status)}
                        </Badge>
                        <Badge variant="outline" className="font-normal text-xs">{jenisKegiatan}</Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {p.profiles?.nim} · <span className="font-medium text-foreground/80">{namaKegiatan}</span> · {tanggalSesi}
                      </p>
                    </div>
                    
                    {p.latitude && p.longitude && (
                      <a 
                        href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="shrink-0 rounded-full p-2 hover:bg-green-50 transition-colors"
                        title="Lihat Lokasi Absen"
                      >
                        <MapPin className="h-5 w-5 text-green-600" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
export const dynamic = 'force-dynamic'
