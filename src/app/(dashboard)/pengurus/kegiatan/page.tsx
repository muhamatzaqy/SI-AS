'use client'
import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { type JadwalKegiatan } from '@/types'
import { jadwalSchema, type JadwalFormData } from '@/lib/validations/jadwal'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { JENIS_KEGIATAN_OPTIONS, UNIT_OPTIONS, KEGIATAN_PENGURUS_OPTIONS } from '@/lib/constants'
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { formatDate, formatLabel } from '@/lib/utils'

export default function KegiatanPage() {
  const [kegiatan, setKegiatan] = useState<JadwalKegiatan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKegiatan, setEditingKegiatan] = useState<JadwalKegiatan | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [namaManual, setNamaManual] = useState('')
  const [selectedKegiatanPengurus, setSelectedKegiatanPengurus] = useState('')
  
  // ✅ Mark Alpha state
  const [markAlphaDialogOpen, setMarkAlphaDialogOpen] = useState(false)
  const [selectedKegiatanForAlpha, setSelectedKegiatanForAlpha] = useState<JadwalKegiatan | null>(null)
  const [markAlphaLoading, setMarkAlphaLoading] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()
  const { register, handleSubmit, setValue, reset, watch, control, formState: { errors } } = useForm<JadwalFormData>({ 
    resolver: zodResolver(jadwalSchema), 
    defaultValues: { wajib_foto: false } 
  })
  const wajibFoto = watch('wajib_foto')
  const selectedJenis = watch('jenis')

  const fetchKegiatan = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('jadwal_kegiatan')
      .select('*')
      .neq('jenis', 'ngaji')
      .order('tanggal', { ascending: false })
    setKegiatan(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchKegiatan() }, []) // eslint-disable-line

  // ✅ Check if kegiatan is finished (past jam_selesai)
  const isKegiatanFinished = (k: JadwalKegiatan): boolean => {
    try {
      const now = new Date()
      const kegiatanDate = new Date(k.tanggal)
      
      if (kegiatanDate > now) return false
      
      if (kegiatanDate.toDateString() === now.toDateString()) {
        const [hour, min] = k.jam_selesai.split(':').map(Number)
        const jamSelesaiDate = new Date(now)
        jamSelesaiDate.setHours(hour, min, 0, 0)
        return now > jamSelesaiDate
      }
      
      return true
    } catch (error) {
      console.error('Error checking kegiatan finished:', error)
      return false
    }
  }

  // ✅ Mark Alpha handler
  const handleMarkAlpha = async () => {
    if (!selectedKegiatanForAlpha) return
    
    setMarkAlphaLoading(true)
    try {
      const response = await fetch('/api/attendance/mark-alpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jadwal_id: selectedKegiatanForAlpha.id })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark alpha')
      }

      toast({
        title: 'Success! ✅',
        description: `${data.alphaCreated} mahasiswa marked as ALPHA, ${data.skipped} skipped (sudah hadir/izin/alpha)`,
        variant: 'success'
      })

      console.log('Mark Alpha Result:', data)
      setMarkAlphaDialogOpen(false)
      setSelectedKegiatanForAlpha(null)
      fetchKegiatan()

    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark alpha',
        variant: 'destructive'
      })
    } finally {
      setMarkAlphaLoading(false)
    }
  }

  const checkConflict = async (tanggal: string, jamMulai: string, jamSelesai: string, excludeId?: string) => {
    const { data: ngajiJadwal } = await supabase
      .from('jadwal_kegiatan')
      .select('*')
      .eq('jenis', 'ngaji')
      .eq('tanggal', tanggal)
    return (ngajiJadwal ?? []).some((j: any) => {
      if (excludeId && j.id === excludeId) return false
      return !(jamSelesai <= j.jam_mulai || jamMulai >= j.jam_selesai)
    })
  }

  const onSubmit = async (data: JadwalFormData) => {
    setSubmitting(true)
    try {
      const hasConflict = await checkConflict(data.tanggal, data.jam_mulai, data.jam_selesai, editingKegiatan?.id)
      if (hasConflict) {
        toast({
          title: 'Konflik Jadwal',
          description: 'Waktu bertabrakan dengan jadwal ngaji!',
          variant: 'destructive'
        })
        setSubmitting(false)
        return
      }
      const payload = { ...data, batas_absen: data.batas_absen || null, updated_at: new Date().toISOString() }
      if (editingKegiatan) {
        const { error } = await supabase.from('jadwal_kegiatan').update(payload).eq('id', editingKegiatan.id)
        if (error) throw error
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('jadwal_kegiatan').insert({ ...payload, created_by: user?.id })
        if (error) throw error
      }
      toast({ title: 'Berhasil', description: 'Kegiatan tersimpan', variant: 'success' })
      setDialogOpen(false)
      fetchKegiatan()
    } catch {
      toast({ title: 'Error', description: 'Gagal menyimpan', variant: 'destructive' })
    }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus kegiatan ini?')) return
    await supabase.from('jadwal_kegiatan').delete().eq('id', id)
    fetchKegiatan()
    toast({ title: 'Berhasil', description: 'Kegiatan dihapus', variant: 'success' })
  }

  const openCreate = () => {
    setEditingKegiatan(null)
    setSelectedKegiatanPengurus('')
    setNamaManual('')
    reset({ wajib_foto: false })
    setDialogOpen(true)
  }

  const openEdit = (k: JadwalKegiatan) => {
    setEditingKegiatan(k)
    setNamaManual('')
    
    if (k.jenis === 'kegiatan_pengurus') {
      const isKnownKegiatan = KEGIATAN_PENGURUS_OPTIONS.some(opt => opt.value === k.nama_kegiatan)
      setSelectedKegiatanPengurus(isKnownKegiatan ? k.nama_kegiatan : 'Lainnya')
      if (!isKnownKegiatan) setNamaManual(k.nama_kegiatan)
    } else {
      setSelectedKegiatanPengurus('')
    }
    
    reset({
      nama_kegiatan: k.nama_kegiatan,
      jenis: k.jenis as any,
      target_unit: k.target_unit,
      tanggal: k.tanggal,
      jam_mulai: k.jam_mulai,
      jam_selesai: k.jam_selesai,
      batas_absen: k.batas_absen ?? '',
      wajib_foto: k.wajib_foto
    })
    setDialogOpen(true)
  }

  const handleKegiatanPengurusChange = (val: string) => {
    setSelectedKegiatanPengurus(val)
    if (val !== 'Lainnya') {
      setValue('nama_kegiatan', val)
      setNamaManual('')
    } else {
      setValue('nama_kegiatan', namaManual)
    }
  }

  const handleNamaManualChange = (val: string) => {
    setNamaManual(val)
    setValue('nama_kegiatan', val)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Manajemen Kegiatan" description="Kelola kegiatan non-ngaji">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Kegiatan
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : kegiatan.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Belum ada kegiatan.</p>
          ) : (
            <div className="divide-y">
              {kegiatan.map(k => {
                const finished = isKegiatanFinished(k)

                return (
                  <div key={k.id} className="flex items-center justify-between p-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{k.nama_kegiatan}</p>
                        <Badge variant="secondary">{formatLabel(k.jenis)}</Badge>
                        {k.wajib_foto && <Badge variant="info">Foto Wajib</Badge>}
                        
                        {finished ? (
                          <Badge variant="destructive" className="text-xs">Selesai</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Berlangsung</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(k.tanggal)} · {k.jam_mulai}–{k.jam_selesai} · {formatLabel(k.target_unit)}
                      </p>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {finished && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setSelectedKegiatanForAlpha(k)
                            setMarkAlphaDialogOpen(true)
                          }}
                          title="Mark mahasiswa as ALPHA"
                        >
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                        </Button>
                      )}

                      <Button variant="ghost" size="icon" onClick={() => openEdit(k)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(k.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ Mark Alpha Dialog */}
      {markAlphaDialogOpen && selectedKegiatanForAlpha && (
        <Dialog open={markAlphaDialogOpen} onOpenChange={setMarkAlphaDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mark attendance as ALPHA?</DialogTitle>
              <DialogDescription>
                Mark all mahasiswa who didn't attend this activity as ALPHA.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 space-y-2">
                <p className="text-sm font-medium text-orange-900">
                  {selectedKegiatanForAlpha.nama_kegiatan}
                </p>
                <p className="text-xs text-orange-700">
                  {formatDate(selectedKegiatanForAlpha.tanggal)} · {selectedKegiatanForAlpha.jam_mulai}–{selectedKegiatanForAlpha.jam_selesai}
                </p>
                <p className="text-xs text-orange-600">
                  Target: {formatLabel(selectedKegiatanForAlpha.target_unit)}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-medium">Filtering:</p>
                <ul className="text-xs text-gray-700 space-y-1 ml-4 list-disc">
                  <li>Only role "mahasiswa"</li>
                  {selectedKegiatanForAlpha.target_unit === 'gabungan' ? (
                    <>
                      <li>Unit: Ma'had Aly + LKIM</li>
                    </>
                  ) : (
                    <li>Unit: {formatLabel(selectedKegiatanForAlpha.target_unit)}</li>
                  )}
                </ul>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-medium">Will be skipped:</p>
                <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc bg-blue-50 border border-blue-200 p-3 rounded">
                  <li>Mahasiswa with status "Hadir"</li>
                  <li>Mahasiswa with status "Izin"</li>
                  <li>Mahasiswa with status "Alpha"</li>
                </ul>
              </div>

              <p className="text-xs text-gray-600">
                Only mahasiswa with NO attendance record will be marked as ALPHA.
              </p>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMarkAlphaDialogOpen(false)
                    setSelectedKegiatanForAlpha(null)
                  }}
                  disabled={markAlphaLoading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleMarkAlpha}
                  disabled={markAlphaLoading}
                >
                  {markAlphaLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Confirm
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Form Dialog - Create/Edit Kegiatan */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingKegiatan ? 'Edit Kegiatan' : 'Tambah Kegiatan'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Controller
                  control={control}
                  name="jenis"
                  render={({ field }) => (
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v)
                        setSelectedKegiatanPengurus('')
                        setNamaManual('')
                        setValue('nama_kegiatan', '')
                      }}
                      value={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis" />
                      </SelectTrigger>
                      <SelectContent>
                        {JENIS_KEGIATAN_OPTIONS.filter(o => o.value !== 'ngaji').map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Target Unit</Label>
                <Controller
                  control={control}
                  name="target_unit"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gabungan">Gabungan</SelectItem>
                        {UNIT_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {selectedJenis === 'kegiatan_pengurus' ? (
              <div className="space-y-2">
                <Label>Pilih Kegiatan Pengurus</Label>
                <Select onValueChange={handleKegiatanPengurusChange} value={selectedKegiatanPengurus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kegiatan" />
                  </SelectTrigger>
                  <SelectContent>
                    {KEGIATAN_PENGURUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedKegiatanPengurus === 'Lainnya' && (
                  <Input
                    value={namaManual}
                    onChange={e => handleNamaManualChange(e.target.value)}
                    placeholder="Tulis nama kegiatan..."
                  />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Nama Kegiatan</Label>
                <Input {...register('nama_kegiatan')} placeholder="Nama kegiatan" />
              </div>
            )}

            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input {...register('tanggal')} type="date" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input {...register('jam_mulai')} type="time" />
              </div>
              <div className="space-y-2">
                <Label>Jam Selesai</Label>
                <Input {...register('jam_selesai')} type="time" />
              </div>
              <div className="space-y-2">
                <Label>Batas Absen</Label>
                <Input {...register('batas_absen')} type="time" />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-3">
              <input
                type="checkbox"
                id="wajib_foto"
                checked={wajibFoto}
                onChange={e => setValue('wajib_foto', e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="wajib_foto" className="cursor-pointer">
                Wajib Foto Selfie
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingKegiatan ? 'Simpan Perubahan' : 'Tambah Kegiatan'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const dynamic = 'force-dynamic'
