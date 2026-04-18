import { z } from 'zod'
export const pelanggaranSchema = z.object({
  mahasiswa_id: z.string().uuid(),
  nama_pelanggaran: z.string().min(3),
  poin: z.number().min(1).max(100),
  keterangan: z.string().optional(),
  sanksi: z.string().optional(),
})
export type PelanggaranFormData = z.infer<typeof pelanggaranSchema>
