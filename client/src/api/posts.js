// client/src/api/posts.js
import client from './client.js'

export const listarPublicaciones = (params = {}) =>
  client.get('/posts', { params }).then((r) => r.data.publicaciones)

export const listarModeracion = (params = {}) =>
  client.get('/posts/moderacion', { params }).then((r) => r.data.publicaciones)

export const crearPublicacion = (datos) =>
  client.post('/posts', datos).then((r) => r.data.publicacion)

export const reaccionar = (id) =>
  client.post(`/posts/${id}/reacciones`).then((r) => r.data.publicacion)

export const quitarReaccion = (id) =>
  client.delete(`/posts/${id}/reacciones`).then((r) => r.data.publicacion)

export const comentarPublicacion = (id, texto) =>
  client.post(`/posts/${id}/comentarios`, { texto }).then((r) => r.data.publicacion)

export const denunciarPublicacion = (id, motivo) =>
  client.post(`/posts/${id}/denuncias`, { motivo }).then(() => undefined)

export const retirarPublicacion = (id) => client.delete(`/posts/${id}`).then(() => undefined)