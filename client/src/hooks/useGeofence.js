// client/src/hooks/useGeofence.js
import { useMemo } from 'react'

export const dentroDelPoligono = (punto, poligono) => {
  let dentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i]
    const b = poligono[j]
    const cruza =
      a.lat > punto.lat !== b.lat > punto.lat &&
      punto.lng < ((b.lng - a.lng) * (punto.lat - a.lat)) / (b.lat - a.lat) + a.lng
    if (cruza) dentro = !dentro
  }
  return dentro
}

export function useGeofence(position, zonas) {
  return useMemo(
    () => (position ? zonas.filter((z) => dentroDelPoligono(position, z.coordenadas)) : []),
    [position, zonas],
  )
}