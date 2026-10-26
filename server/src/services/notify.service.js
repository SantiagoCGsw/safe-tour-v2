import mongoose from 'mongoose'
import EmergencyContact from '../models/EmergencyContact.model.js'
import AuditLog from '../models/AuditLog.model.js'
import { AppError } from '../middlewares/error.middleware.js'
import { registrarAuditoria } from '../utils/audit.js'

const HORA_MS = 60 * 60 * 1000
const LIMITE_PANICO_POR_HORA = 3

const canales = []

export const registrarCanal = (canal) => {
  canales.push(canal)
}

const construirMensaje = (user, { lat, lng }) =>
  `Alerta de pánico de ${user.nombre}. Ubicación: https://www.google.com/maps?q=${lat},${lng}`

export const activarPanico = async (user, ubicacion) => {
  const recientes = await AuditLog.countDocuments({
    actor: user._id,
    accion: 'panico.activar',
    createdAt: mongoose.trusted({ $gte: new Date(Date.now() - HORA_MS) }),
  })
  if (recientes >= LIMITE_PANICO_POR_HORA) {
    throw new AppError(429, 'Superaste el límite de alertas por hora')
  }

  const contactos = await EmergencyContact.find({ usuario: user._id })
  if (contactos.length === 0) {
    throw new AppError(409, 'Registra al menos un contacto de emergencia')
  }

  const mensaje = construirMensaje(user, ubicacion)
  let entregados = 0

  for (const contacto of contactos) {
    for (const canal of canales) {
      try {
        const enviado = await canal.enviar(contacto, mensaje)
        if (enviado) entregados += 1
      } catch {
        /* un canal caído no detiene los demás */
      }
    }
  }

  await registrarAuditoria({
    actor: user._id,
    accion: 'panico.activar',
    detalle: { contactos: contactos.length, entregados },
  })

  return { contactos: contactos.length, entregados, canalesConfigurados: canales.length }
}