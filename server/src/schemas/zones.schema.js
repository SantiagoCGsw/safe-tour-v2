import { z } from 'zod'
import { TIPOS_ZONA } from '../models/Zone.model.js'

const idParam = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido')

const punto = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const nombre = z.string().trim().min(2).max(100)
const descripcion = z.string().trim().max(500)
const tipo = z.enum(TIPOS_ZONA)
const nivelSeguridad = z.number().int().min(1).max(5)
const coordenadas = z.array(punto).min(3).max(200)

export const MODOS_TRANSPORTE = Object.freeze([
  'a-pie',
  'transporte-publico',
  'vehiculo',
  'bicicleta',
])

export const crearZonaSchema = {
  body: z.strictObject({
    nombre,
    descripcion: descripcion.optional(),
    tipo,
    nivelSeguridad: nivelSeguridad.optional(),
    coordenadas,
  }),
}

export const actualizarZonaSchema = {
  params: z.strictObject({ id: idParam }),
  body: z
    .strictObject({
      nombre: nombre.optional(),
      descripcion: descripcion.optional(),
      tipo: tipo.optional(),
      nivelSeguridad: nivelSeguridad.optional(),
      coordenadas: coordenadas.optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'Sin cambios' }),
}

export const zonaIdSchema = {
  params: z.strictObject({ id: idParam }),
}

export const listarZonasSchema = {
  query: z.strictObject({
    tipo: tipo.optional(),
  }),
}

export const buscarSitiosSchema = {
  query: z.strictObject({
    q: z.string().trim().max(60).optional(),
    categoria: z.enum(['turistica', 'cultural']).optional(),
  }),
}

export const calcularRutaSchema = {
  body: z.strictObject({
    origen: punto,
    destino: punto,
    modo: z.enum(MODOS_TRANSPORTE),
  }),
}