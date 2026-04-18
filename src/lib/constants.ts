export const UNIT_OPTIONS = [
  { value: 'mahad_aly', label: "Ma'had Aly" },
  { value: 'lkim', label: 'LKIM' },
] as const

export const ROLE_OPTIONS = [
  { value: 'mahasiswa', label: 'Mahasiswa' },
  { value: 'pengurus', label: 'Pengurus' },
  { value: 'pengelola', label: 'Pengelola' },
] as const

export const JENIS_KEGIATAN_OPTIONS = [
  { value: 'ngaji', label: 'Ngaji' },
  { value: 'kegiatan_pengurus', label: 'Kegiatan Pengurus' },
  { value: 'roan', label: 'Roan' },
  { value: 'lainnya', label: 'Lainnya' },
] as const

export const KEGIATAN_PENGURUS_OPTIONS = [
  { value: 'Rutinan Malam Jumat', label: "Rutinan Malam Jum'at" },
  { value: 'Maqbaroh', label: 'Maqbaroh' },
  { value: 'Lainnya', label: 'Lainnya' },
] as const

export const JENIS_IZIN_OPTIONS = [
  { value: 'sakit', label: 'Sakit' },
  { value: 'keperluan_keluarga', label: 'Keperluan Keluarga' },
  { value: 'akademik', label: 'Akademik' },
  { value: 'lainnya', label: 'Lainnya' },
] as const

export const KITAB_NGAJI_OPTIONS = [
  { value: 'Fathul Qorib', label: 'Fathul Qorib' },
  { value: 'Safinatun Najah', label: 'Safinatun Najah' },
  { value: 'Taqrib', label: 'Taqrib' },
  { value: "Ta'lim Muta'alim", label: "Ta'lim Muta'alim" },
  { value: 'Jurumiyah', label: 'Jurumiyah' },
  { value: 'Amtsilati', label: 'Amtsilati' },
  { value: 'Bulughul Maram', label: 'Bulughul Maram' },
  { value: 'Riyadhus Shalihin', label: 'Riyadhus Shalihin' },
  { value: 'Ihya Ulumiddin', label: 'Ihya Ulumiddin' },
  { value: 'Alfiyah Ibnu Malik', label: 'Alfiyah Ibnu Malik' },
  { value: 'Lainnya', label: 'Lainnya' },
] as const

export const SPP_NOMINAL: Record<string, number> = { mahad_aly: 500000, lkim: 600000 }
export const CURRENT_SEMESTER = '2024/2025 Ganjil'
export const IMAGE_COMPRESSION_OPTIONS = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true }
