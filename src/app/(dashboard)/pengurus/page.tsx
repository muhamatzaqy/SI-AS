import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/shared/stat-card'
import { PageHeader } from '@/components/shared/page-header'
import { Calendar, AlertTriangle, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function PengurusDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'pengurus') redirect(`/${profile?.role ?? 'login'}`)
  const [{ count: totalKegiatan }, { count: totalPelanggaran }, { count: belumDijalankan }] = await Promise.all([
    supabase.from('jadwal_kegiatan').select('*', { count: 'exact', head: true }).neq('jenis', 'ngaji'),
    supabase.from('pelanggaran').select('*', { count: 'exact', head: true }),
    supabase.from('pelanggaran').select('*', { count: 'exact', head: true }).eq('sudah_dijalankan', false),
  ])
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard Pengurus" description={`Hari ini ${formatDate(new Date())}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Kegiatan" value={totalKegiatan ?? 0} icon={Calendar} />
        <StatCard title="Total Pelanggaran" value={totalPelanggaran ?? 0} icon={AlertTriangle} iconClassName="bg-red-100" />
        <StatCard title="Sanksi Belum Dijalankan" value={belumDijalankan ?? 0} icon={Eye} iconClassName="bg-yellow-100" />
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'
