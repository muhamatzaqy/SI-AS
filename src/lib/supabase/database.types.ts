export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; nama: string; nim: string; unit: 'mahad_aly' | 'lkim'; angkatan: number; role: 'pengelola' | 'pengurus' | 'mahasiswa'; is_active: boolean; avatar_url: string | null; created_at: string; updated_at: string }
        Insert: { id: string; nama: string; nim: string; unit: 'mahad_aly' | 'lkim'; angkatan: number; role?: 'pengelola' | 'pengurus' | 'mahasiswa'; is_active?: boolean; avatar_url?: string | null }
        Update: { nama?: string; nim?: string; unit?: 'mahad_aly' | 'lkim'; angkatan?: number; role?: 'pengelola' | 'pengurus' | 'mahasiswa'; is_active?: boolean; avatar_url?: string | null; updated_at?: string }
      }
      jadwal_kegiatan: {
        Row: { id: string; nama_kegiatan: string; jenis: 'ngaji' | 'kegiatan_pengurus' | 'roan' | 'lainnya'; target_unit: 'mahad_aly' | 'lkim' | 'gabungan'; tanggal: string; jam_mulai: string; jam_selesai: string; batas_absen: string | null; wajib_foto: boolean; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; nama_kegiatan: string; jenis: 'ngaji' | 'kegiatan_pengurus' | 'roan' | 'lainnya'; target_unit: 'mahad_aly' | 'lkim' | 'gabungan'; tanggal: string; jam_mulai: string; jam_selesai: string; batas_absen?: string | null; wajib_foto?: boolean; created_by?: string | null }
        Update: { nama_kegiatan?: string; jenis?: 'ngaji' | 'kegiatan_pengurus' | 'roan' | 'lainnya'; target_unit?: 'mahad_aly' | 'lkim' | 'gabungan'; tanggal?: string; jam_mulai?: string; jam_selesai?: string; batas_absen?: string | null; wajib_foto?: boolean; updated_at?: string }
      }
      presensi: {
        Row: { id: string; mahasiswa_id: string; jadwal_id: string; status: 'hadir' | 'izin' | 'alpha'; waktu_absen: string | null; foto_url: string | null; latitude: number | null; longitude: number | null; created_at: string }
        Insert: { id?: string; mahasiswa_id: string; jadwal_id: string; status: 'hadir' | 'izin' | 'alpha'; waktu_absen?: string | null; foto_url?: string | null; latitude?: number | null; longitude?: number | null }
        Update: { status?: 'hadir' | 'izin' | 'alpha'; waktu_absen?: string | null; foto_url?: string | null; latitude?: number | null; longitude?: number | null }
      }
      perizinan: {
        Row: { id: string; mahasiswa_id: string; jadwal_id: string | null; jenis_izin: 'sakit' | 'keperluan_keluarga' | 'akademik' | 'lainnya'; keterangan: string | null; bukti_foto_url: string | null; status: 'pending' | 'approved' | 'rejected'; approved_by: string | null; approved_at: string | null; catatan_admin: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; mahasiswa_id: string; jadwal_id?: string | null; jenis_izin: 'sakit' | 'keperluan_keluarga' | 'akademik' | 'lainnya'; keterangan?: string | null; bukti_foto_url?: string | null; status?: 'pending' | 'approved' | 'rejected'; approved_by?: string | null; catatan_admin?: string | null }
        Update: { jenis_izin?: 'sakit' | 'keperluan_keluarga' | 'akademik' | 'lainnya'; keterangan?: string | null; bukti_foto_url?: string | null; status?: 'pending' | 'approved' | 'rejected'; approved_by?: string | null; approved_at?: string | null; catatan_admin?: string | null; updated_at?: string }
      }
      pembayaran_spp: {
        Row: { id: string; mahasiswa_id: string; semester: string; nominal: number; bukti_bayar_url: string | null; status: 'belum_bayar' | 'menunggu_verifikasi' | 'lunas' | 'ditolak'; verified_by: string | null; verified_at: string | null; catatan: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; mahasiswa_id: string; semester: string; nominal: number; bukti_bayar_url?: string | null; status?: 'belum_bayar' | 'menunggu_verifikasi' | 'lunas' | 'ditolak'; verified_by?: string | null; catatan?: string | null }
        Update: { bukti_bayar_url?: string | null; status?: 'belum_bayar' | 'menunggu_verifikasi' | 'lunas' | 'ditolak'; verified_by?: string | null; verified_at?: string | null; catatan?: string | null; updated_at?: string }
      }
      pelanggaran: {
        Row: { id: string; mahasiswa_id: string; nama_pelanggaran: string; poin: number; bukti_foto_url: string | null; keterangan: string | null; sanksi: string | null; sudah_dijalankan: boolean; dicatat_oleh: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; mahasiswa_id: string; nama_pelanggaran: string; poin?: number; bukti_foto_url?: string | null; keterangan?: string | null; sanksi?: string | null; sudah_dijalankan?: boolean; dicatat_oleh?: string | null }
        Update: { nama_pelanggaran?: string; poin?: number; bukti_foto_url?: string | null; keterangan?: string | null; sanksi?: string | null; sudah_dijalankan?: boolean; updated_at?: string }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
