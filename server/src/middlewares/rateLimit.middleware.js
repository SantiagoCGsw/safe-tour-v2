import { rateLimit } from 'express-rate-limit'
import { env } from '../config/env.js'

const VENTANA_MS = 15 * 60 * 1000

export const crearLimitador = (opciones) =>
  rateLimit({
    windowMs: VENTANA_MS,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Demasiadas solicitudes, intenta más tarde' },
    ...opciones,
  })

export const limitadorGlobal = crearLimitador({ limit: env.RATE_LIMIT_GLOBAL_MAX })

export const limitadorDirecciones = crearLimitador({ limit: 30 })

export const limitadorAuth = crearLimitador({
  limit: env.RATE_LIMIT_AUTH_MAX,
  skipSuccessfulRequests: true,
})