'use client'
import { useState, useRef, useCallback } from 'react'

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      
      // ✅ FIX: Support berbagai browser
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)
      setIsCapturing(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        // ✅ FIX: Ensure video plays
        videoRef.current.play().catch(err => console.error('Play error:', err))
      }
    } catch (err) {
      console.error('Camera error:', err)
      
      // ✅ FIX: Better error messages
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('Izin kamera ditolak. Periksa setting browser Anda.')
        } else if (err.name === 'NotFoundError') {
          setError('Kamera tidak ditemukan di device ini.')
        } else if (err.name === 'NotSupportedError') {
          setError('Browser tidak support akses kamera.')
        } else {
          setError(`Error kamera: ${err.message}`)
        }
      } else {
        setError('Gagal mengakses kamera')
      }
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop()
      })
      setStream(null)
    }
    setIsCapturing(false)
  }, [stream])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // ✅ FIX: Mirror selfie camera
    ctx.scale(-1, 1)
    ctx.translate(-canvas.width, 0)
    ctx.drawImage(video, 0, 0)
    
    canvas.toBlob(
      blob => {
        if (blob) {
          setPhotoUrl(URL.createObjectURL(blob))
          setPhotoBlob(blob)
          stopCamera()
        }
      },
      'image/jpeg',
      0.9
    )
  }, [stopCamera])

  const resetPhoto = useCallback(() => {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(null)
    setPhotoBlob(null)
  }, [photoUrl])

  return {
    stream,
    photoUrl,
    photoBlob,
    error,
    isCapturing,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    capturePhoto,
    resetPhoto
  }
}
