import dotenv from 'dotenv'
import { z } from 'zod'

if (process.env.NODE_ENV !== 'test') dotenv.config({ quiet: true })

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  CORS_ORIGINS: z.string().min(1),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
})

const resultado = esquema.safeParse(process.env)

if (!resultado.success) {
  const campos = [...new Set(resultado.error.issues.map((i) => i.path.join('.')))].join(', ')
  throw new Error(`Configuración inválida en: ${campos}`)
}

const datos = resultado.data

const origenes = datos.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean)

if (origenes.length === 0 || origenes.some((o) => o.includes('*'))) {
  throw new Error('Configuración inválida en: CORS_ORIGINS')
}

if (datos.NODE_ENV !== 'test' && datos.BCRYPT_COST < 12) {
  throw new Error('Configuración inválida en: BCRYPT_COST')
}

export const env = Object.freeze({ ...datos, CORS_ORIGINS: origenes })