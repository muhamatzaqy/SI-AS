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
import { JENIS_KEGIATAN_OPTIONS, UNIT_OPTIONS, KITAB_NGAJI_OPTIONS, KEGIATAN_PENGURUS_OPTIONS } from '@/lib/constants'
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { formatDate, formatLabel } from '@/lib/utils'

export default function JadwalPage() {
  const [jadwals, setJadwals] = useState<JadwalKegiatan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingJadwal, setEditingJadwal] = useState<JadwalKegiatan | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [namaManual, setNamaManual] = useState('')
  const [selectedKitab, setSelectedKitab] = useState('')
  const [selectedKegiatanPengurus, setSelectedKegiatanPengurus] = useState('')
  
  // ✅ Mark Alpha state
  const [markAlpaDialogOpen, setMarkAlpaDialogOpen] = useState(false)
  const [selectedJadwalForAlpha, setSelectedJadwalForAlpha] = useState<JadwalKegiatan | null>(null)
  const [markAlpaLoading, setMarkAlpaLoading] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()
  const { register, handleSubmit, setValue, reset, watch, control, formState: { errors } } = useForm<JadwalFormData>({ 
    resolver: zodResolver(jadwalSchema), 
    defaultValues: { wajib_foto: false } 
  })
  const wajibFoto = watch('wajib_foto')
  const selectedJenis = watch('jenis')

  const fetchJadwals = async () => {
    setLoading(true)
    const { data } = await supabase.from('jadwal_kegiatan').select('*').order('tanggal', { ascending: false })
    setJadwals(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchJadwals() }, []) // eslint-disable-line

  // ✅ Check if jadwal is finished (past jam_selesai)
  const isJadwalFinished = (jadwal: JadwalKegiatan): boolean => {
    try {
      const now = new Date()
      const jadwalDate = new Date(jadwal.tanggal)
      
      // If jadwal is in the future, it's not finished
      if (jadwalDate > now) return false
      
      // If jadwal is today, check if past jam_selesai
      if (jadwalDate.toDateString() === now.toDateString()) {
        const [hour, min] = jadwal.jam_selesai.split(':').map(Number)
        const jamSelesaiDate = new Date(now)
        jamSelesaiDate.setHours(hour, min, 0, 0)
        
        return now > jamSelesaiDate
      }
      
      // If jadwal is in the past, it's finished
      return true
    } catch (error) {
      console.error('Error checking jadwal finished:', error)
      return false
    }
  }

  // ✅ Mark Alpha handler
  const handleMarkAlpha = async () => {
    if (!selectedJadwalForAlpha) return
    
    setMarkAlpaLoading(true)
    try {
      const response = await fetch('/api/attendance/mark-alpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jadwal_id: selectedJadwalForAlpha.id })
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
      setMarkAlpaDialogOpen(false)
      setSelectedJadwalForAlpha(null)
      fetchJadwals()

    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark alpha',
        variant: 'destructive'
      })
    } finally {
      setMarkAlpaLoading(false)
    }
  }

  const onSubmit = async (data: JadwalFormData) => {
    setSubmitting(true)
    try {
      const payload = { ...data, batas_absen: data.batas_absen || null, updated_at: new Date().toISOString() }
      if (editingJadwal) {
        const { error } = await supabase.from('jadwal_kegiatan').update(payload).eq('id', editingJadwal.id)
        if (error) throw error
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('jadwal_kegiatan').insert({ ...payload, created_by: user?.id })
        if (error) throw error
      }
      toast({ title: 'Berhasil', description: 'Jadwal tersimpan', variant: 'success' })
      setDialogOpen(false); fetchJadwals()
    } catch { toast({ title: 'Error', description: 'Gagal menyimpan', variant: 'destructive' }) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin hapus jadwal ini?')) return
    await supabase.from('jadwal_kegiatan').delete().eq('id', id)
    fetchJadwals()
    toast({ title: 'Berhasil', description: 'Jadwal dihapus', variant: 'success' })
  }

  const openCreate = () => {
    setEditingJadwal(null)
    setSelectedKitab('')
    setSelectedKegiatanPengurus('')
    setNamaManual('')
    reset({ wajib_foto: false })
    setDialogOpen(true)
  }

  const openEdit = (j: JadwalKegiatan) => {
    setEditingJadwal(j)
    setNamaManual('')
    if (j.jenis === 'ngaji') {
      const isKnownKitab = KITAB_NGAJI_OPTIONS.some(k => k.value === j.nama_kegiatan)
      setSelectedKitab(isKnownKitab ? j.nama_kegiatan : 'Lainnya')
      if (!isKnownKitab) setNamaManual(j.nama_kegiatan)
      setSelectedKegiatanPengurus('')
    } else if (j.jenis === 'kegiatan_pengurus') {
      const isKnownKegiatan = KEGIATAN_PENGURUS_OPTIONS.some(k => k.value === j.nama_kegiatan)
      setSelectedKegiatanPengurus(isKnownKegiatan ? j.nama_kegiatan : 'Lainnya')
      if (!isKnownKegiatan) setNamaManual(j.nama_kegiatan)
      setSelectedKitab('')
    } else {
      setSelectedKitab('')
      setSelectedKegiatanPengurus('')
    }
    reset({ nama_kegiatan: j.nama_kegiatan, jenis: j.jenis as any, target_unit: j.target_unit, tanggal: j.tanggal, jam_mulai: j.jam_mulai, jam_selesai: j.jam_selesai, batas_absen: j.batas_absen ?? '', wajib_foto: j.wajib_foto })
    setDialogOpen(true)
  }

  const handleKitabChange = (val: string) => {
    setSelectedKitab(val)
    if (val !== 'Lainnya') {
      setValue('nama_kegiatan', val)
      setNamaManual('')
    } else {
      setValue('nama_kegiatan', namaManual)
    }
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
      <PageHeader title="Jadwal Kegiatan" description="Kelola jadwal ngaji dan kegiatan">
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Tambah Jadwal</Button>
      </PageHeader>
      
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : jadwals.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Belum ada jadwal.</p>
          ) : (
            <div className="divide-y">
              {jadwals.map(j => {
                const finished = isJadwalFinished(j)
                
                return (
                  <div key={j.id} className="flex items-center justify-between p-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{j.nama_kegiatan}</p>
                        <Badge variant="secondary">{formatLabel(j.jenis)}</Badge>
                        {j.wajib_foto && <Badge variant="info">Foto Wajib</Badge>}
                        
                        {/* ✅ Status badge - finished or ongoing */}
                        {finished ? (
                          <Badge variant="destructive" className="text-xs">Selesai</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Berlangsung</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(j.tanggal)} · {j.jam_mulai}–{j.jam_selesai} · {formatLabel(j.target_unit)}
                      </p>
                    </div>
                    
                    <div className="flex gap-1 shrink-0">
                      {/* ✅ Mark Alpha button - only show for finished jadwal */}
                      {finished && (
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => {
                            setSelectedJadwalForAlpha(j)
                            setMarkAlpaDialogOpen(true)
                          }}
                          title="Mark mahasiswa as ALPHA"
                        >
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                        </Button>
                      )}
                      
                      <Button variant="ghost" size="icon" onClick={() => openEdit(j)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(j.id)}>
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
{markAlpaDialogOpen && selectedJadwalForAlpha && (
  <Dialog open={markAlpaDialogOpen} onOpenChange={setMarkAlpaDialogOpen}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Mark attendance as ALPHA?</DialogTitle>
        <DialogDescription>
          Mark all mahasiswa who didn't attend this activity as ALPHA
        </DialogDescription>
      </DialogHeader>
            
            {/* ✅ Description for accessibility */}
            <p className="text-sm text-muted-foreground">
              Mark all mahasiswa who didn't attend this activity as ALPHA.
            </p>
            
            <div className="space-y-4">
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 space-y-2">
                <p className="text-sm font-medium text-orange-900">
                  {selectedJadwalForAlpha.nama_kegiatan}
                </p>
                <p className="text-xs text-orange-700">
                  {formatDate(selectedJadwalForAlpha.tanggal)} · {selectedJadwalForAlpha.jam_mulai}–{selectedJadwalForAlpha.jam_selesai}
                </p>
                <p className="text-xs text-orange-600">
                  Target: {formatLabel(selectedJadwalForAlpha.target_unit)}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="font-medium">Filtering:</p>
                <ul className="text-xs text-gray-700 space-y-1 ml-4 list-disc">
                  <li>Only role "mahasiswa"</li>
                  {selectedJadwalForAlpha.target_unit === 'gabungan' ? (
                    <>
                      <li>Unit: Mahad Aly + LKIM</li>
                    </>
                  ) : (
                    <li>Unit: {formatLabel(selectedJadwalForAlpha.target_unit)}</li>
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
                    setMarkAlpaDialogOpen(false)
                    setSelectedJadwalForAlpha(null)
                  }}
                  disabled={markAlpaLoading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleMarkAlpha}
                  disabled={markAlpaLoading}
                >
                  {markAlpaLoading ? (
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

      {/* Form Dialog - Create/Edit Jadwal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJadwal ? 'Edit Jadwal' : 'Tambah Jadwal'}</DialogTitle>
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
                        setSelectedKitab('')
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
                        {JENIS_KEGIATAN_OPTIONS.map(opt => (
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

            {selectedJenis === 'ngaji' ? (
              <div className="space-y-2">
                <Label>Kitab / Nama Kegiatan</Label>
                <Select onValueChange={handleKitabChange} value={selectedKitab}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kitab" />
                  </SelectTrigger>
                  <SelectContent>
                    {KITAB_NGAJI_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedKitab === 'Lainnya' && (
                  <Input
                    value={namaManual}
                    onChange={e => handleNamaManualChange(e.target.value)}
                    placeholder="Tulis nama kitab/kegiatan..."
                  />
                )}
              </div>
            ) : selectedJenis === 'kegiatan_pengurus' ? (
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
              {editingJadwal ? 'Simpan Perubahan' : 'Tambah Jadwal'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const dynamic = 'force-dynamic'
