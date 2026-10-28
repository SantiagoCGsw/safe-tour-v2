
import { z } from 'zod'

const esHttps = (valor) => {
  try {
    return new URL(valor).protocol === 'https:'
  } catch {
    return false
  }
}

const fotoHttps = z
  .string()
  .trim()
  .max(500)
  .refine(esHttps, {
    message: 'La foto debe ser una URL https',
  })

const preferenciasAsistenteSchema = z.strictObject({
  intereses: z
    .array(
      z.enum([
        'naturaleza',
        'historia',
        'cultura',
        'gastronomia',
        'aventura',
        'arquitectura',
        'compras',
        'familia',
        'vida-nocturna',
      ]),
    )
    .max(9),

  ritmo: z.enum(['tranquilo', 'equilibrado', 'intenso']),

  presupuesto: z.enum(['economico', 'moderado', 'flexible']),

  compania: z.enum([
    'indistinto',
    'solo',
    'pareja',
    'familia',
    'amigos',
  ]),

  accesibilidad: z.boolean(),

  evitarZonasRiesgosas: z.boolean(),

  lugaresTranquilos: z.boolean(),

  recomendacionesPersonalizadas: z.boolean(),

  notas: z.string().trim().max(600),
})

export const actualizarPerfilSchema = {
  body: z
    .strictObject({
      nombre: z.string().trim().min(2).max(80).optional(),

      fotoPerfil: z
        .union([z.literal(''), fotoHttps])
        .optional(),

      preferenciasAsistente: preferenciasAsistenteSchema.optional(),
    })
    .refine((valor) => Object.keys(valor).length > 0, {
      message: 'Sin cambios',
    }),
}
