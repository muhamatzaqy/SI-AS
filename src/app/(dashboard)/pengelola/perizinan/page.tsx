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
import { CheckCircle, XCircle, Filter } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const BUCKET = 'permit-photos'

export default function PerizinanPengelolaPage() {
  const [perizinan, setPerizinan] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIzin, setSelectedIzin] = useState<any>(null)
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('pending')

  const [userReady, setUserReady] = useState(false)
  const [user, setUser] = useState<any>(null)

  const [buktiPreviewUrl, setBuktiPreviewUrl] = useState<string>('')

  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const syncUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (!mounted) return
        if (error) {
          console.error('getUser error:', error)
          setUser(null)
        } else {
          setUser(data?.user ?? null)
        }
      } finally {
        if (mounted) setUserReady(true)
      }
    }

    syncUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => syncUser())

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const fetchPerizinan = useCallback(async () => {
    if (!userReady) return
    if (!user) {
      setPerizinan([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let query = supabase
        .from('perizinan')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterStatus !== 'all') query = query.eq('status', filterStatus)

      const { data: izinData, error: izinError } = await query
      if (izinError) {
        console.error('Error fetch perizinan:', izinError.message, izinError.details, izinError.hint)
        toast({ title: 'Error', description: `Gagal memuat data: ${izinError.message}`, variant: 'destructive' })
        setPerizinan([])
        return
      }

      const rows = izinData ?? []
      if (rows.length === 0) {
        setPerizinan([])
        return
      }

      const profileIds = Array.from(new Set(rows.map((r: any) => r.mahasiswa_id).filter(Boolean)))
      let profilesById = new Map<string, any>()
      if (profileIds.length > 0) {
        const { data: проф, error: профErr } = await supabase
          .from('profiles')
          .select('id, nama, nim, unit')
          .in('id', profileIds)

        if (профErr) {
          console.error('Error fetch profiles:', профErr.message, профErr.details, профErr.hint)
        } else {
          profilesById = new Map((проф ?? []).map((p: any) => [p.id, p]))
        }
      }

      const jadwalIds = Array.from(new Set(rows.map((r: any) => r.jadwal_id).filter(Boolean)))
      let jadwalById = new Map<string, any>()
      if (jadwalIds.length > 0) {
        const { data: j, error: jErr } = await supabase
          .from('jadwal_kegiatan')
          .select('id, nama_kegiatan, tanggal')
          .in('id', jadwalIds)

        if (jErr) {
          console.error('Error fetch jadwal_kegiatan:', jErr.message, jErr.details, jErr.hint)
        } else {
          jadwalById = new Map((j ?? []).map((x: any) => [x.id, x]))
        }
      }

      setPerizinan(
        rows.map((r: any) => ({
          ...r,
          profiles: profilesById.get(r.mahasiswa_id) ?? null,
          jadwal_kegiatan: r.jadwal_id ? (jadwalById.get(r.jadwal_id) ?? null) : null,
        }))
      )
    } catch (err) {
      console.error('Unexpected error:', err)
      toast({ title: 'Error', description: 'Terjadi kesalahan saat memuat data', variant: 'destructive' })
      setPerizinan([])
    } finally {
      setLoading(false)
    }
  }, [filterStatus, userReady, user, supabase, toast])

  useEffect(() => { fetchPerizinan() }, [fetchPerizinan])

  const openReview = (izin: any) => {
    setSelectedIzin(izin)
    setCatatan('')
    setBuktiPreviewUrl('')

    const buktiPath = izin?.bukti_foto_url
    if (!buktiPath) return

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(buktiPath)
    setBuktiPreviewUrl(data?.publicUrl ?? '')
  }

  const handleApprove = async (status: 'approved' | 'rejected') => {
    if (!selectedIzin) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('perizinan')
      .update({
        status,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        catatan_admin: catatan,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedIzin.id)

    if (error) {
      toast({ title: 'Error', description: `Gagal memperbarui: ${error.message}`, variant: 'destructive' })
    } else {
      toast({
        title: 'Berhasil',
        description: status === 'approved' ? 'Izin disetujui' : 'Izin ditolak',
        variant: 'success'
      })
      setSelectedIzin(null)
      setCatatan('')
      setBuktiPreviewUrl('')
      fetchPerizinan()
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Perizinan" description="Approve atau tolak perizinan mahasiswa">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
            <SelectItem value="all">Semua</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : perizinan.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">
              {userReady && !user ? 'Silakan login untuk melihat perizinan.' : 'Tidak ada data perizinan.'}
            </p>
          ) : (
            <div className="divide-y">
              {perizinan.map((izin: any) => (
                <div key={izin.id} className="flex items-center justify-between p-4 gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{izin.profiles?.nama ?? '-'}</p>
                      <Badge
                        variant={
                          izin.status === 'pending'
                            ? 'warning'
                            : izin.status === 'approved'
                              ? 'success'
                              : 'destructive'
                        }
                      >
                        {formatLabel(izin.status)}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {izin.profiles?.nim ?? '-'} · {formatLabel(izin.jenis_izin)} · {formatDate(izin.created_at)}
                    </p>

                    {izin.jadwal_kegiatan && (
                      <p className="text-xs text-muted-foreground">
                        Kegiatan: {izin.jadwal_kegiatan.nama_kegiatan}
                      </p>
                    )}
                  </div>

                  {izin.status === 'pending' && (
                    <Button size="sm" className="shrink-0" onClick={() => openReview(izin)}>
                      Review
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedIzin}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedIzin(null)
            setBuktiPreviewUrl('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Review Perizinan</DialogTitle></DialogHeader>

          {selectedIzin && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p><span className="font-medium">Mahasiswa:</span> {selectedIzin.profiles?.nama ?? '-'}</p>
                <p><span className="font-medium">NIM:</span> {selectedIzin.profiles?.nim ?? '-'}</p>
                <p><span className="font-medium">Unit:</span> {formatLabel(selectedIzin.profiles?.unit) ?? '-'}</p>
                <p><span className="font-medium">Jenis:</span> {formatLabel(selectedIzin.jenis_izin)}</p>
                <p><span className="font-medium">Keterangan:</span> {selectedIzin.keterangan ?? '-'}</p>

                {selectedIzin.jadwal_kegiatan && (
                  <p>
                    <span className="font-medium">Kegiatan:</span> {selectedIzin.jadwal_kegiatan.nama_kegiatan} ({formatDate(selectedIzin.jadwal_kegiatan.tanggal)})
                  </p>
                )}

                {selectedIzin.bukti_foto_url ? (
                  <div className="space-y-2 pt-2">
                    <p className="text-sm">
                      <span className="font-medium">Bukti: </span>
                      {buktiPreviewUrl ? (
                        <a href={buktiPreviewUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                          Buka Foto
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Memuat...</span>
                      )}
                    </p>

                    {buktiPreviewUrl ? (
                      <img
                        src={buktiPreviewUrl}
                        alt="Bukti perizinan"
                        className="max-h-64 w-full rounded-md object-contain border bg-white"
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground pt-2">Bukti: -</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Catatan Admin</Label>
                <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan..." />
              </div>

              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleApprove('approved')} disabled={submitting}>
                  <CheckCircle className="mr-2 h-4 w-4" />Setujui
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleApprove('rejected')} disabled={submitting}>
                  <XCircle className="mr-2 h-4 w-4" />Tolak
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