import { obtenerRutas } from '../services/routing.service.js'

export const calcular = async (req, res) => {
  const resultado = await obtenerRutas(req.body)
  res.json(resultado)
}