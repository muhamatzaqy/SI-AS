import { z } from 'zod'
export const perizinanSchema = z.object({
  jadwal_id: z.string().optional(),
  jenis_izin: z.enum(['sakit', 'keperluan_keluarga', 'akademik', 'lainnya']),
  keterangan: z.string().min(10, 'Keterangan minimal 10 karakter'),
})
export type PerizinanFormData = z.infer<typeof perizinanSchema>
