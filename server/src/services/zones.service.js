import mongoose from 'mongoose'
import Zone from '../models/Zone.model.js'
import { AppError } from '../middlewares/error.middleware.js'

const NO_ENCONTRADA = 'Zona no encontrada'
const CATEGORIAS_SITIO = ['turistica', 'cultural']

const normalizar = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const centroDe = (coordenadas) => ({
  lat: coordenadas.reduce((suma, p) => suma + p.lat, 0) / coordenadas.length,
  lng: coordenadas.reduce((suma, p) => suma + p.lng, 0) / coordenadas.length,
})

export const listarZonas = ({ tipo } = {}) => {
  const filtro = { activo: true }
  if (tipo) filtro.tipo = tipo
  return Zone.find(filtro).sort({ nombre: 1 })
}

export const obtenerZona = async (id) => {
  const zona = await Zone.findOne({ _id: id, activo: true })
  if (!zona) throw new AppError(404, NO_ENCONTRADA)
  return zona
}

export const crearZona = (datos, actorId) => Zone.create({ ...datos, creadoPor: actorId })

export const actualizarZona = async (id, cambios) => {
  const zona = await Zone.findOneAndUpdate(
    { _id: id, activo: true },
    { $set: cambios },
    { new: true, runValidators: true },
  )
  if (!zona) throw new AppError(404, NO_ENCONTRADA)
  return zona
}

export const desactivarZona = async (id) => {
  const zona = await Zone.findOneAndUpdate({ _id: id, activo: true }, { $set: { activo: false } })
  if (!zona) throw new AppError(404, NO_ENCONTRADA)
}

export const buscarSitios = async ({ q, categoria } = {}) => {
  const filtro = {
    activo: true,
    tipo: categoria ?? mongoose.trusted({ $in: CATEGORIAS_SITIO }),
  }
  const zonas = await Zone.find(filtro).sort({ nombre: 1 })
  const aguja = q ? normalizar(q) : ''

  return zonas
    .filter(
      (z) =>
        !aguja || normalizar(z.nombre).includes(aguja) || normalizar(z.descripcion ?? '').includes(aguja),
    )
    .map((z) => ({
      _id: z._id,
      nombre: z.nombre,
      descripcion: z.descripcion,
      tipo: z.tipo,
      nivelSeguridad: z.nivelSeguridad,
      centro: centroDe(z.coordenadas),
    }))
}