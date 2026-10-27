// server/src/services/chatbot/predictor.js
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import Report, { ESTADOS_MAPA } from '../../models/Report.model.js'
import Config from '../../models/Config.model.js'
import { puntoEnPoligono, clasificarRiesgo } from '../risk.service.js'

const RUTA_MODELO = new URL('../../../../ml/models/risk.json', import.meta.url)
const DIA_MS = 24 * 60 * 60 * 1000
const HORA_MS = 60 * 60 * 1000
const VENTANA_DIAS = 30

export const FRANJAS = Object.freeze(['madrugada', 'manana', 'tarde', 'noche'])

export const CARACTERISTICAS = Object.freeze([
  'franja_madrugada',
  'franja_manana',
  'franja_tarde',
  'franja_noche',
  'fin_de_semana',
  'nivel_seguridad',
  'reportes_franja',
])

let modeloCache

const aHoraBogota = (fecha) => new Date(fecha.getTime() - 5 * HORA_MS)

export const franjaDe = (fecha) => {
  const hora = aHoraBogota(fecha).getUTCHours()
  if (hora < 6) return 'madrugada'
  if (hora < 12) return 'manana'
  if (hora < 18) return 'tarde'
  return 'noche'
}

export const esFinDeSemana = (fecha) => {
  const dia = aHoraBogota(fecha).getUTCDay()
  return dia === 0 || dia === 6
}

export const construirCaracteristicas = ({ franja, finDeSemana, nivelSeguridad, reportesFranja, umbral }) => [
  ...FRANJAS.map((f) => (f === franja ? 1 : 0)),
  finDeSemana ? 1 : 0,
  (nivelSeguridad - 1) / 4,
  Math.min(reportesFranja / umbral, 2) / 2,
]

const modeloValido = (m) =>
  m &&
  Array.isArray(m.caracteristicas) &&
  Array.isArray(m.pesos) &&
  typeof m.sesgo === 'number' &&
  m.caracteristicas.length === CARACTERISTICAS.length &&
  m.caracteristicas.every((c, i) => c === CARACTERISTICAS[i]) &&
  m.pesos.length === CARACTERISTICAS.length &&
  m.pesos.every((p) => typeof p === 'number')

const cargarModelo = () => {
  if (modeloCache !== undefined) return modeloCache
  try {
    const crudo = JSON.parse(readFileSync(RUTA_MODELO, 'utf8'))
    modeloCache = modeloValido(crudo) ? crudo : null
  } catch {
    modeloCache = null
  }
  return modeloCache
}

const nivelPorProbabilidad = (p) => {
  if (p >= 0.66) return 'alto'
  if (p >= 0.33) return 'medio'
  return 'bajo'
}

export const predecirRiesgo = async (zona, fecha = new Date()) => {
  const config = await Config.obtener()
  const desde = new Date(fecha.getTime() - VENTANA_DIAS * DIA_MS)

  const reportes = await Report.find({
    activo: true,
    estado: mongoose.trusted({ $in: ESTADOS_MAPA }),
    createdAt: mongoose.trusted({ $gte: desde }),
  }).select('ubicacion createdAt')

  const franja = franjaDe(fecha)
  const reportesFranja = reportes.filter(
    (r) => franjaDe(r.createdAt) === franja && puntoEnPoligono(r.ubicacion, zona.coordenadas),
  ).length

  const modelo = cargarModelo()
  if (modelo) {
    const x = construirCaracteristicas({
      franja,
      finDeSemana: esFinDeSemana(fecha),
      nivelSeguridad: zona.nivelSeguridad,
      reportesFranja,
      umbral: config.umbralAltoRiesgo,
    })
    const z = x.reduce((suma, valor, i) => suma + valor * modelo.pesos[i], modelo.sesgo)
    const probabilidad = 1 / (1 + Math.exp(-z))
    return {
      nivel: nivelPorProbabilidad(probabilidad),
      probabilidad: Math.round(probabilidad * 100) / 100,
      fuente: 'modelo',
      franja,
      reportesFranja,
    }
  }

  return {
    nivel: clasificarRiesgo(reportesFranja, config.umbralAltoRiesgo),
    probabilidad: null,
    fuente: 'historico',
    franja,
    reportesFranja,
  }
}