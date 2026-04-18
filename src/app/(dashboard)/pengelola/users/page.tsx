'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Profile } from '@/types'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { UNIT_OPTIONS } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'

export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [unitFilter, setUnitFilter] = useState('all')
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase.from('profiles').select('*').eq('role', 'mahasiswa').order('nama')
      setUsers(data ?? [])
      setLoading(false)
    }
    fetch()
  }, []) // eslint-disable-line

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('profiles').update({ is_active: !current, updated_at: new Date().toISOString() }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !current } : u))
    toast({ title: 'Berhasil', description: 'Status diperbarui', variant: 'success' })
  }

  const filtered = users.filter(u => {
    const matchSearch = u.nama.toLowerCase().includes(search.toLowerCase()) || u.nim.includes(search)
    const matchUnit = unitFilter === 'all' || u.unit === unitFilter
    return matchSearch && matchUnit
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Manajemen Mahasiswa" description="Kelola data mahasiswa asrama" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari nama atau NIM..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Semua Unit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Unit</SelectItem>
            {UNIT_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Tidak ada data mahasiswa.</p>
          ) : (
            <div className="divide-y">
              {filtered.map(u => (
                <div key={u.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{u.nama}</p>
                      <Badge variant={u.is_active ? 'success' : 'secondary'}>{u.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{u.nim} · {u.unit === 'mahad_aly' ? "Ma'had Aly" : 'LKIM'} · Angkatan {u.angkatan}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => toggleActive(u.id, u.is_active)}>
                    {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
export const dynamic = 'force-dynamic'
