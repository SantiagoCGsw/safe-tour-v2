import mongoose from 'mongoose'
import { ZodError } from 'zod'
import { env } from '../config/env.js'

export class AppError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}

export const notFound = (req, res) => {
  res.status(404).json({ message: 'Recurso no encontrado' })
}

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err)

  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message })
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Datos inválidos' })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'JSON inválido' })
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Solicitud demasiado grande' })
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: 'Identificador inválido' })
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: 'Datos inválidos' })
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'El recurso ya existe' })
  }

  if (env.NODE_ENV !== 'test') console.error(`[${err.name}] ${err.message}`)
  res.status(500).json({ message: 'Error interno del servidor' })
}