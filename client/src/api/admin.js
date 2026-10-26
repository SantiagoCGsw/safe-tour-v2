import client from './client.js'

export const estadisticas = (params = {}) =>
  client.get('/admin/stats', { params }).then((r) => r.data.stats)

export const listarUsuarios = (params = {}) =>
  client.get('/admin/users', { params }).then((r) => r.data.usuarios)

export const crearCuenta = (datos) => client.post('/admin/users', datos).then((r) => r.data.user)

export const cambiarRol = (id, rol) =>
  client.patch(`/admin/users/${id}/rol`, { rol }).then((r) => r.data.user)

export const cambiarEstado = (id, activo) =>
  client.patch(`/admin/users/${id}/estado`, { activo }).then((r) => r.data.user)

export const obtenerConfig = () => client.get('/admin/config').then((r) => r.data.config)

export const actualizarConfig = (cambios) =>
  client.put('/admin/config', cambios).then((r) => r.data.config)