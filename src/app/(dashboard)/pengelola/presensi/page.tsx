'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatLabel } from '@/lib/utils'
import { Search, MapPin } from 'lucide-react'

export default function PresensiPage() {
  const [presensi, setPresensi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase.from('presensi').select('*, profiles(nama, nim), jadwal_kegiatan(nama_kegiatan, tanggal)').order('created_at', { ascending: false }).limit(100)
      setPresensi(data ?? [])
      setLoading(false)
    }
    fetch()
  }, []) // eslint-disable-line

  const filtered = presensi.filter(p => !search || (p.profiles?.nama?.toLowerCase().includes(search.toLowerCase()) || p.profiles?.nim?.includes(search)))

  return (
    <div className="space-y-6">
      <PageHeader title="Rekap Presensi" description="Monitor kehadiran mahasiswa" />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari nama atau NIM..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="space-y-3 p-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          : filtered.length === 0 ? <p className="p-6 text-center text-muted-foreground">Tidak ada data presensi.</p>
          : <div className="divide-y">{filtered.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{p.profiles?.nama ?? '-'}</p>
                  <Badge variant={p.status === 'hadir' ? 'success' : p.status === 'izin' ? 'warning' : 'destructive'}>{formatLabel(p.status)}</Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{p.profiles?.nim} · {p.jadwal_kegiatan?.nama_kegiatan ?? '-'} · {p.jadwal_kegiatan?.tanggal ? formatDate(p.jadwal_kegiatan.tanggal) : ''}</p>
              </div>
              {p.latitude && <a href={`https://maps.google.com/?q=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer" className="shrink-0"><MapPin className="h-5 w-5 text-green-500" /></a>}
            </div>
          ))}</div>}
        </CardContent>
      </Card>
    </div>
  )
}
export const dynamic = 'force-dynamic'
