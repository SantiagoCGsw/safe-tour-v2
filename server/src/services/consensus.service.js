import mongoose from 'mongoose'
import Report, { ESTADOS_FEED } from '../models/Report.model.js'
import Vote from '../models/Vote.model.js'
import Config from '../models/Config.model.js'
import { env } from '../config/env.js'
import { AppError } from '../middlewares/error.middleware.js'
import { registrarAuditoria } from '../utils/audit.js'
import { registrarCierre } from './chain.service.js'

const HORA_MS = 60 * 60 * 1000
const LIMITE_REPORTES_POR_HORA = 10
const ROLES_DE_PUBLICACION_DIRECTA = ['gestor', 'admin']

export const PORCENTAJE_CONSENSO = 51

export const decidirResultado = ({ confirmaciones, rechazos }, quorum) => {
  const total = confirmaciones + rechazos
  if (total < quorum) return 'disputa'
  if (confirmaciones * 100 >= PORCENTAJE_CONSENSO * total) return 'confirmado'
  if (rechazos * 100 >= PORCENTAJE_CONSENSO * total) return 'rechazado'
  return 'disputa'
}

export const crearReporte = async (user, datos) => {
  const config = await Config.obtener()
  const directo = ROLES_DE_PUBLICACION_DIRECTA.includes(user.rol)

  if (!directo) {
    const recientes = await Report.countDocuments({
      autor: user._id,
      createdAt: mongoose.trusted({ $gte: new Date(Date.now() - HORA_MS) }),
    })
    if (recientes >= LIMITE_REPORTES_POR_HORA) {
      throw new AppError(429, 'Superaste el límite de reportes por hora')
    }
  }

  return Report.create({
    ...datos,
    autor: user._id,
    estado: directo ? 'publicado' : 'pendiente',
    cierreVotacion: directo
      ? undefined
      : new Date(Date.now() + config.plazoVotacionHoras * HORA_MS),
  })
}

export const listarReportes = ({ tipo, limite = 50 } = {}) => {
  const filtro = { activo: true, estado: mongoose.trusted({ $in: ESTADOS_FEED }) }
  if (tipo) filtro.tipo = tipo
  return Report.find(filtro).sort({ createdAt: -1 }).limit(limite).populate('autor', 'nombre')
}

export const historialDeUsuario = (userId) =>
  Report.find({ autor: userId }).sort({ createdAt: -1 }).limit(100)

export const listarDisputas = () =>
  Report.find({ activo: true, estado: 'disputa' }).sort({ createdAt: 1 }).populate('autor', 'nombre')

export const resolverDisputa = async (gestor, id, decision) => {
  const reporte = await Report.findOneAndUpdate(
    { _id: id, activo: true, estado: 'disputa' },
    { $set: { estado: decision, resueltoPor: gestor._id, resueltoEn: new Date() } },
    { new: true },
  )
  if (!reporte) throw new AppError(404, 'Reporte en disputa no encontrado')

  await registrarAuditoria({
    actor: gestor._id,
    accion: 'reporte.resolver_disputa',
    objetivo: reporte.autor,
    detalle: { reporteId: String(reporte._id), decision },
  })
  return reporte
}

export const votar = async (user, reporteId, voto) => {
  const reporte = await Report.findOne({ _id: reporteId, activo: true })
  if (!reporte) throw new AppError(404, 'Reporte no encontrado')

  if (String(reporte.autor) === String(user._id)) {
    throw new AppError(403, 'No puedes votar tu propio reporte')
  }

  const vencido = reporte.cierreVotacion && reporte.cierreVotacion <= new Date()
  if (reporte.estado !== 'pendiente' || vencido) {
    throw new AppError(409, 'La votación de este reporte está cerrada')
  }

  try {
    await Vote.create({ reporte: reporte._id, usuario: user._id, voto })
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'Ya votaste este reporte')
    throw err
  }

  const campo = voto === 'confirmar' ? 'confirmaciones' : 'rechazos'
  return Report.findByIdAndUpdate(reporte._id, { $inc: { [campo]: 1 } }, { new: true })
}

export const votoDe = async (user, reporteId) => {
  const registro = await Vote.findOne({ reporte: reporteId, usuario: user._id }).select('voto')
  return registro ? registro.voto : null
}

export const cerrarVotacion = async (reporteId) => {
  const reporte = await Report.findOne({ _id: reporteId, activo: true, estado: 'pendiente' })
  if (!reporte) return null

  const config = await Config.obtener()
  const decision = decidirResultado(reporte, config.quorum)

  const cerrado = await Report.findOneAndUpdate(
    { _id: reporte._id, estado: 'pendiente' },
    { $set: { estado: decision } },
    { new: true },
  )
  if (!cerrado) return null

  try {
    await registrarCierre(cerrado, decision)
  } catch (err) {
    if (env.NODE_ENV !== 'test') console.error(`[registro de cierre] ${err.message}`)
  }
  return cerrado
}

export const cerrarVotacionesVencidas = async () => {
  const vencidos = await Report.find({
    activo: true,
    estado: 'pendiente',
    cierreVotacion: mongoose.trusted({ $lte: new Date() }),
  }).select('_id')

  let cerrados = 0
  for (const { _id } of vencidos) {
    if (await cerrarVotacion(_id)) cerrados += 1
  }
  return cerrados
}