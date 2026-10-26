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
  .refine(esHttps, { message: 'La foto debe ser una URL https' })

export const actualizarPerfilSchema = {
  body: z
    .strictObject({
      nombre: z.string().trim().min(2).max(80).optional(),
      fotoPerfil: z.union([z.literal(''), fotoHttps]).optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'Sin cambios' }),
}