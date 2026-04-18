'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatLabel } from '@/lib/utils'
import { Plus, Loader2 } from 'lucide-react'
import { CURRENT_SEMESTER, SPP_NOMINAL } from '@/lib/constants'

export default function KeuanganPage() {
  const [spps, setSpps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSpp, setSelectedSpp] = useState<any>(null)
  const [catatan, setCatatan] = useState('')
  const [verifyStatus, setVerifyStatus] = useState<'lunas' | 'ditolak'>('lunas')
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase.from('pembayaran_spp').select('*, profiles(nama, nim, unit, angkatan)').order('created_at', { ascending: false })
    setSpps(data ?? [])
    setLoading(false)
  }
  useEffect(() => { fetchData() }, []) // eslint-disable-line

  const generateTagihan = async () => {
    setGenerating(true)
    const { data: mahasiswas } = await supabase.from('profiles').select('*').eq('role', 'mahasiswa').eq('is_active', true)
    const { data: existingSpp } = await supabase.from('pembayaran_spp').select('mahasiswa_id').eq('semester', CURRENT_SEMESTER)
    const existingIds = new Set((existingSpp ?? []).map((s: any) => s.mahasiswa_id))
    const newTagihans = (mahasiswas ?? []).filter((m: any) => !existingIds.has(m.id)).map((m: any) => ({ mahasiswa_id: m.id, semester: CURRENT_SEMESTER, nominal: SPP_NOMINAL[m.unit] ?? 500000, status: 'belum_bayar' }))
    if (newTagihans.length === 0) { toast({ title: 'Info', description: 'Semua mahasiswa sudah memiliki tagihan.' }) }
    else {
      await supabase.from('pembayaran_spp').insert(newTagihans)
      toast({ title: 'Berhasil', description: `${newTagihans.length} tagihan dibuat`, variant: 'success' })
      fetchData()
    }
    setGenerating(false)
  }

  const handleVerify = async () => {
    if (!selectedSpp) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('pembayaran_spp').update({ status: verifyStatus, verified_by: user?.id, verified_at: new Date().toISOString(), catatan, updated_at: new Date().toISOString() }).eq('id', selectedSpp.id)
    toast({ title: 'Berhasil', description: 'Status diperbarui', variant: 'success' })
    setSelectedSpp(null); fetchData(); setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Keuangan SPP" description="Manajemen pembayaran SPP">
        <Button onClick={generateTagihan} disabled={generating} variant="outline">{generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Generate Tagihan</Button>
      </PageHeader>
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="space-y-3 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          : spps.length === 0 ? <p className="p-6 text-center text-muted-foreground">Belum ada data pembayaran.</p>
          : <div className="divide-y">{spps.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{s.profiles?.nama ?? '-'}</p>
                  <Badge variant={s.status === 'lunas' ? 'success' : s.status === 'menunggu_verifikasi' ? 'warning' : 'secondary'}>{formatLabel(s.status)}</Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">{s.profiles?.nim} · {s.semester} · {formatCurrency(s.nominal)}</p>
              </div>
              {s.status === 'menunggu_verifikasi' && <Button size="sm" className="shrink-0" onClick={() => { setSelectedSpp(s); setCatatan(''); setVerifyStatus('lunas') }}>Verifikasi</Button>}
            </div>
          ))}</div>}
        </CardContent>
      </Card>
      <Dialog open={!!selectedSpp} onOpenChange={o => !o && setSelectedSpp(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verifikasi Pembayaran</DialogTitle></DialogHeader>
          {selectedSpp && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-1">
                <p><b>Mahasiswa:</b> {selectedSpp.profiles?.nama}</p>
                <p><b>Semester:</b> {selectedSpp.semester}</p>
                <p><b>Nominal:</b> {formatCurrency(selectedSpp.nominal)}</p>
                {selectedSpp.bukti_bayar_url && <p><a href={selectedSpp.bukti_bayar_url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">Lihat Bukti Bayar</a></p>}
              </div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={verifyStatus} onValueChange={v => setVerifyStatus(v as 'lunas' | 'ditolak')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="lunas">Lunas</SelectItem><SelectItem value="ditolak">Ditolak</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Catatan</Label><Textarea value={catatan} onChange={e => setCatatan(e.target.value)} /></div>
              <Button className="w-full" onClick={handleVerify} disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Simpan</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
