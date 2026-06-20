'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatLabel } from '@/lib/utils'
import { CheckCircle, XCircle, Filter, CalendarDays, Home } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function PerizinanPengelolaPage() {
  const [izinSesi, setIzinSesi] = useState<any[]>([])
  const [izinPulang, setIzinPulang] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // State untuk modal review
  const [selectedIzin, setSelectedIzin] = useState<any>(null)
  const [izinType, setIzinType] = useState<'sesi' | 'pulang' | null>(null)
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  const [filterStatus, setFilterStatus] = useState<string>('pending')

  const { toast } = useToast()
  const supabase = createClient()

  const fetchPerizinan = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch Izin Sesi
      let querySesi = supabase
        .from('izin_sesi')
        .select(`
          *,
          profiles(nama, nim, unit),
          sesi(
            tanggal, 
            jam_mulai, 
            nama_kegiatan(nama_kegiatan)
          )
        `)
        .order('created_at', { ascending: false })

      // 2. Fetch Izin Pulang
      let queryPulang = supabase
        .from('izin_pulang')
        .select(`
          *,
          profiles(nama, nim, unit)
        `)
        .order('created_at', { ascending: false })

      if (filterStatus !== 'all') {
        querySesi = querySesi.eq('status', filterStatus)
        queryPulang = queryPulang.eq('status', filterStatus)
      }

      const [resSesi, resPulang] = await Promise.all([querySesi, queryPulang])

      if (resSesi.error) throw resSesi.error
      if (resPulang.error) throw resPulang.error

      setIzinSesi(resSesi.data ?? [])
      setIzinPulang(resPulang.data ?? [])
    } catch (err: any) {
      console.error('Error fetch perizinan:', err)
      toast({ title: 'Error', description: err.message || 'Gagal memuat data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filterStatus, supabase, toast])

  useEffect(() => { fetchPerizinan() }, [fetchPerizinan])

  const openReview = (izin: any, type: 'sesi' | 'pulang') => {
    setSelectedIzin(izin)
    setIzinType(type)
    setCatatan(izin.catatan_admin || '')
  }

  const handleApprove = async (status: 'approved' | 'rejected') => {
    if (!selectedIzin || !izinType) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    const table = izinType === 'sesi' ? 'izin_sesi' : 'izin_pulang'

    const { error } = await supabase
      .from(table)
      .update({
        status,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        catatan_admin: catatan,
      })
      .eq('id', selectedIzin.id)

    if (error) {
      toast({ title: 'Error', description: `Gagal memperbarui: ${error.message}`, variant: 'destructive' })
    } else {
      toast({
        title: 'Berhasil',
        description: status === 'approved' ? 'Perizinan disetujui' : 'Perizinan ditolak',
        variant: 'success'
      })
      setSelectedIzin(null)
      setIzinType(null)
      setCatatan('')
      fetchPerizinan() // Refresh data
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Manajemen Perizinan" description="Approve atau tolak pengajuan izin mahasiswa">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] bg-background">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Menunggu (Pending)</SelectItem>
            <SelectItem value="approved">Disetujui (Approved)</SelectItem>
            <SelectItem value="rejected">Ditolak (Rejected)</SelectItem>
            <SelectItem value="all">Semua Status</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <Tabs defaultValue="sesi" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="sesi" className="flex items-center gap-2"><CalendarDays className="h-4 w-4"/> Izin Sesi</TabsTrigger>
          <TabsTrigger value="pulang" className="flex items-center gap-2"><Home className="h-4 w-4"/> Izin Pulang</TabsTrigger>
        </TabsList>

        {/* --- TAB 1: IZIN SESI --- */}
        <TabsContent value="sesi" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : izinSesi.length === 0 ? (
                <p className="p-12 text-center text-muted-foreground">Tidak ada data izin sesi.</p>
              ) : (
                <div className="divide-y">
                  {izinSesi.map((izin: any) => {
                    const namaKegiatan = izin.sesi?.nama_kegiatan?.nama_kegiatan ?? 'Kegiatan terhapus'
                    return (
                      <div key={izin.id} className="flex items-center justify-between p-4 gap-3 hover:bg-muted/30">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground">{izin.profiles?.nama ?? '-'}</p>
                            <Badge variant={izin.status === 'pending' ? 'warning' : izin.status === 'approved' ? 'success' : 'destructive'}>
                              {formatLabel(izin.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {izin.profiles?.nim ?? '-'} · Mengajukan pada {formatDate(izin.created_at)}
                          </p>
                          <p className="text-xs text-foreground/80 bg-muted inline-block px-2 py-1 rounded-md mt-1">
                            <span className="font-medium">Absen:</span> {namaKegiatan} ({izin.sesi?.tanggal ? formatDate(izin.sesi.tanggal) : '-'})
                          </p>
                        </div>
                        {izin.status === 'pending' && (
                          <Button size="sm" className="shrink-0" onClick={() => openReview(izin, 'sesi')}>Review</Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 2: IZIN PULANG --- */}
        <TabsContent value="pulang" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : izinPulang.length === 0 ? (
                <p className="p-12 text-center text-muted-foreground">Tidak ada data izin pulang.</p>
              ) : (
                <div className="divide-y">
                  {izinPulang.map((izin: any) => (
                    <div key={izin.id} className="flex items-center justify-between p-4 gap-3 hover:bg-muted/30">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{izin.profiles?.nama ?? '-'}</p>
                          <Badge variant={izin.status === 'pending' ? 'warning' : izin.status === 'approved' ? 'success' : 'destructive'}>
                            {formatLabel(izin.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {izin.profiles?.nim ?? '-'} · Mengajukan pada {formatDate(izin.created_at)}
                        </p>
                        <p className="text-xs text-foreground/80 bg-blue-50 text-blue-800 border-blue-200 border inline-block px-2 py-1 rounded-md mt-1">
                          <span className="font-medium">Periode:</span> {formatDate(izin.tgl_pulang)} s/d {formatDate(izin.tgl_kembali)}
                        </p>
                      </div>
                      {izin.status === 'pending' && (
                        <Button size="sm" className="shrink-0" onClick={() => openReview(izin, 'pulang')}>Review</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- DIALOG MODAL REVIEW --- */}
      <Dialog open={!!selectedIzin} onOpenChange={(o) => { if (!o) { setSelectedIzin(null); setIzinType(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Pengajuan {izinType === 'sesi' ? 'Izin Sesi' : 'Izin Pulang'}</DialogTitle>
          </DialogHeader>

          {selectedIzin && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <p><span className="font-medium">Mahasiswa:</span> {selectedIzin.profiles?.nama ?? '-'}</p>
                <p><span className="font-medium">NIM / Unit:</span> {selectedIzin.profiles?.nim ?? '-'} ({formatLabel(selectedIzin.profiles?.unit) ?? '-'})</p>
                
                <hr className="my-2 border-border" />

                {izinType === 'sesi' ? (
                  <>
                    <p><span className="font-medium">Sesi Ditinggalkan:</span> {selectedIzin.sesi?.nama_kegiatan?.nama_kegiatan}</p>
                    <p><span className="font-medium">Waktu:</span> {selectedIzin.sesi?.tanggal ? formatDate(selectedIzin.sesi.tanggal) : '-'} ({selectedIzin.sesi?.jam_mulai?.slice(0,5)})</p>
                    <p><span className="font-medium">Alasan Izin:</span> {selectedIzin.alasan_izin}</p>
                  </>
                ) : (
                  <>
                    <p><span className="font-medium">Tgl Pulang:</span> {formatDate(selectedIzin.tgl_pulang)}</p>
                    <p><span className="font-medium">Tgl Kembali:</span> {formatDate(selectedIzin.tgl_kembali)}</p>
                    <p><span className="font-medium">Keterangan:</span> {selectedIzin.keterangan}</p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Catatan Pengurus (Opsional)</Label>
                <Textarea 
                  value={catatan} 
                  onChange={(e) => setCatatan(e.target.value)} 
                  placeholder="Beri catatan untuk mahasiswa..." 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={() => handleApprove('approved')} disabled={submitting}>
                  <CheckCircle className="mr-2 h-4 w-4" /> Setujui
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleApprove('rejected')} disabled={submitting}>
                  <XCircle className="mr-2 h-4 w-4" /> Tolak
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const dynamic = 'force-dynamic'
