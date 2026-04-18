import { z } from 'zod'
export const jadwalSchema = z.object({
  nama_kegiatan: z.string().min(3),
  jenis: z.enum(['ngaji', 'kegiatan_pengurus', 'roan', 'lainnya']),
  target_unit: z.enum(['mahad_aly', 'lkim', 'gabungan']),
  tanggal: z.string().min(1),
  jam_mulai: z.string().min(1),
  jam_selesai: z.string().min(1),
  batas_absen: z.string().optional(),
  wajib_foto: z.boolean().default(false),
})
export type JadwalFormData = z.infer<typeof jadwalSchema>
