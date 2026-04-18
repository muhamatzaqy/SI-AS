'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatLabel } from '@/lib/utils'
import { Upload, Loader2 } from 'lucide-react'
import { IMAGE_COMPRESSION_OPTIONS } from '@/lib/constants'

export default function KeuanganMahasiswaPage() {
  const [spps, setSpps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const { toast } = useToast()
  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('pembayaran_spp').select('*').eq('mahasiswa_id', user.id).order('created_at', { ascending: false })
    setSpps(data ?? [])
    setLoading(false)
  }
  useEffect(() => { fetchData() }, []) // eslint-disable-line

  const handleUploadBukti = async (sppId: string, file: File) => {
    setUploadingId(sppId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const imageCompression = (await import('browser-image-compression')).default
      const compressed = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS)
      const { data: uploaded } = await supabase.storage.from('payment-proofs').upload(`${user.id}/${Date.now()}.jpg`, compressed, { contentType: 'image/jpeg' })
      if (uploaded) {
        const buktiUrl = supabase.storage.from('payment-proofs').getPublicUrl(uploaded.path).data.publicUrl
        await supabase.from('pembayaran_spp').update({ bukti_bayar_url: buktiUrl, status: 'menunggu_verifikasi', updated_at: new Date().toISOString() }).eq('id', sppId)
        toast({ title: 'Berhasil', description: 'Bukti bayar dikirim. Menunggu verifikasi.', variant: 'success' })
        fetchData()
      }
    } catch { toast({ title: 'Error', description: 'Gagal upload bukti', variant: 'destructive' }) }
    finally { setUploadingId(null) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Keuangan SPP" description="Lihat tagihan dan upload bukti pembayaran" />
      {loading ? <div className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      : spps.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">Belum ada tagihan SPP.</CardContent></Card>
      : spps.map((spp: any) => (
        <Card key={spp.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{spp.semester}</CardTitle>
              <Badge variant={spp.status === 'lunas' ? 'success' : spp.status === 'menunggu_verifikasi' ? 'warning' : spp.status === 'ditolak' ? 'destructive' : 'secondary'}>{formatLabel(spp.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3xl font-bold text-primary">{formatCurrency(spp.nominal)}</p>
            {spp.bukti_bayar_url && <p className="text-sm"><a href={spp.bukti_bayar_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Lihat bukti yang dikirim</a></p>}
            {spp.catatan && <p className="text-sm text-muted-foreground">Catatan admin: {spp.catatan}</p>}
            {(spp.status === 'belum_bayar' || spp.status === 'ditolak') && (
              <div className="flex items-center gap-3">
                <Input type="file" accept="image/*" className="flex-1" onChange={e => { if (e.target.files?.[0]) handleUploadBukti(spp.id, e.target.files[0]) }} disabled={uploadingId === spp.id} />
                {uploadingId === spp.id && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
export const dynamic = 'force-dynamic'
