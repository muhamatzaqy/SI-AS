'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // ✅ FIX: Ensure video plays when stream is set
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      // Ensure video plays
      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Auto play failed:', error)
        })
      }
    }
  }, [stream])

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      
      // Stop previous stream if exists
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      }
      
      console.log('Requesting camera access...')
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('Camera access granted, stream:', mediaStream)
      
      setStream(mediaStream)
      setIsCapturing(true)
      
    } catch (err) {
      console.error('Camera error:', err)
      
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('Izin kamera ditolak. Periksa setting browser Anda.')
        } else if (err.name === 'NotFoundError') {
          setError('Kamera tidak ditemukan di device ini.')
        } else if (err.name === 'NotSupportedError') {
          setError('Browser tidak support akses kamera.')
        } else if (err.name === 'SecurityError') {
          setError('Akses kamera ditolak karena alasan keamanan. Gunakan HTTPS.')
        } else {
          setError(`Error kamera: ${err.message}`)
        }
      } else {
        setError('Gagal mengakses kamera')
      }
      
      setIsCapturing(false)
    }
  }, [stream])

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
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas ref not available')
      return
    }
    
    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (!video.videoWidth || !video.videoHeight) {
      console.error('Video dimensions not available')
      return
    }
    
    console.log('Capturing photo:', video.videoWidth, 'x', video.videoHeight)
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('Canvas context not available')
      return
    }
    
    // ✅ Mirror selfie camera (flip horizontally)
    ctx.save()
    ctx.scale(-1, 1)
    ctx.translate(-canvas.width, 0)
    ctx.drawImage(video, 0, 0)
    ctx.restore()
    
    canvas.toBlob(
      blob => {
        if (blob) {
          console.log('Photo blob created:', blob.size)
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
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl)
    }
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
