'use client'
import { useState } from 'react'

export function useGeolocation() {
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const getLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation tidak didukung'); return }
    setLoading(true); setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); setLoading(false) },
      (err) => { setError(err.message); setLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
  return { latitude, longitude, error, loading, getLocation }
}
