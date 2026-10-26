// server/src/controllers/posts.controller.js
import {
  listarPublicaciones,
  listarParaModeracion,
  crearPublicacion,
  agregarReaccion,
  quitarReaccion,
  comentarPublicacion,
  denunciarPublicacion,
  retirarPublicacion,
} from '../services/posts.service.js'

export const listar = async (req, res) => {
  const publicaciones = await listarPublicaciones(req.user, req.valid.query)
  res.json({ publicaciones })
}

export const moderacion = async (req, res) => {
  const publicaciones = await listarParaModeracion(req.user, req.valid.query)
  res.json({ publicaciones })
}

export const crear = async (req, res) => {
  const publicacion = await crearPublicacion(req.user, req.body)
  res.status(201).json({ publicacion })
}

export const reaccionar = async (req, res) => {
  const publicacion = await agregarReaccion(req.user, req.valid.params.id)
  res.json({ publicacion })
}

export const quitarMiReaccion = async (req, res) => {
  const publicacion = await quitarReaccion(req.user, req.valid.params.id)
  res.json({ publicacion })
}

export const comentar = async (req, res) => {
  const publicacion = await comentarPublicacion(req.user, req.valid.params.id, req.body.texto)
  res.status(201).json({ publicacion })
}

export const denunciar = async (req, res) => {
  await denunciarPublicacion(req.user, req.valid.params.id, req.body.motivo)
  res.status(204).end()
}

export const retirar = async (req, res) => {
  await retirarPublicacion(req.user, req.valid.params.id)
  res.status(204).end()
}