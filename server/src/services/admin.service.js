import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import User, { ROLES } from '../models/User.model.js'
import Zone, { TIPOS_ZONA } from '../models/Zone.model.js'
import Report from '../models/Report.model.js'
import Config from '../models/Config.model.js'
import { env } from '../config/env.js'
import { AppError } from '../middlewares/error.middleware.js'
import { registrarAuditoria } from '../utils/audit.js'

const PROPIA_CUENTA = 'No puedes modificar tu propia cuenta'
const NO_ENCONTRADO = 'Usuario no encontrado'

const filtroFechas = ({ desde, hasta } = {}) => {
  const rango = {}
  if (desde) rango.$gte = desde
  if (hasta) rango.$lte = hasta
  return Object.keys(rango).length > 0 ? { createdAt: mongoose.trusted(rango) } : {}
}

const cargarObjetivo = async (actor, id) => {
  if (String(actor._id) === String(id)) throw new AppError(403, PROPIA_CUENTA)
  const objetivo = await User.findById(id)
  if (!objetivo) throw new AppError(404, NO_ENCONTRADO)
  return objetivo
}

export const listarUsuarios = ({ rol, activo } = {}) => {
  const filtro = {}
  if (rol) filtro.rol = rol
  if (activo !== undefined) filtro.activo = activo === 'true'
  return User.find(filtro).sort({ createdAt: 1 })
}

export const crearCuenta = async (actor, { nombre, email, password, rol }) => {
  const hash = await bcrypt.hash(password, env.BCRYPT_COST)
  const user = await User.create({ nombre, email, password: hash, rol })
  await registrarAuditoria({
    actor: actor._id,
    accion: 'usuario.crear',
    objetivo: user._id,
    detalle: { rol },
  })
  return user
}

export const cambiarRol = async (actor, id, rol) => {
  const objetivo = await cargarObjetivo(actor, id)
  const anterior = objetivo.rol
  if (anterior === rol) return objetivo

  objetivo.rol = rol
  await objetivo.save()
  await registrarAuditoria({
    actor: actor._id,
    accion: 'usuario.cambiar_rol',
    objetivo: objetivo._id,
    detalle: { de: anterior, a: rol },
  })
  return objetivo
}

export const cambiarEstado = async (actor, id, activo) => {
  const objetivo = await cargarObjetivo(actor, id)
  if (objetivo.activo === activo) return objetivo

  objetivo.activo = activo
  await objetivo.save()
  await registrarAuditoria({
    actor: actor._id,
    accion: activo ? 'usuario.activar' : 'usuario.desactivar',
    objetivo: objetivo._id,
  })
  return objetivo
}

export const obtenerEstadisticas = async (rango = {}) => {
  const fechas = filtroFechas(rango)

  const [totalUsuarios, porRolConteo, zonasActivas, porTipoConteo, reportes] = await Promise.all([
    User.countDocuments(fechas),
    Promise.all(ROLES.map((rol) => User.countDocuments({ ...fechas, rol }))),
    Zone.countDocuments({ ...fechas, activo: true }),
    Promise.all(TIPOS_ZONA.map((tipo) => Zone.countDocuments({ ...fechas, activo: true, tipo }))),
    Report.countDocuments({ ...fechas, activo: true }),
  ])

  return {
    usuarios: {
      total: totalUsuarios,
      porRol: Object.fromEntries(ROLES.map((rol, i) => [rol, porRolConteo[i]])),
    },
    zonas: {
      activas: zonasActivas,
      porTipo: Object.fromEntries(TIPOS_ZONA.map((tipo, i) => [tipo, porTipoConteo[i]])),
    },
    reportes,
  }
}

export const obtenerConfiguracion = () => Config.obtener()

export const actualizarConfiguracion = async (actor, cambios) => {
  const actual = await Config.obtener()
  const anterior = {}
  for (const clave of Object.keys(cambios)) anterior[clave] = actual[clave]

  const config = await Config.findOneAndUpdate(
    { clave: 'global' },
    { $set: cambios },
    { new: true, runValidators: true },
  )

  await registrarAuditoria({
    actor: actor._id,
    accion: 'config.actualizar',
    detalle: { de: anterior, a: cambios },
  })
  return config
}