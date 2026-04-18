'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { perizinanSchema, type PerizinanFormData } from '@/lib/validations/perizinan'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { JENIS_IZIN_OPTIONS, IMAGE_COMPRESSION_OPTIONS } from '@/lib/constants'
import { Plus, Loader2 } from 'lucide-react'
import { formatDate, formatLabel } from '@/lib/utils'

const BUCKET = 'permit-photos'

export default function PerizinanMahasiswaPage() {
  const [perizinan, setPerizinan] = useState<any[]>([])
  const [jadwals, setJadwals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [buktiFile, setBuktiFile] = useState<File | null>(null)

  const { toast } = useToast()
  const supabase = createClient()
  const { register, handleSubmit, control, reset } = useForm<PerizinanFormData>({
    resolver: zodResolver(perizinanSchema)
  })

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setPerizinan([])
      setJadwals([])
      setLoading(false)
      return
    }

    const [{ data: p, error: pErr }, { data: j, error: jErr }] = await Promise.all([
      supabase
        .from('perizinan')
        .select('*, jadwal_kegiatan(id, nama_kegiatan, tanggal)')
        .eq('mahasiswa_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('jadwal_kegiatan')
        .select('id, nama_kegiatan, tanggal')
        .gte('tanggal', new Date().toISOString().split('T')[0]),
    ])

    if (pErr) console.error('fetch perizinan error:', pErr)
    if (jErr) console.error('fetch jadwal error:', jErr)

    setPerizinan(p ?? [])
    setJadwals(j ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, []) // eslint-disable-line

  const onSubmit = async (data: PerizinanFormData) => {
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let buktiPath: string | null = null

      if (buktiFile) {
        const imageCompression = (await import('browser-image-compression')).default
        const compressed = await imageCompression(buktiFile, IMAGE_COMPRESSION_OPTIONS)

        const ext = (buktiFile.name.split('.').pop() || 'jpg').toLowerCase()
        const filePath = `${user.id}/${Date.now()}.${ext}`

        const { data: uploaded, error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, compressed, {
            upsert: true,
            contentType: compressed.type || buktiFile.type || 'image/jpeg',
          })

        if (uploadErr) {
          console.error('upload error:', uploadErr)
          toast({ title: 'Error', description: `Upload bukti gagal: ${uploadErr.message}`, variant: 'destructive' })
          return
        }

        buktiPath = uploaded.path
      }

      const payload = {
        mahasiswa_id: user.id,
        jadwal_id: data.jadwal_id === 'none' ? null : (data.jadwal_id || null),
        jenis_izin: data.jenis_izin,
        keterangan: data.keterangan,
        bukti_foto_url: buktiPath,
        status: 'pending',
      }

      const { error: insErr } = await supabase.from('perizinan').insert(payload)
      if (insErr) {
        console.error('insert error:', insErr)
        toast({ title: 'Error', description: `Gagal mengajukan izin: ${insErr.message}`, variant: 'destructive' })
        return
      }

      toast({ title: 'Berhasil', description: 'Izin diajukan', variant: 'success' })
      setDialogOpen(false)
      reset()
      setBuktiFile(null)
      fetchData()
    } catch (e) {
      console.error(e)
      toast({ title: 'Error', description: 'Gagal mengajukan izin', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Perizinan" description="Ajukan dan pantau perizinan">
        <Button onClick={() => { reset(); setBuktiFile(null); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />Ajukan Izin
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : perizinan.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Belum ada riwayat perizinan.</p>
          ) : (
            <div className="divide-y">
              {perizinan.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <p className="font-medium">{formatLabel(p.jenis_izin)}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.jadwal_kegiatan ? `${p.jadwal_kegiatan.nama_kegiatan} · ${formatDate(p.jadwal_kegiatan.tanggal)}` : formatDate(p.created_at)}
                    </p>
                  </div>
                  <Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'destructive' : 'warning'}>
                    {formatLabel(p.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajukan Izin</DialogTitle></DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Kegiatan (Opsional)</Label>
              <Controller
                control={control}
                name="jadwal_id"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || 'none'}>
                    <SelectTrigger><SelectValue placeholder="Pilih kegiatan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak terkait kegiatan</SelectItem>
                      {jadwals.map((j: any) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.nama_kegiatan} — {formatDate(j.tanggal)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Jenis Izin</Label>
              <Controller
                control={control}
                name="jenis_izin"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                    <SelectContent>
                      {JENIS_IZIN_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea {...register('keterangan')} placeholder="Jelaskan alasan izin..." />
            </div>

            <div className="space-y-2">
              <Label>Bukti (Foto Surat) (Opsional)</Label>
              <Input type="file" accept="image/*" onChange={e => setBuktiFile(e.target.files?.[0] ?? null)} />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ajukan Izin
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const dynamic = 'force-dynamic'