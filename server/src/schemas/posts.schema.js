// server/src/schemas/posts.schema.js
import { z } from 'zod'

const idParam = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido')

const limite = z.coerce.number().int().min(1).max(100).default(30)

export const listarPostsSchema = {
  query: z.strictObject({
    zona: idParam.optional(),
    limite,
  }),
}

export const moderacionPostsSchema = {
  query: z
    .strictObject({
      zona: idParam.optional(),
      autor: idParam.optional(),
      desde: z.coerce.date().optional(),
      hasta: z.coerce.date().optional(),
      limite,
    })
    .refine((v) => !v.desde || !v.hasta || v.desde <= v.hasta, {
      message: 'El rango de fechas es inválido',
    }),
}

export const crearPostSchema = {
  body: z.strictObject({
    contenido: z.string().trim().min(1).max(500),
    zona: idParam.optional(),
  }),
}

export const postIdSchema = {
  params: z.strictObject({ id: idParam }),
}

export const comentarSchema = {
  params: z.strictObject({ id: idParam }),
  body: z.strictObject({
    texto: z.string().trim().min(1).max(300),
  }),
}

export const denunciarSchema = {
  params: z.strictObject({ id: idParam }),
  body: z.strictObject({
    motivo: z.string().trim().min(3).max(200),
  }),
}