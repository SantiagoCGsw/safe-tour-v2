import mongoose from 'mongoose'
import User from '../models/User.model.js'
import { AppError } from './error.middleware.js'
import { verifyToken } from '../utils/generateToken.js'

const NO_AUTORIZADO = 'No autorizado'

const extraerToken = (req) => {
  const cabecera = req.headers.authorization
  if (!cabecera || !cabecera.startsWith('Bearer ')) return null
  return cabecera.slice(7).trim() || null
}

export const protect = async (req, res, next) => {
  const token = extraerToken(req)
  if (!token) throw new AppError(401, NO_AUTORIZADO)

  let payload
  try {
    payload = verifyToken(token)
  } catch {
    throw new AppError(401, NO_AUTORIZADO)
  }

  if (typeof payload.id !== 'string' || !mongoose.isValidObjectId(payload.id)) {
    throw new AppError(401, NO_AUTORIZADO)
  }

  const user = await User.findById(payload.id)
  if (!user || !user.activo) throw new AppError(401, NO_AUTORIZADO)

  req.user = user
  next()
}

export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      throw new AppError(403, 'Acceso denegado')
    }
    next()
  }