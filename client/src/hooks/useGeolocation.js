import { useEffect, useState } from 'react'

const soportado = () => typeof navigator !== 'undefined' && 'geolocation' in navigator

export function useGeolocation() {
  const [estado, setEstado] = useState(() => ({
    position: null,
    status: soportado() ? 'pendiente' : 'no-soportado',
  }))

  useEffect(() => {
    if (!soportado()) return undefined

    const id = navigator.geolocation.watchPosition(
      (p) =>
        setEstado({
          position: {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            precision: p.coords.accuracy,
          },
          status: 'activa',
        }),
      (err) =>
        setEstado((previo) => ({ ...previo, status: err.code === 1 ? 'denegada' : 'error' })),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [])

  return estado
}