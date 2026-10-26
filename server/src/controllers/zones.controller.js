import {
  listarZonas,
  obtenerZona,
  crearZona,
  actualizarZona,
  desactivarZona,
} from '../services/zones.service.js'

export const listar = async (req, res) => {
  const zonas = await listarZonas(req.valid.query)
  res.json({ zonas })
}

export const obtener = async (req, res) => {
  const zona = await obtenerZona(req.valid.params.id)
  res.json({ zona })
}

export const crear = async (req, res) => {
  const zona = await crearZona(req.body, req.user._id)
  res.status(201).json({ zona })
}

export const actualizar = async (req, res) => {
  const zona = await actualizarZona(req.valid.params.id, req.body)
  res.json({ zona })
}

export const desactivar = async (req, res) => {
  await desactivarZona(req.valid.params.id)
  res.json({ message: 'Zona desactivada' })
}