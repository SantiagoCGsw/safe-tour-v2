import { buscarSitios } from '../services/zones.service.js'

export const buscar = async (req, res) => {
  const sitios = await buscarSitios(req.valid.query)
  res.json({ sitios })
}