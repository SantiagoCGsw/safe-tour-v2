
import mongoose from 'mongoose'
import Zone from '../../models/Zone.model.js'
import { AppError } from '../../middlewares/error.middleware.js'
import { calcularMapaDeCalor } from '../risk.service.js'
import {
  evaluarMensaje,
  normalizar,
  AVISO,
  LINEA_EMERGENCIAS,
} from './guardrails.js'
import { clasificarIntencion } from './intent.js'
import { predecirRiesgo } from './predictor.js'

const NOMBRE_FRANJA = Object.freeze({
  madrugada: 'la madrugada',
  manana: 'la mañana',
  tarde: 'la tarde',
  noche: 'la noche',
})

const ORDEN_RIESGO = Object.freeze({ alto: 0, medio: 1, bajo: 2 })

const ETIQUETAS_INTERES = Object.freeze({
  naturaleza: 'naturaleza y paisajes',
  historia: 'historia y patrimonio',
  cultura: 'cultura y museos',
  gastronomia: 'gastronomía local',
  aventura: 'aventura y actividades al aire libre',
  arquitectura: 'arquitectura',
  compras: 'compras y mercados',
  familia: 'actividades familiares',
  'vida-nocturna': 'vida nocturna',
})

const TEXTO_EMERGENCIA =
  `Si estás en peligro, llama ya a la línea de emergencias ${LINEA_EMERGENCIAS}. ` +
  'Desde Safe Tour puedes activar el botón de pánico para enviar tu ubicación a los contactos de emergencia que registraste, siempre que el servicio de envío esté activo.'

const TEXTO_AYUDA =
  'Puedo orientarte sobre el riesgo en una zona de Bogotá, las rutas seguras, los sitios turísticos y el botón de pánico.'

const TEXTO_FUERA =
  'Solo puedo ayudarte con seguridad y turismo en Bogotá: riesgo por zona, rutas seguras, sitios turísticos y el botón de pánico.'

const TEXTO_RUTA =
  'Para una ruta segura abre el mapa, elige el destino y tu modo de transporte: a pie, transporte público, vehículo o bicicleta. ' +
  'La app compara la ruta directa con otra que evita las zonas de riesgo alto, si existe. En transporte público el cálculo es aproximado.'

const TEXTO_PANICO =
  'El botón de pánico está en la pantalla principal. Pide una confirmación en dos pasos y permite hasta 3 activaciones por hora. ' +
  'Envía tu ubicación solo a los contactos de emergencia que registraste, siempre que el servicio de envío esté activo.'

const normalizarPreferencias = (preferencias = {}) => ({
  intereses: Array.isArray(preferencias.intereses)
    ? preferencias.intereses.filter(
        (interes) => typeof interes === 'string' && interes in ETIQUETAS_INTERES,
      )
    : [],
  ritmo: ['tranquilo', 'equilibrado', 'intenso'].includes(preferencias.ritmo)
    ? preferencias.ritmo
    : 'equilibrado',
  presupuesto: ['economico', 'moderado', 'flexible'].includes(
    preferencias.presupuesto,
  )
    ? preferencias.presupuesto
    : 'moderado',
  compania: [
    'indistinto',
    'solo',
    'pareja',
    'familia',
    'amigos',
  ].includes(preferencias.compania)
    ? preferencias.compania
    : 'indistinto',
  accesibilidad: preferencias.accesibilidad === true,
  evitarZonasRiesgosas: preferencias.evitarZonasRiesgosas !== false,
  lugaresTranquilos: preferencias.lugaresTranquilos === true,
  recomendacionesPersonalizadas:
    preferencias.recomendacionesPersonalizadas !== false,
  notas:
    typeof preferencias.notas === 'string'
      ? preferencias.notas.slice(0, 600).trim()
      : '',
})

const crearContextoPreferencias = (preferencias) => {
  if (!preferencias.recomendacionesPersonalizadas) return ''

  const detalles = []

  const intereses = preferencias.intereses
    .map((interes) => ETIQUETAS_INTERES[interes])
    .filter(Boolean)

  if (intereses.length > 0) {
    detalles.push(`tus intereses: ${intereses.join(', ')}`)
  }

  const ritmos = {
    tranquilo: 'un ritmo tranquilo, con descansos',
    equilibrado: 'un ritmo equilibrado',
    intenso: 'un ritmo intenso, con varias actividades',
  }

  detalles.push(ritmos[preferencias.ritmo])

  const presupuestos = {
    economico: 'un presupuesto económico',
    moderado: 'un presupuesto moderado',
    flexible: 'un presupuesto flexible',
  }

  detalles.push(presupuestos[preferencias.presupuesto])

  const companias = {
    indistinto: '',
    solo: 'viajas solo/a',
    pareja: 'viajas en pareja',
    familia: 'viajas con familia o niños',
    amigos: 'viajas con amigos',
  }

  if (companias[preferencias.compania]) {
    detalles.push(companias[preferencias.compania])
  }

  if (preferencias.accesibilidad) {
    detalles.push('necesitas considerar la accesibilidad cuando haya información disponible')
  }

  if (preferencias.lugaresTranquilos) {
    detalles.push('prefieres lugares tranquilos')
  }

  if (preferencias.evitarZonasRiesgosas) {
    detalles.push('priorizas recorridos que eviten zonas de riesgo alto cuando haya alternativas')
  }

  if (preferencias.notas) {
    detalles.push(`otras preferencias indicadas por ti: ${preferencias.notas}`)
  }

  return detalles.length
    ? ` Para personalizar la orientación, ten en cuenta estas preferencias del viajero: ${detalles.join('; ')}.`
    : ''
}

const buscarZona = async (texto) => {
  const zonas = await Zone.find({ activo: true })
    .select('nombre coordenadas nivelSeguridad')

  const coincidencias = zonas
    .map((zona) => ({ zona, nombre: normalizar(zona.nombre) }))
    .filter(({ nombre }) => nombre.length >= 3 && texto.includes(nombre))
    .sort((a, b) => b.nombre.length - a.nombre.length)

  return coincidencias[0]?.zona ?? null
}

const responderRiesgoZona = async (texto, preferencias) => {
  const zona = await buscarZona(texto)
  const { zonas } = await calcularMapaDeCalor()

  if (zona) {
    const actual = zonas.find(
      (z) => String(z.zonaId) === String(zona._id),
    )

    const prediccion = await predecirRiesgo(zona)

    const origen =
      prediccion.fuente === 'modelo'
        ? 'según el modelo entrenado'
        : 'según el histórico de los últimos 30 días'

    const respuesta =
      `${zona.nombre}: riesgo actual ${actual?.riesgo ?? 'bajo'}, ` +
      `con ${actual?.reportes ?? 0} reportes validados vigentes. ` +
      `Para ${NOMBRE_FRANJA[prediccion.franja]} el nivel estimado es ` +
      `${prediccion.nivel}, ${origen}. ` +
      `Nivel de seguridad de la zona: ${zona.nivelSeguridad} de 5, ` +
      'donde 1 es el mayor riesgo.'

    return respuesta + (
      preferencias.evitarZonasRiesgosas
        ? ' Como priorizas la seguridad, revisa las alertas vigentes y las alternativas disponibles antes de desplazarte.'
        : ''
    )
  }

  if (zonas.length === 0) {
    return 'Aún no hay zonas registradas.'
  }

  const conReportes = zonas
    .filter((z) => z.reportes > 0)
    .sort(
      (a, b) =>
        ORDEN_RIESGO[a.riesgo] - ORDEN_RIESGO[b.riesgo] ||
        b.reportes - a.reportes,
    )
    .slice(0, 3)

  if (conReportes.length === 0) {
    return 'No hay reportes validados vigentes en este momento.'
  }

  const lista = conReportes
    .map((z) => `${z.nombre} (riesgo ${z.riesgo}, ${z.reportes} reportes)`)
    .join('; ')

  return (
    `Zonas con más reportes validados vigentes: ${lista}. ` +
    'Menciona el nombre de una zona para ver su detalle.'
  )
}

const responderSitios = async (preferencias) => {
  const sitios = await Zone.find({
    activo: true,
    tipo: mongoose.trusted({ $in: ['turistica', 'cultural'] }),
  })
    .sort({ nivelSeguridad: -1 })
    .limit(5)
    .select('nombre nivelSeguridad')

  if (sitios.length === 0) {
    return 'Aún no hay sitios turísticos registrados.'
  }

  const lista = sitios
    .map((sitio) => `${sitio.nombre} (seguridad ${sitio.nivelSeguridad} de 5)`)
    .join('; ')

  const contexto = crearContextoPreferencias(preferencias)

  return (
    `Sitios turísticos y culturales registrados, de mayor a menor nivel de seguridad: ${lista}.` +
    contexto +
    ' Estas preferencias sirven como orientación; la lista mostrada se basa en los datos registrados y el nivel de seguridad disponible.'
  )
}

const construirRespuesta = async (intencion, texto, preferencias) => {
  switch (intencion) {
    case 'riesgo_zona':
      return responderRiesgoZona(texto, preferencias)

    case 'ruta_segura':
      return TEXTO_RUTA + crearContextoPreferencias(preferencias)

    case 'sitios_turisticos':
      return responderSitios(preferencias)

    case 'panico_ayuda':
      return TEXTO_PANICO

    case 'saludo':
      return `Hola. ${TEXTO_AYUDA}${crearContextoPreferencias(preferencias)}`

    default:
      return TEXTO_FUERA
  }
}

export const responderMensaje = async (mensaje, preferenciasUsuario = {}) => {
  const evaluado = evaluarMensaje(mensaje)

  if (!evaluado.valido) {
    throw new AppError(400, 'Mensaje inválido')
  }

  // Las preferencias nunca deben alterar la respuesta de emergencia.
  if (evaluado.emergencia) {
    return {
      respuesta: TEXTO_EMERGENCIA,
      intencion: 'emergencia',
      confianza: 1,
      emergencia: true,
      aviso: AVISO,
    }
  }

  const preferencias = normalizarPreferencias(preferenciasUsuario)
  const { intencion, confianza } = clasificarIntencion(evaluado.texto)

  const respuesta = await construirRespuesta(
    intencion,
    evaluado.texto,
    preferencias,
  )

  return {
    respuesta,
    intencion,
    confianza: Math.round(confianza * 100) / 100,
    emergencia: false,
    aviso: AVISO,
  }
}
