import client from './client.js'

export const calcularRutas = (datos) => client.post('/routing/rutas', datos).then((r) => r.data)