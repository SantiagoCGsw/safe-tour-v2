import { z } from 'zod'
import { VOTOS } from '../models/Vote.model.js'

const idReporte = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido')

export const votarSchema = {
  params: z.strictObject({ reporteId: idReporte }),
  body: z.strictObject({ voto: z.enum(VOTOS) }),
}

export const reporteVotoSchema = {
  params: z.strictObject({ reporteId: idReporte }),
}