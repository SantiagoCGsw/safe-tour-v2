import { createHash } from 'node:crypto'
import Vote from '../models/Vote.model.js'
import ChainRecord from '../models/ChainRecord.model.js'
import { chainConfig } from '../config/chain.js'
import { AppError } from '../middlewares/error.middleware.js'

const sha256 = (texto) => createHash('sha256').update(texto).digest('hex')

export const calcularHashVotos = (reporteId, votos) => {
  const lineas = votos.map((v) => `${v.usuario}:${v.voto}`).sort()
  return sha256([String(reporteId), ...lineas].join('\n'))
}

export const calcularHashRegistro = ({
  reporteId,
  decision,
  confirmaciones,
  rechazos,
  fecha,
  hashVotos,
}) =>
  sha256(
    JSON.stringify([
      String(reporteId),
      decision,
      confirmaciones,
      rechazos,
      new Date(fecha).toISOString(),
      hashVotos,
    ]),
  )

const anclarEnRed = async () => {
  if (!chainConfig.configurada) return null
  throw new Error('El envío a la red de pruebas aún no está implementado')
}

export const registrarCierre = async (reporte, decision) => {
  const votos = await Vote.find({ reporte: reporte._id }).select('usuario voto')
  const fecha = new Date()
  const hashVotos = calcularHashVotos(reporte._id, votos)
  const hashRegistro = calcularHashRegistro({
    reporteId: reporte._id,
    decision,
    confirmaciones: reporte.confirmaciones,
    rechazos: reporte.rechazos,
    fecha,
    hashVotos,
  })

  const registro = await ChainRecord.create({
    reporte: reporte._id,
    decision,
    confirmaciones: reporte.confirmaciones,
    rechazos: reporte.rechazos,
    fecha,
    hashVotos,
    hashRegistro,
    red: chainConfig.red,
  })

  try {
    const transaccion = await anclarEnRed(registro)
    if (transaccion) {
      registro.estado = 'anclado'
      registro.txHash = transaccion.hash
      registro.ancladoEn = new Date()
      await registro.save()
    }
  } catch {
    registro.estado = 'error'
    await registro.save()
  }

  return registro
}

export const verificarRegistro = async (reporteId) => {
  const registro = await ChainRecord.findOne({ reporte: reporteId })
  if (!registro) throw new AppError(404, 'Registro no encontrado')

  const votos = await Vote.find({ reporte: reporteId }).select('usuario voto')
  const hashVotos = calcularHashVotos(reporteId, votos)
  const hashRegistro = calcularHashRegistro({
    reporteId,
    decision: registro.decision,
    confirmaciones: registro.confirmaciones,
    rechazos: registro.rechazos,
    fecha: registro.fecha,
    hashVotos: registro.hashVotos,
  })

  const verificado = hashVotos === registro.hashVotos && hashRegistro === registro.hashRegistro
  return { registro, verificado }
}