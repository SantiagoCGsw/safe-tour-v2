import { registrarTurista, iniciarSesion } from '../services/auth.service.js'

export const register = async (req, res) => {
  const { user, token } = await registrarTurista(req.body)
  res.status(201).json({ user, token })
}

export const login = async (req, res) => {
  const { user, token } = await iniciarSesion(req.body)
  res.json({ user, token })
}

export const me = async (req, res) => {
  res.json({ user: req.user })
}

export const logout = async (req, res) => {
  res.json({ message: 'Sesión cerrada' })
}