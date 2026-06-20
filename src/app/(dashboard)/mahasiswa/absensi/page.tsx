'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
      
      // Ambil semua sesi hari ini beserta nama kegiatannya
      const { data: sesiData } = await supabase
        .from('sesi')
        .select('*, nama_kegiatan(nama_kegiatan)')
        .eq('tanggal', today)
      
      // Filter sesi secara client-side berdasarkan logika JSONB tipe_target
      const validSesi = (sesiData ?? []).filter((s: any) => {
        if (s.tipe_target === 'semua') return true
        if (s.tipe_target === 'unit' && s.target_audiens?.unit === profile?.unit) return true
        if (s.tipe_target === 'unit_semester' && 
            s.target_audiens?.unit === profile?.unit && 
            s.target_audiens?.semester === profile?.semester) return true
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

  // Cek apakah waktu sudah melewati jam_selesai sesi
  const isPastDeadline = (jadwal: any): boolean => {
    if (!jadwal || !jadwal.jam_selesai) return false
    try {
      const now = new Date()
      const batasDate = new Date(now)
      const [hour, min] = jadwal.jam_selesai.split(':').map(Number)
      batasDate.setHours(hour, min, 0, 0)
      return now > batasDate
    } catch { return false }
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
    
    // Validasi 1: Ketersediaan Lokasi
    if (!latitude || !longitude) {
      toast({ title: 'Akses Lokasi Dibutuhkan', description: 'Harap izinkan akses lokasi (GPS) di browser Anda untuk absen.', variant: 'destructive' })
      return
    }

    // Validasi 2: Waktu Habis (Otomatis Alpha)
    if (isPastDeadline(selectedJadwal)) {
      toast({ title: 'Waktu Habis', description: 'Melewati jam selesai. Status diubah menjadi Alpha.', variant: 'destructive' })
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('presensi').upsert({
          mahasiswa_id: user.id, sesi_id: selectedJadwal.id, status: 'alpha', waktu_absen: new Date().toISOString()
        })
        fetchData()
        setSelectedJadwal(null)
      }
      return
    }

    // Validasi 3: Foto Selfie
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
      setSelectedJadwal(null)
      resetPhoto()
      fetchData()
    } catch (error: any) {
      toast({ title: 'Gagal Absen', description: error.message || 'Terjadi kesalahan sistem.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Absensi Digital" description={`Jadwal sesi hari ini - ${formatDate(new Date())}`} />

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : jadwals.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Tidak ada jadwal sesi hari ini untuk unit Anda.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {jadwals.map((j: any) => (
            <Card key={j.id} className={`transition-all ${selectedJadwal?.id === j.id ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{j.nama_kegiatan?.nama_kegiatan}</p>
                    {isPastDeadline(j) && !presensiMap[j.id] && <Badge variant="destructive" className="text-xs">Terlambat</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">Jam Pelaksanaan: {j.jam_mulai.slice(0,5)}–{j.jam_selesai.slice(0,5)} WIB</p>
                  {!presensiMap[j.id] && !isPastDeadline(j) && <p className="text-xs text-orange-600 font-medium">⏱️ Sisa waktu: {getTimeRemaining(j)}</p>}
                </div>
                
                {presensiMap[j.id] ? (
                  <Badge variant={presensiMap[j.id] === 'hadir' ? 'success' : presensiMap[j.id] === 'izin' ? 'warning' : 'destructive'} className="shrink-0 w-fit">
                    {presensiMap[j.id] === 'hadir' ? <Check className="mr-1 h-3 w-3" /> : null} {formatLabel(presensiMap[j.id])}
                  </Badge>
                ) : (
                  <Button size="sm" className="shrink-0 w-full sm:w-auto" disabled={isPastDeadline(j)}
                    onClick={() => {
                      if (isPastDeadline(j)) {
                        toast({ title: 'Waktu Habis', description: 'Waktu absensi berakhir.', variant: 'destructive' })
                        return
                      }
                      setSelectedJadwal(j)
                      resetPhoto()
                      getLocation()
                    }}
                  >
                    {isPastDeadline(j) ? 'Sesi Ditutup' : 'Mulai Absen'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedJadwal && (
        <Card className="border-primary animate-fade-in shadow-md">
          <CardHeader className="bg-primary/5 border-b pb-4">
            <CardTitle className="text-lg flex items-center">📋 Validasi Absen: <span className="ml-2 font-normal text-muted-foreground">{selectedJadwal.nama_kegiatan?.nama_kegiatan}</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            
            {/* 1. SEKSI LOKASI */}
            <div className="rounded-xl border p-4 space-y-4 bg-card shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Map className="h-5 w-5 text-blue-600" /> Perekaman Lokasi
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex-1 space-y-1">
                  {geoLoading ? (
                    <p className="text-sm flex items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Mencari sinyal GPS...</p>
                  ) : geoError ? (
                    <p className="text-sm text-destructive flex items-center font-medium"><AlertCircle className="h-4 w-4 mr-2" /> Gagal mendapat akses lokasi. Periksa izin browser.</p>
                  ) : latitude ? (
                    <p className="text-sm font-mono text-muted-foreground">Titik Koordinat: {latitude.toFixed(5)}, {longitude?.toFixed(5)}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Lokasi belum terdeteksi.</p>
                  )}
                </div>
                
                <Button variant="secondary" size="sm" onClick={getLocation} disabled={geoLoading} className="w-full sm:w-auto shrink-0">
                  <MapPin className="mr-2 h-4 w-4" /> Perbarui Titik GPS
                </Button>
              </div>
            </div>

            {/* 2. SEKSI KAMERA SELFIE */}
            <div className="rounded-xl border p-4 space-y-4 bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Camera className="h-5 w-5 text-indigo-600" /> Foto Selfie Kehadiran
                </div>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Wajib</Badge>
              </div>
              
              {isCapturing ? (
                <div className="relative bg-black rounded-lg overflow-hidden ring-1 ring-border">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full object-cover" style={{ aspectRatio: '4/3', maxHeight: '400px' }} />
                  <canvas ref={canvasRef} className="hidden" />
                  <Button onClick={capturePhoto} size="lg" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-lg">
                    <Camera className="mr-2 h-5 w-5" /> Jepret Foto
                  </Button>
                </div>
              ) : photoUrl ? (
                <div className="space-y-3">
                  <img src={photoUrl} alt="Hasil Selfie" className="w-full rounded-lg object-cover ring-1 ring-border shadow-sm max-h-72" />
                  <Button variant="outline" onClick={startCamera} className="w-full"><Camera className="mr-2 h-4 w-4" /> Foto Ulang</Button>
                </div>
              ) : (
                <Button onClick={startCamera} className="w-full h-24 border-dashed bg-muted/30 hover:bg-muted/50" variant="outline">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground"><Camera className="h-6 w-6" /> Buka Kamera</div>
                </Button>
              )}
              {cameraError && <p className="text-sm text-destructive font-medium bg-red-50 p-2 rounded-md">{cameraError}</p>}
            </div>

            {/* 3. TOMBOL AKSI */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" className="flex-1" onClick={() => { setSelectedJadwal(null); resetPhoto() }} disabled={submitting}>Batal</Button>
              <Button className="flex-1" onClick={handleAbsen} disabled={submitting || geoLoading || !latitude || !photoBlob}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : <><Check className="mr-2 h-4 w-4" /> Konfirmasi Hadir</>}
              </Button>
            </div>
            
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export const dynamic = 'force-dynamic'
