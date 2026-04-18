'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function MonitoringPage() {
  const [pelanggaran, setPelanggaran] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const supabase = createClient()

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase.from('pelanggaran').select('*, profiles(nama, nim)').eq('sudah_dijalankan', false).order('created_at', { ascending: false })
    setPelanggaran(data ?? [])
    setLoading(false)
  }
  useEffect(() => { fetchData() }, []) // eslint-disable-line

  const markDone = async (id: string) => {
    await supabase.from('pelanggaran').update({ sudah_dijalankan: true, updated_at: new Date().toISOString() }).eq('id', id)
    toast({ title: 'Berhasil', description: 'Sanksi ditandai selesai', variant: 'success' })
    fetchData()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Monitoring Sanksi" description="Pantau status pelaksanaan sanksi" />
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="space-y-3 p-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          : pelanggaran.length === 0 ? <p className="p-6 text-center text-muted-foreground">Semua sanksi sudah dijalankan! 🎉</p>
          : <div className="divide-y">{pelanggaran.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
              <div className="space-y-1 min-w-0">
                <p className="font-medium text-sm">{p.profiles?.nama ?? '-'} — {p.nama_pelanggaran}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{p.profiles?.nim} · {p.poin} poin · Sanksi: {p.sanksi ?? '-'} · {formatDate(p.created_at)}</p>
              </div>
              <Button size="sm" className="shrink-0" onClick={() => markDone(p.id)}><CheckCircle className="mr-1 sm:mr-2 h-4 w-4" /><span className="hidden sm:inline">Selesai</span><span className="sm:hidden">OK</span></Button>
            </div>
          ))}</div>}
        </CardContent>
      </Card>
    </div>
  )
}
export const dynamic = 'force-dynamic'
