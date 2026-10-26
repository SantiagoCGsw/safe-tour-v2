import client from './client.js'

export const buscarSitios = (params = {}) =>
  client.get('/places', { params }).then((r) => r.data.sitios)