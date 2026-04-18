import { Database } from '@/lib/supabase/database.types'
export type Profile = Database['public']['Tables']['profiles']['Row']
export type JadwalKegiatan = Database['public']['Tables']['jadwal_kegiatan']['Row']
export type Presensi = Database['public']['Tables']['presensi']['Row']
export type Perizinan = Database['public']['Tables']['perizinan']['Row']
export type PembayaranSpp = Database['public']['Tables']['pembayaran_spp']['Row']
export type Pelanggaran = Database['public']['Tables']['pelanggaran']['Row']
