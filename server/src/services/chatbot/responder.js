// server/src/services/chatbot/responder.js
import mongoose from 'mongoose'
import Zone from '../../models/Zone.model.js'
import { AppError } from '../../middlewares/error.middleware.js'
import { calcularMapaDeCalor } from '../risk.service.js'
import { evaluarMensaje, normalizar, AVISO, LINEA_EMERGENCIAS } from './guardrails.js'
import { clasificarIntencion } from './intent.js'
import { predecirRiesgo } from './predictor.js'

const NOMBRE_FRANJA = Object.freeze({
  madrugada: 'la madrugada',
  manana: 'la mañana',
  tarde: 'la tarde',
  noche: 'la noche',
})

const ORDEN_RIESGO = Object.freeze({ alto: 0, medio: 1, bajo: 2 })

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

const buscarZona = async (texto) => {
  const zonas = await Zone.find({ activo: true }).select('nombre coordenadas nivelSeguridad')
  const coincidencias = zonas
    .map((zona) => ({ zona, nombre: normalizar(zona.nombre) }))
    .filter(({ nombre }) => nombre.length >= 3 && texto.includes(nombre))
    .sort((a, b) => b.nombre.length - a.nombre.length)
  return coincidencias[0]?.zona ?? null
}

const responderRiesgoZona = async (texto) => {
  const zona = await buscarZona(texto)
  const { zonas } = await calcularMapaDeCalor()

  if (zona) {
    const actual = zonas.find((z) => String(z.zonaId) === String(zona._id))
    const prediccion = await predecirRiesgo(zona)
    const origen =
      prediccion.fuente === 'modelo'
        ? 'según el modelo entrenado'
        : 'según el histórico de los últimos 30 días'
    return (
      `${zona.nombre}: riesgo actual ${actual?.riesgo ?? 'bajo'}, con ${actual?.reportes ?? 0} reportes validados vigentes. ` +
      `Para ${NOMBRE_FRANJA[prediccion.franja]} el nivel estimado es ${prediccion.nivel}, ${origen}. ` +
      `Nivel de seguridad de la zona: ${zona.nivelSeguridad} de 5, donde 1 es el mayor riesgo.`
    )
  }

  if (zonas.length === 0) return 'Aún no hay zonas registradas.'
  const conReportes = zonas
    .filter((z) => z.reportes > 0)
    .sort((a, b) => ORDEN_RIESGO[a.riesgo] - ORDEN_RIESGO[b.riesgo] || b.reportes - a.reportes)
    .slice(0, 3)
  if (conReportes.length === 0) return 'No hay reportes validados vigentes en este momento.'
  const lista = conReportes.map((z) => `${z.nombre} (riesgo ${z.riesgo}, ${z.reportes} reportes)`).join('; ')
  return `Zonas con más reportes validados vigentes: ${lista}. Menciona el nombre de una zona para ver su detalle.`
}

const responderSitios = async () => {
  const sitios = await Zone.find({
    activo: true,
    tipo: mongoose.trusted({ $in: ['turistica', 'cultural'] }),
  })
    .sort({ nivelSeguridad: -1 })
    .limit(5)
    .select('nombre nivelSeguridad')
  if (sitios.length === 0) return 'Aún no hay sitios turísticos registrados.'
  const lista = sitios.map((s) => `${s.nombre} (seguridad ${s.nivelSeguridad} de 5)`).join('; ')
  return `Sitios turísticos y culturales registrados, de mayor a menor nivel de seguridad: ${lista}.`
}

const construirRespuesta = async (intencion, texto) => {
  switch (intencion) {
    case 'riesgo_zona':
      return responderRiesgoZona(texto)
    case 'ruta_segura':
      return TEXTO_RUTA
    case 'sitios_turisticos':
      return responderSitios()
    case 'panico_ayuda':
      return TEXTO_PANICO
    case 'saludo':
      return `Hola. ${TEXTO_AYUDA}`
    default:
      return TEXTO_FUERA
  }
}

export const responderMensaje = async (mensaje) => {
  const evaluado = evaluarMensaje(mensaje)
  if (!evaluado.valido) throw new AppError(400, 'Mensaje inválido')

  if (evaluado.emergencia) {
    return {
      respuesta: TEXTO_EMERGENCIA,
      intencion: 'emergencia',
      confianza: 1,
      emergencia: true,
      aviso: AVISO,
    }
  }

  const { intencion, confianza } = clasificarIntencion(evaluado.texto)
  const respuesta = await construirRespuesta(intencion, evaluado.texto)
  return {
    respuesta,
    intencion,
    confianza: Math.round(confianza * 100) / 100,
    emergencia: false,
    aviso: AVISO,
  }
}