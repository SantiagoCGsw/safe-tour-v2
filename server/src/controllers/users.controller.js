import { actualizarPerfil } from '../services/users.service.js'

export const verPerfil = async (req, res) => {
  res.json({ user: req.user })
}

export const editarPerfil = async (req, res) => {
  const user = await actualizarPerfil(req.user._id, req.body)
  res.json({ user })
}