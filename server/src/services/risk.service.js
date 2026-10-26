import mongoose from 'mongoose'
import Zone from '../models/Zone.model.js'
import Report, { ESTADOS_MAPA } from '../models/Report.model.js'
import Config from '../models/Config.model.js'

const HORA_MS = 60 * 60 * 1000

export const puntoEnPoligono = (punto, poligono) => {
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

export const clasificarRiesgo = (conteo, umbral) => {
  if (conteo >= umbral) return 'alto'
  if (conteo >= Math.ceil(umbral / 2)) return 'medio'
  return 'bajo'
}

const analizar = async () => {
  const config = await Config.obtener()
  const desde = new Date(Date.now() - config.vigenciaReporteHoras * HORA_MS)

  const [zonas, reportes] = await Promise.all([
    Zone.find({ activo: true }),
    Report.find({
      activo: true,
      estado: mongoose.trusted({ $in: ESTADOS_MAPA }),
      createdAt: mongoose.trusted({ $gte: desde }),
    }).select('tipo ubicacion'),
  ])

  const puntos = reportes.map((r) => ({
    lat: r.ubicacion.lat,
    lng: r.ubicacion.lng,
    tipo: r.tipo,
  }))

  const resumen = zonas.map((zona) => {
    const conteo = puntos.filter((p) => puntoEnPoligono(p, zona.coordenadas)).length
    return {
      zonaId: zona._id,
      nombre: zona.nombre,
      nivelSeguridad: zona.nivelSeguridad,
      reportes: conteo,
      riesgo: clasificarRiesgo(conteo, config.umbralAltoRiesgo),
    }
  })

  return { config, zonas, puntos, resumen }
}

export const calcularMapaDeCalor = async () => {
  const { config, puntos, resumen } = await analizar()
  return { puntos, zonas: resumen, umbralAltoRiesgo: config.umbralAltoRiesgo }
}

export const zonasDeAltoRiesgo = async () => {
  const { zonas, resumen } = await analizar()
  const ids = new Set(
    resumen.filter((z) => z.riesgo === 'alto' || z.nivelSeguridad <= 1).map((z) => String(z.zonaId)),
  )
  return zonas.filter((z) => ids.has(String(z._id)))
}