import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // Buat safeProfile untuk mencegah komponen anak (DashboardLayout) crash 
  // jika ada properti seperti 'nama' yang masih bernilai null pada login pertama.
  const safeProfile = {
    ...profile,
    nama: profile.nama ?? 'Mahasiswa',
    nim: profile.nim ?? '-',
    unit: profile.unit ?? 'mahad_aly',
  }

  return (
    <DashboardLayout user={safeProfile}>
      {children}
    </DashboardLayout>
  )
}
