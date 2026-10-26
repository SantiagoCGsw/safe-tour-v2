import client from './client.js'

export const listarZonas = (params = {}) =>
  client.get('/zones', { params }).then((r) => r.data.zonas)

export const obtenerZona = (id) => client.get(`/zones/${id}`).then((r) => r.data.zona)

export const crearZona = (datos) => client.post('/zones', datos).then((r) => r.data.zona)

export const actualizarZona = (id, datos) =>
  client.put(`/zones/${id}`, datos).then((r) => r.data.zona)

export const desactivarZona = (id) => client.delete(`/zones/${id}`).then((r) => r.data)