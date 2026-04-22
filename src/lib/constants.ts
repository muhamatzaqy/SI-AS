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
  { value: 'Nahwu', label: 'Nahwu' },
  { value: 'Nashoihul Ibad', label: 'Nashoihul Ibad' },
  { value: "Mauidlotul Mu'minin", label: "Mauidlotul Mu'minin" },
  { value: 'Shorof', label: 'Shorof' },
  { value: 'Risalatul Barokah', label: 'Risalatul Barokah' },
  { value: 'Tuhfatuttullab', label: 'Tuhfatuttullab' },
  { value: 'Riyadhus Shalihin', label: 'Riyadhus Shalihin' },
  { value: 'Tafsir Jalalain', label: 'Tafsir Jalalain' },
  { value: 'Tajwid', label: 'Tajwid' },
  { value: 'Mafahim', label: 'Mafahim' },
  { value: 'Sorogan', label: 'Sorogan' },
  { value: 'Lainnya', label: 'Lainnya' },
] as const

export const SPP_NOMINAL: Record<string, number> = { mahad_aly: 500000, lkim: 600000 }
export const CURRENT_SEMESTER = '2024/2025 Ganjil'
export const IMAGE_COMPRESSION_OPTIONS = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true }
