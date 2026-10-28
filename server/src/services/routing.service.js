import { AppError } from '../middlewares/error.middleware.js'
import { zonasDeAltoRiesgo, puntoEnPoligono } from './risk.service.js'

const URL_BASE = 'https://api.openrouteservice.org/v2/directions'
const URL_DIRECCIONES = 'https://api.openrouteservice.org/geocode/search'
const TIEMPO_MAXIMO_MS = 10000
const PROPORCION_RIESGO_ALTO = 0.15
const MAXIMO_DIRECCIONES = 5
const CENTRO_BOGOTA = { lat: 4.711, lng: -74.0721 }

const URL_VALHALLA = 'https://valhalla1.openstreetmap.de/route'
const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'SafeTour/2.0 (proyecto academico)'

// Proveedor gratuito sin clave (Valhalla + Nominatim de OpenStreetMap).
// Se usa si ROUTING_PROVIDER=osm, o automáticamente cuando no hay ORS_API_KEY.
// ROUTING_PROVIDER=ors fuerza OpenRouteService.
const usaOsm = () => {
  const proveedor = process.env.ROUTING_PROVIDER
  if (proveedor === 'osm') return true
  if (proveedor === 'ors') return false
  return !process.env.ORS_API_KEY
}

const PERFILES_VALHALLA = {
  'a-pie': 'pedestrian',
  bicicleta: 'bicycle',
  vehiculo: 'auto',
  'transporte-publico': 'auto',
}

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

// Decodifica polylines de Valhalla (precisión 6) a [{ lat, lng }]
const decodificarPolyline = (cadena, precision = 6) => {
  const factor = 10 ** precision
  const puntos = []
  let indice = 0
  let lat = 0
  let lng = 0
  const leer = () => {
    let resultado = 0
    let desplazamiento = 0
    let byte
    do {
      byte = cadena.charCodeAt(indice++) - 63
      resultado |= (byte & 0x1f) << desplazamiento
      desplazamiento += 5
    } while (byte >= 0x20)
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1
  }
  while (indice < cadena.length) {
    lat += leer()
    lng += leer()
    puntos.push({ lat: lat / factor, lng: lng / factor })
  }
  return puntos
}

const pedirRutaOsm = async (modo, origen, destino, zonas) => {
  const cuerpo = {
    locations: [
      { lat: origen.lat, lon: origen.lng },
      { lat: destino.lat, lon: destino.lng },
    ],
    costing: PERFILES_VALHALLA[modo],
    directions_options: { units: 'kilometers' },
  }
  if (zonas) cuerpo.exclude_polygons = zonas.map((z) => cerrarAnillo(z.coordenadas))

  let respuesta
  try {
    respuesta = await fetch(URL_VALHALLA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    })
  } catch {
    throw new AppError(502, 'No se pudo calcular la ruta')
  }
  if (!respuesta.ok) throw new AppError(502, 'No se pudo calcular la ruta')

  const datos = await respuesta.json()
  const viaje = datos?.trip
  const forma = viaje?.legs?.[0]?.shape
  if (!forma || !viaje?.summary) throw new AppError(502, 'No se pudo calcular la ruta')

  return {
    distanciaM: Math.round(viaje.summary.length * 1000),
    duracionS: Math.round(viaje.summary.time),
    coordenadas: decodificarPolyline(forma),
  }
}

const buscarDireccionesOsm = async (texto) => {
  const parametros = new URLSearchParams({
    q: texto,
    format: 'jsonv2',
    limit: String(MAXIMO_DIRECCIONES),
    countrycodes: 'co',
    viewbox: '-74.25,4.85,-73.95,4.45',
  })
  let datos
  try {
    const respuesta = await fetch(`${URL_NOMINATIM}?${parametros}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    })
    if (!respuesta.ok) throw new Error('respuesta no válida')
    datos = await respuesta.json()
  } catch {
    throw new AppError(502, 'No se pudo buscar la dirección')
  }
  const resultados = (Array.isArray(datos) ? datos : [])
    .map((l) => ({ nombre: l?.display_name, lat: Number(l?.lat), lng: Number(l?.lon) }))
    .filter((r) => typeof r.nombre === 'string' && Number.isFinite(r.lat) && Number.isFinite(r.lng))
  return { resultados }
}

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

export const buscarDirecciones = async (texto) => {
  if (usaOsm()) return buscarDireccionesOsm(texto)
  const clave = process.env.ORS_API_KEY
  if (!clave) throw new AppError(503, 'Servicio de rutas no configurado')

  const parametros = new URLSearchParams({
    text: texto,
    size: String(MAXIMO_DIRECCIONES),
    'boundary.country': 'CO',
    'focus.point.lat': String(CENTRO_BOGOTA.lat),
    'focus.point.lon': String(CENTRO_BOGOTA.lng),
  })

  let datos
  try {
    const respuesta = await fetch(`${URL_DIRECCIONES}?${parametros}`, {
      headers: { Authorization: clave },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    })
    if (!respuesta.ok) throw new Error('respuesta no válida')
    datos = await respuesta.json()
  } catch {
    throw new AppError(502, 'No se pudo buscar la dirección')
  }

  const lugares = Array.isArray(datos?.features) ? datos.features : []
  const resultados = lugares
    .map((lugar) => ({
      nombre: lugar?.properties?.label,
      lat: lugar?.geometry?.coordinates?.[1],
      lng: lugar?.geometry?.coordinates?.[0],
    }))
    .filter(
      (r) => typeof r.nombre === 'string' && Number.isFinite(r.lat) && Number.isFinite(r.lng),
    )

  return { resultados }
}

export const obtenerRutas = async ({ origen, destino, modo }) => {
  const perfil = PERFILES[modo]
  const zonasRiesgo = await zonasDeAltoRiesgo()

  const pedir = usaOsm()
    ? (_perfil, o, d, zonas) => pedirRutaOsm(modo, o, d, zonas)
    : pedirRuta
  const zonasAEvitar = (z) => (usaOsm() ? z : poligonosAEvitar(z))

  const directa = await pedir(perfil, origen, destino, null)
  const rutas = [formatear('Ruta directa', directa, zonasRiesgo)]

  if (zonasRiesgo.length > 0) {
    try {
      const alterna = await pedir(perfil, origen, destino, zonasAEvitar(zonasRiesgo))
      rutas.push(formatear('Ruta evitando zonas de riesgo', alterna, zonasRiesgo))
    } catch {
      /* sin alterna: se devuelve solo la ruta directa */
    }
  }

  return { modo, aproximado: modo === 'transporte-publico', rutas }
}