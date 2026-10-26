// server/src/services/posts.service.js
import mongoose from 'mongoose'
import Post from '../models/Post.model.js'
import Zone from '../models/Zone.model.js'
import { AppError } from '../middlewares/error.middleware.js'
import { registrarAuditoria } from '../utils/audit.js'

const HORA_MS = 60 * 60 * 1000
const LIMITE_POSTS_POR_HORA = 10
const MAX_COMENTARIOS = 100
const ROLES_MODERADORES = ['gestor', 'admin']

const NO_ENCONTRADA = 'Publicación no encontrada'

const aDTO = (post, userId, { moderacion = false } = {}) => {
  const reacciones = post.reacciones ?? []
  const comentarios = (post.comentarios ?? []).filter((c) => c.activo)
  return {
    _id: post._id,
    contenido: post.contenido,
    autor: post.autor ? { _id: post.autor._id, nombre: post.autor.nombre } : null,
    zona: post.zona ? { _id: post.zona._id, nombre: post.zona.nombre } : null,
    createdAt: post.createdAt,
    reacciones: reacciones.length,
    reaccionado: reacciones.some((u) => String(u) === String(userId)),
    comentarios: comentarios.map((c) => ({
      _id: c._id,
      autor: c.autor ? { _id: c.autor._id, nombre: c.autor.nombre } : null,
      texto: c.texto,
      createdAt: c.createdAt,
    })),
    ...(moderacion ? { denuncias: (post.denuncias ?? []).length } : {}),
  }
}

const consultaPublica = (filtro) =>
  Post.find(filtro)
    .populate('autor', 'nombre')
    .populate('zona', 'nombre')
    .populate('comentarios.autor', 'nombre')

const obtenerDTO = async (id, userId) => {
  const post = await Post.findOne({ _id: id, activo: true })
    .populate('autor', 'nombre')
    .populate('zona', 'nombre')
    .populate('comentarios.autor', 'nombre')
    .lean()
  if (!post) throw new AppError(404, NO_ENCONTRADA)
  return aDTO(post, userId)
}

export const listarPublicaciones = async (user, { zona, limite = 30 } = {}) => {
  const filtro = { activo: true }
  if (zona) filtro.zona = zona
  const posts = await consultaPublica(filtro).sort({ createdAt: -1 }).limit(limite).lean()
  return posts.map((p) => aDTO(p, user._id))
}

export const listarParaModeracion = async (user, { zona, autor, desde, hasta, limite = 30 } = {}) => {
  const filtro = { activo: true }
  if (zona) filtro.zona = zona
  if (autor) filtro.autor = autor

  const rango = {}
  if (desde) rango.$gte = desde
  if (hasta) rango.$lte = hasta
  if (Object.keys(rango).length > 0) filtro.createdAt = mongoose.trusted(rango)

  const posts = await consultaPublica(filtro).sort({ createdAt: -1 }).limit(limite).lean()
  return posts
    .map((p) => aDTO(p, user._id, { moderacion: true }))
    .sort((a, b) => b.denuncias - a.denuncias)
}

export const crearPublicacion = async (user, { contenido, zona }) => {
  if (!ROLES_MODERADORES.includes(user.rol)) {
    const recientes = await Post.countDocuments({
      autor: user._id,
      createdAt: mongoose.trusted({ $gte: new Date(Date.now() - HORA_MS) }),
    })
    if (recientes >= LIMITE_POSTS_POR_HORA) {
      throw new AppError(429, 'Superaste el límite de publicaciones por hora')
    }
  }

  if (zona) {
    const existe = await Zone.exists({ _id: zona, activo: true })
    if (!existe) throw new AppError(404, 'Zona no encontrada')
  }

  const datos = { autor: user._id, contenido }
  if (zona) datos.zona = zona
  const post = await Post.create(datos)
  return obtenerDTO(post._id, user._id)
}

export const agregarReaccion = async (user, id) => {
  const post = await Post.findOneAndUpdate(
    { _id: id, activo: true },
    { $addToSet: { reacciones: user._id } },
  )
  if (!post) throw new AppError(404, NO_ENCONTRADA)
  return obtenerDTO(id, user._id)
}

export const quitarReaccion = async (user, id) => {
  const post = await Post.findOneAndUpdate(
    { _id: id, activo: true },
    { $pull: { reacciones: user._id } },
  )
  if (!post) throw new AppError(404, NO_ENCONTRADA)
  return obtenerDTO(id, user._id)
}

export const comentarPublicacion = async (user, id, texto) => {
  const actualizado = await Post.findOneAndUpdate(
    {
      _id: id,
      activo: true,
      [`comentarios.${MAX_COMENTARIOS - 1}`]: mongoose.trusted({ $exists: false }),
    },
    { $push: { comentarios: { autor: user._id, texto } } },
  )

  if (!actualizado) {
    const existe = await Post.exists({ _id: id, activo: true })
    if (!existe) throw new AppError(404, NO_ENCONTRADA)
    throw new AppError(409, 'La publicación alcanzó el máximo de comentarios')
  }
  return obtenerDTO(id, user._id)
}

export const denunciarPublicacion = async (user, id, motivo) => {
  const actualizado = await Post.findOneAndUpdate(
    {
      _id: id,
      activo: true,
      autor: mongoose.trusted({ $ne: user._id }),
      'denuncias.usuario': mongoose.trusted({ $ne: user._id }),
    },
    { $push: { denuncias: { usuario: user._id, motivo } } },
  )

  if (!actualizado) {
    const post = await Post.findOne({ _id: id, activo: true }).select('autor').lean()
    if (!post) throw new AppError(404, NO_ENCONTRADA)
    if (String(post.autor) === String(user._id)) {
      throw new AppError(403, 'No puedes denunciar tu propia publicación')
    }
    throw new AppError(409, 'Ya denunciaste esta publicación')
  }
}

export const retirarPublicacion = async (user, id) => {
  const post = await Post.findOne({ _id: id, activo: true })
  if (!post) throw new AppError(404, NO_ENCONTRADA)

  const esAutor = String(post.autor) === String(user._id)
  const esModerador = ROLES_MODERADORES.includes(user.rol)
  if (!esAutor && !esModerador) throw new AppError(403, 'Acceso denegado')

  post.activo = false
  if (!esAutor) {
    post.moderadoPor = user._id
    post.moderadoEn = new Date()
  }
  await post.save()

  if (!esAutor) {
    await registrarAuditoria({
      actor: user._id,
      accion: 'post.desactivar',
      objetivo: post.autor,
      detalle: { publicacion: String(post._id) },
    })
  }
}