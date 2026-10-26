import { AppError } from '../middlewares/error.middleware.js'
import { zonasDeAltoRiesgo, puntoEnPoligono } from './risk.service.js'

const URL_BASE = 'https://api.openrouteservice.org/v2/directions'
const TIEMPO_MAXIMO_MS = 10000
const PROPORCION_RIESGO_ALTO = 0.15

const PERFILES = {
  'a-pie': 'foot-walking',
  bicicleta: 'cycling-regular',
  vehiculo: 'driving-car',
  'transporte-publico': 'driving-car',
}

const cerrarAnillo = (coordenadas) => {
  const anillo = coordenadas.map((p) => [p.lng, p.lat])
  const primero = anillo[0]
  const ultimo = anillo[anillo.length - 1]
  if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) anillo.push(primero)
  return anillo
}

const poligonosAEvitar = (zonas) =>
  zonas.length === 0
    ? null
    : { type: 'MultiPolygon', coordinates: zonas.map((z) => [cerrarAnillo(z.coordenadas)]) }

const pedirRuta = async (perfil, origen, destino, evitar) => {
  const clave = process.env.ORS_API_KEY
  if (!clave) throw new AppError(503, 'Servicio de rutas no configurado')

  const cuerpo = { coordinates: [[origen.lng, origen.lat], [destino.lng, destino.lat]] }
  if (evitar) cuerpo.options = { avoid_polygons: evitar }

  let respuesta
  try {
    respuesta = await fetch(`${URL_BASE}/${perfil}/geojson`, {
      method: 'POST',
      headers: { Authorization: clave, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    })
  } catch {
    throw new AppError(502, 'No se pudo calcular la ruta')
  }
  if (!respuesta.ok) throw new AppError(502, 'No se pudo calcular la ruta')

  const datos = await respuesta.json()
  const ruta = datos?.features?.[0]
  if (!ruta) throw new AppError(502, 'No se pudo calcular la ruta')

  return {
    distanciaM: Math.round(ruta.properties.summary.distance),
    duracionS: Math.round(ruta.properties.summary.duration),
    coordenadas: ruta.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
  }
}

const evaluarRiesgo = (coordenadas, zonasRiesgo) => {
  const enRiesgo = coordenadas.filter((p) =>
    zonasRiesgo.some((z) => puntoEnPoligono(p, z.coordenadas)),
  ).length
  const proporcion = coordenadas.length > 0 ? enRiesgo / coordenadas.length : 0

  let riesgo = 'bajo'
  if (enRiesgo > 0) riesgo = proporcion < PROPORCION_RIESGO_ALTO ? 'medio' : 'alto'
  return { puntosEnZonaDeRiesgo: enRiesgo, riesgo }
}

const formatear = (nombre, ruta, zonasRiesgo) => ({
  nombre,
  distanciaM: ruta.distanciaM,
  duracionS: ruta.duracionS,
  coordenadas: ruta.coordenadas,
  ...evaluarRiesgo(ruta.coordenadas, zonasRiesgo),
})

export const obtenerRutas = async ({ origen, destino, modo }) => {
  const perfil = PERFILES[modo]
  const zonasRiesgo = await zonasDeAltoRiesgo()

  const directa = await pedirRuta(perfil, origen, destino, null)
  const rutas = [formatear('Ruta directa', directa, zonasRiesgo)]

  if (zonasRiesgo.length > 0) {
    try {
      const alterna = await pedirRuta(perfil, origen, destino, poligonosAEvitar(zonasRiesgo))
      rutas.push(formatear('Ruta evitando zonas de riesgo', alterna, zonasRiesgo))
    } catch {
      /* sin alterna: se devuelve solo la ruta directa */
    }
  }

  return { modo, aproximado: modo === 'transporte-publico', rutas }
}