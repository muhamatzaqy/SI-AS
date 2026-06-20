'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useGeolocation } from '@/hooks/use-geolocation'
import { useCamera } from '@/hooks/use-camera'
import { Camera, MapPin, Check, Loader2, AlertCircle, Map } from 'lucide-react'
import { IMAGE_COMPRESSION_OPTIONS } from '@/lib/constants'
import { formatDate, formatLabel } from '@/lib/utils'

export default function AbsensiPage() {
  const [jadwals, setJadwals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJadwal, setSelectedJadwal] = useState<any>(null)
  const [presensiMap, setPresensiMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  
  // State untuk mengontrol visibilitas Modal
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { toast } = useToast()
  const { latitude, longitude, error: geoError, loading: geoLoading, getLocation } = useGeolocation()
  const { photoUrl, photoBlob, isCapturing, error: cameraError, videoRef, canvasRef, startCamera, capturePhoto, resetPhoto } = useCamera()
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('unit, semester')
        .eq('id', user.id)
        .single()
      
      const today = new Date().toISOString().split('T')[0]
      
      const { data: sesiData } = await supabase
        .from('sesi')
        .select('*, nama_kegiatan(nama_kegiatan)')
        .eq('tanggal', today)
        .order('jam_mulai', { ascending: true }) // Urutkan berdasarkan waktu paling awal
      
      const validSesi = (sesiData ?? []).filter((s: any) => {
        if (s.tipe_target === 'semua') return true
        if (s.tipe_target === 'unit' && s.target_audiens?.unit === profile?.unit) return true
        if (s.tipe_target === 'unit_semester' && 
            s.target_audiens?.unit === profile?.unit && 
            s.target_audiens?.semester === profile?.semester) return true
        if (s.tipe_target === 'custom' && s.target_audiens?.mahasiswa_ids?.includes(user.id)) return true
        return false
      })
      
      setJadwals(validSesi)
      
      if (validSesi.length > 0) {
        const ids = validSesi.map((j: any) => j.id)
        const { data: presensiData } = await supabase
          .from('presensi')
          .select('sesi_id, status')
          .eq('mahasiswa_id', user.id)
          .in('sesi_id', ids)
        
        const map: Record<string, string> = {}
        ;(presensiData ?? []).forEach((p: any) => { map[p.sesi_id] = p.status })
        setPresensiMap(map)
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Gagal memuat data jadwal', variant: 'destructive' })
    }
    setLoading(false)
  }, [supabase, toast])

  useEffect(() => { fetchData() }, [fetchData])

  // --- LOGIKA WAKTU ---
  const checkStatusWaktu = (jadwal: any) => {
    if (!jadwal || !jadwal.jam_mulai || !jadwal.jam_selesai) return { status: 'unknown', text: '' }
    
    try {
      const now = new Date()
      
      // Ambil waktu saat ini (jam dan menit) dalam bentuk angka agar mudah dibandingkan
      // Gunakan timezone WIB (GMT+7) jika diperlukan, tapi Date() bawaan browser sudah mengikuti lokal user
      const currentHours = now.getHours()
      const currentMinutes = now.getMinutes()
      const currentTimeValue = currentHours * 60 + currentMinutes

      const [startHour, startMin] = jadwal.jam_mulai.split(':').map(Number)
      const startTimeValue = startHour * 60 + startMin

      const [endHour, endMin] = jadwal.jam_selesai.split(':').map(Number)
      const endTimeValue = endHour * 60 + endMin

      if (currentTimeValue < startTimeValue) {
        return { status: 'early', text: 'Belum Dimulai' } // Sesi belum mulai
      } else if (currentTimeValue >= startTimeValue && currentTimeValue <= endTimeValue) {
        return { status: 'active', text: 'Mulai Absen' } // Sesi sedang berlangsung
      } else {
        return { status: 'late', text: 'Sesi Ditutup' } // Sesi sudah lewat
      }
    } catch { 
      return { status: 'unknown', text: '' } 
    }
  }

  const getTimeRemaining = (jadwal: any): string | null => {
    if (!jadwal || !jadwal.jam_selesai) return null
    try {
      const now = new Date()
      const batasDate = new Date(now)
      const [hour, min] = jadwal.jam_selesai.split(':').map(Number)
      batasDate.setHours(hour, min, 0, 0)
      
      const diff = batasDate.getTime() - now.getTime()
      if (diff <= 0) return 'Waktu habis'
      
      const minutes = Math.floor(diff / 60000)
      if (minutes < 1) return 'Kurang dari 1 menit'
      if (minutes < 60) return `${minutes} menit lagi`
      const hours = Math.floor(minutes / 60)
      return `${hours}j ${minutes % 60}m lagi`
    } catch { return null }
  }

  const uploadPhotoToStorage = async (blob: Blob, userId: string) => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const filename = `${userId}/${timestamp}_${random}.jpg`
    
    const { data, error: uploadError } = await supabase.storage
      .from('attendance-photos')
      .upload(filename, blob, { contentType: 'image/jpeg', upsert: false })
    
    if (uploadError) throw uploadError
    
    const { data: { publicUrl } } = supabase.storage.from('attendance-photos').getPublicUrl(filename)
    return publicUrl
  }

  const handleAbsen = async () => {
    if (!selectedJadwal) return
    
    // Validasi Waktu Ketat (Siapa tahu modal di-diamkan lama sampai jam habis)
    const waktuCheck = checkStatusWaktu(selectedJadwal)
    if (waktuCheck.status === 'late') {
      toast({ title: 'Waktu Habis', description: 'Waktu absensi sudah ditutup.', variant: 'destructive' })
      setIsModalOpen(false)
      fetchData() // Refresh untuk update UI
      return
    }

    if (!latitude || !longitude) {
      toast({ title: 'Akses Lokasi Dibutuhkan', description: 'Harap izinkan akses lokasi (GPS) di browser Anda untuk absen.', variant: 'destructive' })
      return
    }

    if (!photoBlob) {
      toast({ title: 'Foto Diperlukan', description: 'Ambil foto selfie bukti kehadiran terlebih dahulu.', variant: 'destructive' })
      return
    }
    
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const imageCompression = (await import('browser-image-compression')).default
      const compressed = await imageCompression(photoBlob as File, IMAGE_COMPRESSION_OPTIONS)
      const fotoUrl = await uploadPhotoToStorage(compressed, user.id)
      
      const { error } = await supabase.from('presensi').upsert({
        mahasiswa_id: user.id,
        sesi_id: selectedJadwal.id,
        status: 'hadir',
        waktu_absen: new Date().toISOString(),
        foto_url: fotoUrl,
        latitude: latitude,
        longitude: longitude
      })
      
      if (error) throw error
      
      toast({ title: 'Absen Berhasil! ✅', description: 'Kehadiran, lokasi, dan foto tercatat.', variant: 'success' })
      setIsModalOpen(false)
      setSelectedJadwal(null)
      resetPhoto()
      fetchData()
    } catch (error: any) {
      toast({ title: 'Gagal Absen', description: error.message || 'Terjadi kesalahan sistem.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const openAbsensiModal = (jadwal: any) => {
    setSelectedJadwal(jadwal)
    resetPhoto()
    setIsModalOpen(true)
    // Beri sedikit waktu agar modal ter-render sebelum memanggil lokasi, mencegah lag
    setTimeout(() => {
      getLocation()
    }, 300)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Absensi Digital" description={`Jadwal sesi hari ini - ${formatDate(new Date())}`} />

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : jadwals.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Tidak ada jadwal sesi hari ini untuk Anda.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {jadwals.map((j: any) => {
            const waktuInfo = checkStatusWaktu(j)
            const isLate = waktuInfo.status === 'late'
            const isEarly = waktuInfo.status === 'early'
            const isActive = waktuInfo.status === 'active'

            return (
              <Card key={j.id} className="transition-all hover:border-primary/50">
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground text-base">{j.nama_kegiatan?.nama_kegiatan}</p>
                      
                      {/* Indikator Status Waktu */}
                      {isLate && !presensiMap[j.id] && <Badge variant="destructive" className="text-xs">Terlambat</Badge>}
                      {isEarly && <Badge variant="secondary" className="text-xs">Akan Datang</Badge>}
                      {isActive && !presensiMap[j.id] && <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Sedang Berlangsung</Badge>}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mt-1">
                      Jam Pelaksanaan: <span className="font-medium text-foreground">{j.jam_mulai.slice(0,5)} – {j.jam_selesai.slice(0,5)} WIB</span>
                    </p>
                    
                    {!presensiMap[j.id] && isActive && (
                      <p className="text-xs text-orange-600 font-medium mt-1">⏱️ Sisa waktu: {getTimeRemaining(j)}</p>
                    )}
                  </div>
                  
                  <div className="shrink-0 flex items-center justify-end w-full sm:w-auto">
                    {presensiMap[j.id] ? (
                      <Badge variant={presensiMap[j.id] === 'hadir' ? 'success' : presensiMap[j.id] === 'izin' ? 'warning' : 'destructive'} className="py-1.5 px-3 text-sm">
                        {presensiMap[j.id] === 'hadir' ? <Check className="mr-1.5 h-4 w-4" /> : null} 
                        {presensiMap[j.id] === 'hadir' ? 'Hadir' : presensiMap[j.id] === 'izin' ? 'Izin' : 'Alpha'}
                      </Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        className="w-full sm:w-auto" 
                        disabled={!isActive} // Tombol mati jika kepagian atau kemalaman
                        onClick={() => openAbsensiModal(j)}
                      >
                        {waktuInfo.text}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* --- DIALOG (MODAL) PEREKAMAN ABSENSI --- */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!submitting) {
          setIsModalOpen(open)
          if (!open) {
            setSelectedJadwal(null)
            resetPhoto()
          }
        }
      }}>
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="p-4 md:p-5 border-b sticky top-0 bg-background z-10">
            <DialogTitle className="text-xl flex items-center">
              📋 Validasi Absen
            </DialogTitle>
            <DialogDescription className="font-medium text-foreground">
              {selectedJadwal?.nama_kegiatan?.nama_kegiatan}
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 md:p-5 space-y-5">
            {/* 1. SEKSI LOKASI */}
            <div className="rounded-xl border p-3 md:p-4 space-y-3 bg-muted/30 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <Map className="h-4 w-4 text-blue-600" /> Perekaman Lokasi
              </div>
              
              <div className="flex flex-col gap-3">
                <div className="bg-background rounded-md p-2 px-3 border min-h-[40px] flex items-center">
                  {geoLoading ? (
                    <p className="text-xs flex items-center text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin mr-2" /> Mencari sinyal GPS...</p>
                  ) : geoError ? (
                    <p className="text-xs text-destructive flex items-center font-medium"><AlertCircle className="h-3 w-3 mr-2" /> {geoError}</p>
                  ) : latitude ? (
                    <p className="text-xs font-mono text-muted-foreground truncate">Koordinat: {latitude.toFixed(5)}, {longitude?.toFixed(5)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Lokasi belum terdeteksi.</p>
                  )}
                </div>
                
                <Button variant="outline" size="sm" onClick={getLocation} disabled={geoLoading} className="w-full h-8 text-xs">
                  <MapPin className="mr-2 h-3 w-3" /> Perbarui Titik
                </Button>
              </div>
            </div>

            {/* 2. SEKSI KAMERA SELFIE */}
            <div className="rounded-xl border p-3 md:p-4 space-y-3 bg-muted/30 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                  <Camera className="h-4 w-4 text-indigo-600" /> Foto Kehadiran
                </div>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">Wajib</Badge>
              </div>
              
              {isCapturing ? (
                <div className="relative bg-black rounded-lg overflow-hidden ring-1 ring-border mt-2">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full object-cover" style={{ aspectRatio: '4/3', maxHeight: '350px' }} />
                  <canvas ref={canvasRef} className="hidden" />
                  <Button onClick={capturePhoto} size="default" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-lg h-10 px-6 font-medium">
                    <Camera className="mr-2 h-4 w-4" /> Jepret Foto
                  </Button>
                </div>
              ) : photoUrl ? (
                <div className="space-y-3 mt-2">
                  <img src={photoUrl} alt="Hasil Selfie" className="w-full rounded-lg object-cover ring-1 ring-border shadow-sm max-h-[350px] aspect-[4/3]" />
                  <Button variant="outline" onClick={startCamera} className="w-full h-9 text-sm"><Camera className="mr-2 h-4 w-4" /> Foto Ulang</Button>
                </div>
              ) : (
                <Button onClick={startCamera} className="w-full h-24 border-dashed bg-background hover:bg-muted/50 mt-2" variant="outline">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground"><Camera className="h-6 w-6" /> Buka Kamera</div>
                </Button>
              )}
              {cameraError && <p className="text-xs text-destructive font-medium bg-red-50 p-2 rounded-md">{cameraError}</p>}
            </div>
          </div>

          <div className="p-4 md:p-5 border-t bg-muted/10 sticky bottom-0 z-10 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)} disabled={submitting}>Batal</Button>
            <Button className="flex-1" onClick={handleAbsen} disabled={submitting || geoLoading || !latitude || !photoBlob}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Proses...</> : <><Check className="mr-2 h-4 w-4" /> Konfirmasi</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export const dynamic = 'force-dynamic'
