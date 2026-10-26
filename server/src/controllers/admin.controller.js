import {
  listarUsuarios,
  crearCuenta,
  cambiarRol,
  cambiarEstado,
  obtenerEstadisticas,
  obtenerConfiguracion,
  actualizarConfiguracion,
} from '../services/admin.service.js'

export const estadisticas = async (req, res) => {
  const stats = await obtenerEstadisticas(req.valid.query)
  res.json({ stats })
}

export const listar = async (req, res) => {
  const usuarios = await listarUsuarios(req.valid.query)
  res.json({ usuarios })
}

export const crear = async (req, res) => {
  const user = await crearCuenta(req.user, req.body)
  res.status(201).json({ user })
}

export const actualizarRol = async (req, res) => {
  const user = await cambiarRol(req.user, req.valid.params.id, req.body.rol)
  res.json({ user })
}

export const actualizarEstado = async (req, res) => {
  const user = await cambiarEstado(req.user, req.valid.params.id, req.body.activo)
  res.json({ user })
}

export const verConfig = async (req, res) => {
  const config = await obtenerConfiguracion()
  res.json({ config })
}

export const editarConfig = async (req, res) => {
  const config = await actualizarConfiguracion(req.user, req.body)
  res.json({ config })
}