import client from './client.js'

export const listarReportes = (params = {}) =>
  client.get('/reports', { params }).then((r) => r.data.reportes)

export const misReportes = () => client.get('/reports/mios').then((r) => r.data.reportes)

export const mapaDeCalor = () => client.get('/reports/mapa-calor').then((r) => r.data.mapa)

export const crearReporte = (datos) => client.post('/reports', datos).then((r) => r.data.reporte)

export const listarDisputas = () => client.get('/reports/disputas').then((r) => r.data.reportes)

export const resolverDisputa = (id, decision) =>
  client.patch(`/reports/${id}/resolver`, { decision }).then((r) => r.data.reporte)