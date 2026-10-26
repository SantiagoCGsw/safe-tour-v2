import { z } from 'zod'
import { TIPOS_REPORTE } from '../models/Report.model.js'

const tipo = z.enum(TIPOS_REPORTE)

const idParam = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido')

export const crearReporteSchema = {
  body: z.strictObject({
    titulo: z.string().trim().min(3).max(120),
    descripcion: z.string().trim().max(1000).optional(),
    tipo,
    ubicacion: z.strictObject({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      direccion: z.string().trim().max(200).optional(),
    }),
  }),
}

export const listarReportesSchema = {
  query: z.strictObject({
    tipo: tipo.optional(),
    limite: z.coerce.number().int().min(1).max(100).default(50),
  }),
}

export const resolverDisputaSchema = {
  params: z.strictObject({ id: idParam }),
  body: z.strictObject({ decision: z.enum(['confirmado', 'rechazado']) }),
}