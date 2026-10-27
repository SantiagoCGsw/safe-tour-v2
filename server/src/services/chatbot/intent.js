// server/src/services/chatbot/intent.js
import { readFileSync } from 'node:fs'
import { normalizar } from './guardrails.js'

export const INTENCIONES = Object.freeze([
  'riesgo_zona',
  'ruta_segura',
  'sitios_turisticos',
  'panico_ayuda',
  'saludo',
  'fuera_de_dominio',
])

const RUTA_MODELO = new URL('../../../../ml/models/intent.json', import.meta.url)
const UMBRAL_CONFIANZA = 0.45

const PALABRAS_VACIAS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'y', 'o', 'a', 'que', 'es', 'por',
  'para', 'con', 'me', 'mi', 'se', 'lo', 'al', 'hay', 'esta', 'este', 'muy', 'mas',
])

const REGLAS = Object.freeze({
  riesgo_zona: ['segur', 'riesg', 'peligr', 'zona', 'barrio', 'robo', 'hurto', 'insegur', 'cuidado', 'sector'],
  ruta_segura: ['ruta', 'camino', 'llegar', 'trayecto', 'recorrido', 'caminar', 'bicicleta', 'bus', 'transmilenio', 'destino'],
  sitios_turisticos: ['museo', 'turis', 'visitar', 'plaza', 'sitio', 'lugar', 'candelaria', 'monserrate', 'catedral', 'cultural'],
  panico_ayuda: ['panico', 'boton', 'contacto', 'sos', 'alerta'],
  saludo: ['hola', 'buenas', 'buenos', 'saludos', 'hey', 'gracias'],
})

let modeloCache

export const tokenizar = (texto) =>
  normalizar(texto)
    .split(' ')
    .filter((t) => t.length > 1 && !PALABRAS_VACIAS.has(t))

const modeloValido = (m) =>
  m &&
  Array.isArray(m.intenciones) &&
  Array.isArray(m.pesos) &&
  Array.isArray(m.sesgos) &&
  m.vocabulario &&
  typeof m.vocabulario === 'object' &&
  m.pesos.length === m.intenciones.length &&
  m.sesgos.length === m.intenciones.length &&
  m.intenciones.every((i) => INTENCIONES.includes(i))

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

const clasificarConModelo = (tokens, modelo) => {
  const conteo = new Map()
  for (const t of tokens) {
    if (modelo.vocabulario[t]) conteo.set(t, (conteo.get(t) ?? 0) + 1)
  }
  if (conteo.size === 0) return null

  const vector = []
  let norma = 0
  for (const [termino, tf] of conteo) {
    const { i, idf } = modelo.vocabulario[termino]
    const valor = tf * idf
    vector.push([i, valor])
    norma += valor * valor
  }
  norma = Math.sqrt(norma) || 1

  const puntajes = modelo.intenciones.map((_, k) => {
    let suma = modelo.sesgos[k]
    for (const [i, valor] of vector) suma += (modelo.pesos[k][i] ?? 0) * (valor / norma)
    return suma
  })
  const maximo = Math.max(...puntajes)
  const exp = puntajes.map((p) => Math.exp(p - maximo))
  const total = exp.reduce((a, b) => a + b, 0)
  const mejor = exp.indexOf(Math.max(...exp))
  return { intencion: modelo.intenciones[mejor], confianza: exp[mejor] / total, origen: 'modelo' }
}

const clasificarConReglas = (tokens) => {
  let mejor = null
  let mejorPuntaje = 0
  for (const [intencion, raices] of Object.entries(REGLAS)) {
    const puntaje = tokens.filter((t) => raices.some((r) => t.startsWith(r))).length
    if (puntaje > mejorPuntaje) {
      mejor = intencion
      mejorPuntaje = puntaje
    }
  }
  if (!mejor) return { intencion: 'fuera_de_dominio', confianza: 0.5, origen: 'reglas' }
  return { intencion: mejor, confianza: Math.min(0.9, 0.5 + 0.1 * mejorPuntaje), origen: 'reglas' }
}

export const clasificarIntencion = (texto) => {
  const tokens = tokenizar(texto)
  const modelo = cargarModelo()
  if (modelo) {
    const resultado = clasificarConModelo(tokens, modelo)
    if (resultado && resultado.confianza >= UMBRAL_CONFIANZA) return resultado
  }
  return clasificarConReglas(tokens)
}