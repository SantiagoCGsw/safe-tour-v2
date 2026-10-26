import {
  crearReporte,
  listarReportes,
  historialDeUsuario,
  listarDisputas,
  resolverDisputa,
} from '../services/consensus.service.js'
import { calcularMapaDeCalor } from '../services/risk.service.js'

export const crear = async (req, res) => {
  const reporte = await crearReporte(req.user, req.body)
  res.status(201).json({ reporte })
}

export const listar = async (req, res) => {
  const reportes = await listarReportes(req.valid.query)
  res.json({ reportes })
}

export const mios = async (req, res) => {
  const reportes = await historialDeUsuario(req.user._id)
  res.json({ reportes })
}

export const mapaCalor = async (req, res) => {
  const mapa = await calcularMapaDeCalor()
  res.json({ mapa })
}

export const disputas = async (req, res) => {
  const reportes = await listarDisputas()
  res.json({ reportes })
}

export const resolver = async (req, res) => {
  const reporte = await resolverDisputa(req.user, req.valid.params.id, req.body.decision)
  res.json({ reporte })
}