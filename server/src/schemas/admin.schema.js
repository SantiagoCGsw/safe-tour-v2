import { z } from 'zod'
import { ROLES } from '../models/User.model.js'

const idParam = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido')

export const listarUsuariosSchema = {
  query: z.strictObject({
    rol: z.enum(ROLES).optional(),
    activo: z.enum(['true', 'false']).optional(),
  }),
}

export const cambiarRolSchema = {
  params: z.strictObject({ id: idParam }),
  body: z.strictObject({ rol: z.enum(ROLES) }),
}

export const cambiarEstadoSchema = {
  params: z.strictObject({ id: idParam }),
  body: z.strictObject({ activo: z.boolean() }),
}

export const estadisticasSchema = {
  query: z
    .strictObject({
      desde: z.coerce.date().optional(),
      hasta: z.coerce.date().optional(),
    })
    .refine((v) => !v.desde || !v.hasta || v.desde <= v.hasta, {
      message: 'El rango de fechas es inválido',
    }),
}

export const actualizarConfigSchema = {
  body: z
    .strictObject({
      umbralAltoRiesgo: z.number().int().min(1).max(1000).optional(),
      vigenciaReporteHoras: z.number().int().min(1).max(720).optional(),
      quorum: z.number().int().min(1).max(1000).optional(),
      plazoVotacionHoras: z.number().int().min(1).max(336).optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'Sin cambios' }),
}