import client from './client.js'

export const votar = (reporteId, voto) =>
  client.post(`/votes/${reporteId}`, { voto }).then((r) => r.data.reporte)

export const miVoto = (reporteId) =>
  client.get(`/votes/${reporteId}/mio`).then((r) => r.data.voto)

export const registroDeCadena = (reporteId) =>
  client.get(`/votes/registro/${reporteId}`).then((r) => r.data)