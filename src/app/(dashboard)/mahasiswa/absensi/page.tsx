'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useGeolocation } from '@/hooks/use-geolocation'
import { useCamera } from '@/hooks/use-camera'
import { Camera, MapPin, Check, Loader2, AlertCircle } from 'lucide-react'
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

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('unit')
        .eq('id', user.id)
        .single()
      
      const today = new Date().toISOString().split('T')[0]
      
      const { data: jadwalData } = await supabase
        .from('jadwal_kegiatan')
        .select('*')
        .eq('tanggal', today)
        .or(`target_unit.eq.${profile?.unit},target_unit.eq.gabungan`)
      
      setJadwals(jadwalData ?? [])
      
      if (jadwalData && jadwalData.length > 0) {
        const ids = jadwalData.map((j: any) => j.id)
        const { data: presensiData } = await supabase
          .from('presensi')
          .select('jadwal_id, status')
          .eq('mahasiswa_id', user.id)
          .in('jadwal_id', ids)
        
        const map: Record<string, string> = {}
        ;(presensiData ?? []).forEach((p: any) => {
          map[p.jadwal_id] = p.status
        })
        setPresensiMap(map)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'Gagal memuat data jadwal',
        variant: 'destructive'
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const isPastDeadline = (batas: string | null) => {
    if (!batas) return false
    
    try {
      const now = new Date()
      const [batasHour, batasMin] = batas.split(':').map(Number)
      
      const batasDate = new Date(now)
      batasDate.setHours(batasHour, batasMin, 0, 0)
      
      return now > batasDate
    } catch (error) {
      console.error('Error comparing time:', error)
      return false
    }
  }

  const getTimeRemaining = (batas: string | null) => {
    if (!batas) return null
    
    try {
      const now = new Date()
      const [batasHour, batasMin] = batas.split(':').map(Number)
      
      const batasDate = new Date(now)
      batasDate.setHours(batasHour, batasMin, 0, 0)
      
      const diff = batasDate.getTime() - now.getTime()
      
      if (diff <= 0) return 'Waktu habis'
      
      const minutes = Math.floor(diff / 60000)
      if (minutes < 1) return 'Kurang dari 1 menit'
      if (minutes < 60) return `${minutes} menit lagi`
      
      const hours = Math.floor(minutes / 60)
      return `${hours}h ${minutes % 60}m lagi`
    } catch (error) {
      return null
    }
  }

  // ✅ NEW: Upload photo to Supabase Storage
  const uploadPhotoToStorage = async (blob: Blob, userId: string) => {
    try {
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(7)
      const filename = `${userId}/${timestamp}_${random}.jpg`
      
      console.log('📸 Starting photo upload:', filename)
      
      // ✅ Upload file
      const { data, error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: false
        })
      
      if (uploadError) {
        console.error('❌ Upload error:', uploadError)
        throw uploadError
      }
      
      console.log('✅ Upload success:', data)
      
      // ✅ Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(filename)
      
      console.log('🔗 Public URL:', publicUrl)
      
      if (!publicUrl) {
        throw new Error('Failed to generate public URL')
      }
      
      return publicUrl
    } catch (error) {
      console.error('💥 Photo upload failed:', error)
      throw error
    }
  }

  const handleAbsen = async () => {
    if (!selectedJadwal) return
    setSubmitting(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const now = new Date()
      const batas = selectedJadwal.batas_absen
      
      // ✅ Check if past deadline
      if (isPastDeadline(batas)) {
        toast({
          title: 'Waktu Habis',
          description: 'Sudah melewati batas absensi. Status akan di-set menjadi Alpa.',
          variant: 'destructive'
        })
        
        const { error: alpaError } = await supabase
          .from('presensi')
          .upsert({
            mahasiswa_id: user.id,
            jadwal_id: selectedJadwal.id,
            status: 'alpa',
            waktu_absen: now.toISOString(),
            foto_url: null,
            latitude: latitude || null,
            longitude: longitude || null
          })
        
        if (alpaError) throw alpaError
        
        toast({
          title: 'Status Alpa',
          description: 'Presensi tercatat sebagai Alpa',
          variant: 'default'
        })
        
        setSelectedJadwal(null)
        resetPhoto()
        fetchData()
        setSubmitting(false)
        return
      }
      
      // ✅ Handle photo upload
      let fotoUrl: string | null = null
      if (selectedJadwal.wajib_foto) {
        if (!photoBlob) {
          toast({
            title: 'Foto Diperlukan',
            description: 'Ambil foto selfie terlebih dahulu',
            variant: 'destructive'
          })
          setSubmitting(false)
          return
        }
        
        try {
          console.log('📷 Processing photo...')
          console.log('Photo blob size:', photoBlob.size, 'bytes')
          
          // ✅ Compress image
          const imageCompression = (await import('browser-image-compression')).default
          const compressed = await imageCompression(photoBlob as File, IMAGE_COMPRESSION_OPTIONS)
          console.log('✅ Compressed size:', compressed.size, 'bytes')
          
          // ✅ Upload to storage
          fotoUrl = await uploadPhotoToStorage(compressed, user.id)
          console.log('🎉 Photo URL obtained:', fotoUrl)
          
        } catch (photoError) {
          console.error('❌ Photo processing failed:', photoError)
          toast({
            title: 'Error Upload Foto',
            description: 'Gagal upload foto. Absensi akan dicatat tanpa foto.',
            variant: 'destructive'
          })
          // Continue dengan fotoUrl = null
          fotoUrl = null
        }
      }
      
      // ✅ Submit attendance
      console.log('💾 Submitting attendance with data:', {
        mahasiswa_id: user.id,
        jadwal_id: selectedJadwal.id,
        status: 'hadir',
        foto_url: fotoUrl,
        latitude: latitude || null,
        longitude: longitude || null
      })
      
      const { data: insertData, error } = await supabase
        .from('presensi')
        .upsert({
          mahasiswa_id: user.id,
          jadwal_id: selectedJadwal.id,
          status: 'hadir',
          waktu_absen: now.toISOString(),
          foto_url: fotoUrl,
          latitude: latitude || null,
          longitude: longitude || null
        })
      
      if (error) {
        console.error('❌ Database error:', error)
        throw error
      }
      
      console.log('✅ Attendance saved:', insertData)
      
      toast({
        title: 'Absen Berhasil! ✅',
        description: fotoUrl ? 'Kehadiran dan foto tercatat' : 'Kehadiran tercatat',
        variant: 'success'
      })
      
      setSelectedJadwal(null)
      resetPhoto()
      fetchData()
    } catch (error) {
      console.error('❌ Attendance error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal absen',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Absensi Digital"
        description={`Jadwal hari ini - ${formatDate(new Date())}`}
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : jadwals.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Tidak ada jadwal hari ini.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jadwals.map((j: any) => (
            <Card
              key={j.id}
              className={`transition-all ${
                selectedJadwal?.id === j.id ? 'ring-2 ring-primary' : ''
              }`}
            >
              <CardContent className="flex items-center justify-between gap-3 p-3 sm:p-4">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{j.nama_kegiatan}</p>
                    {j.wajib_foto && (
                      <Badge variant="info" className="text-xs">
                        Wajib Foto
                      </Badge>
                    )}
                    {isPastDeadline(j.batas_absen) && !presensiMap[j.id] && (
                      <Badge variant="destructive" className="text-xs">
                        Terlambat
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {j.jam_mulai}–{j.jam_selesai}
                    {j.batas_absen ? ` · Batas: ${j.batas_absen}` : ''}
                  </p>
                  {j.batas_absen && !presensiMap[j.id] && (
                    <p className="text-xs text-orange-600 font-medium">
                      ⏱️ {getTimeRemaining(j.batas_absen)}
                    </p>
                  )}
                </div>
                {presensiMap[j.id] ? (
                  <Badge variant="success" className="shrink-0">
                    <Check className="mr-1 h-3 w-3" />
                    {formatLabel(presensiMap[j.id])}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setSelectedJadwal(j)
                      resetPhoto()
                      getLocation()
                    }}
                    disabled={isPastDeadline(j.batas_absen)}
                  >
                    {isPastDeadline(j.batas_absen) ? 'Terlambat' : 'Absen'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedJadwal && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">
              📋 Absen: {selectedJadwal.nama_kegiatan}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Geolocation Section */}
            <div className="rounded-lg bg-gray-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4 text-green-600" />
                <span>Lokasi</span>
              </div>
              
              {geoLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Mendapatkan lokasi...</span>
                </div>
              ) : geoError ? (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>⚠️ Lokasi tidak tersedia (opsional)</span>
                </div>
              ) : latitude ? (
                <div className="text-sm text-gray-700 font-mono break-all">
                  📍 {latitude.toFixed(6)}, {longitude?.toFixed(6)}
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  Klik tombol di bawah untuk mendapatkan lokasi
                </div>
              )}
              
              {!latitude && !geoLoading && !geoError && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={getLocation}
                  className="w-full"
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Dapatkan Lokasi
                </Button>
              )}
            </div>

            {/* Camera Section */}
            {selectedJadwal.wajib_foto && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Camera className="h-4 w-4 text-blue-600" />
                  <span>Foto Selfie</span>
                </div>
                
                {isCapturing ? (
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full bg-black rounded-lg"
                      style={{ aspectRatio: '16/9', maxHeight: '400px' }}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <Button
                      onClick={capturePhoto}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      Ambil Foto
                    </Button>
                  </div>
                ) : photoUrl ? (
                  <div className="space-y-2">
                    <img
                      src={photoUrl}
                      alt="Selfie"
                      className="w-full rounded-lg max-h-64 object-cover"
                    />
                    <Button
                      variant="outline"
                      onClick={startCamera}
                      className="w-full"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Foto Ulang
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={startCamera}
                    className="w-full"
                    variant="outline"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Buka Kamera Selfie
                  </Button>
                )}
                
                {cameraError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-sm text-red-800">{cameraError}</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1"
                onClick={handleAbsen}
                disabled={submitting || geoLoading}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Konfirmasi Absen
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setSelectedJadwal(null)
                  resetPhoto()
                }}
                disabled={submitting}
              >
                Batal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'
