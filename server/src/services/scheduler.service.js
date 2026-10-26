import mongoose from 'mongoose'
import Report from '../models/Report.model.js'
import Config from '../models/Config.model.js'
import { env } from '../config/env.js'
import { cerrarVotacionesVencidas } from './consensus.service.js'

const HORA_MS = 60 * 60 * 1000
const INTERVALO_MS = 60 * 1000

export const expirarReportes = async () => {
  const config = await Config.obtener()
  const limite = new Date(Date.now() - config.vigenciaReporteHoras * HORA_MS)

  const resultado = await Report.updateMany(
    {
      activo: true,
      estado: mongoose.trusted({ $ne: 'pendiente' }),
      createdAt: mongoose.trusted({ $lt: limite }),
    },
    { $set: { activo: false } },
  )
  return resultado.modifiedCount
}

export const ejecutarCiclo = async () => {
  const cerrados = await cerrarVotacionesVencidas()
  const expirados = await expirarReportes()
  return { cerrados, expirados }
}

export const iniciarScheduler = () => {
  const temporizador = setInterval(async () => {
    try {
      await ejecutarCiclo()
    } catch (err) {
      if (env.NODE_ENV !== 'test') console.error(`[scheduler] ${err.message}`)
    }
  }, INTERVALO_MS)
  temporizador.unref()
  return () => clearInterval(temporizador)
}