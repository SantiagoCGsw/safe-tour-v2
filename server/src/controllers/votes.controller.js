import { votar, votoDe } from '../services/consensus.service.js'
import { verificarRegistro } from '../services/chain.service.js'

export const emitirVoto = async (req, res) => {
  const reporte = await votar(req.user, req.valid.params.reporteId, req.body.voto)
  res.status(201).json({ reporte })
}

export const miVoto = async (req, res) => {
  const voto = await votoDe(req.user, req.valid.params.reporteId)
  res.json({ voto })
}

export const registro = async (req, res) => {
  const { registro: datos, verificado } = await verificarRegistro(req.valid.params.reporteId)
  res.json({ registro: datos, verificado })
}