import { obtenerRutas, buscarDirecciones } from '../services/routing.service.js'

export const calcular = async (req, res) => {
  const resultado = await obtenerRutas(req.body)
  res.json(resultado)
}

export const direcciones = async (req, res) => {
  const resultado = await buscarDirecciones(req.valid.query.q)
  res.json(resultado)
}
