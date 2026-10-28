import client from './client.js'

export const calcularRutas = (datos) => client.post('/routing/rutas', datos).then((r) => r.data)

export const buscarDirecciones = (q) =>
  client.get('/routing/direcciones', { params: { q } }).then((r) => r.data.resultados)
