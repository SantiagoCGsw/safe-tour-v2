import { z } from 'zod'
import { ROLES } from '../models/User.model.js'

const MAX_BYTES_BCRYPT = 72

const nombre = z.string().trim().min(2).max(80)

const email = z.string().trim().toLowerCase().max(254).pipe(z.email())

const passwordNueva = z
  .string()
  .min(8)
  .refine((v) => Buffer.byteLength(v, 'utf8') <= MAX_BYTES_BCRYPT, {
    message: 'La contraseña es demasiado larga',
  })
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    message: 'La contraseña debe combinar letras y números',
  })

export const registerSchema = {
  body: z.strictObject({ nombre, email, password: passwordNueva }),
}

export const loginSchema = {
  body: z.strictObject({
    email,
    password: z.string().min(1).max(200),
  }),
}

export const crearCuentaSchema = {
  body: z.strictObject({
    nombre,
    email,
    password: passwordNueva,
    rol: z.enum(ROLES),
  }),
}