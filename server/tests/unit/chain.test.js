import { describe, it, expect, beforeAll } from 'vitest'
import mongoose from 'mongoose'
import Vote from '../../src/models/Vote.model.js'
import ChainRecord from '../../src/models/ChainRecord.model.js'
import {
  calcularHashVotos,
  calcularHashRegistro,
  registrarCierre,
  verificarRegistro,
} from '../../src/services/chain.service.js'

const nuevoId = () => new mongoose.Types.ObjectId()

beforeAll(async () => {
  await ChainRecord.init()
  await Vote.init()
})

describe('calcularHashVotos', () => {
  const reporteId = nuevoId()
  const a = { usuario: nuevoId(), voto: 'confirmar' }
  const b = { usuario: nuevoId(), voto: 'rechazar' }

  it('produce un SHA-256 en hexadecimal', () => {
    expect(calcularHashVotos(reporteId, [a, b])).toMatch(/^[a-f0-9]{64}$/)
  })

  it('no depende del orden de los votos', () => {
    expect(calcularHashVotos(reporteId, [a, b])).toBe(calcularHashVotos(reporteId, [b, a]))
  })

  it('cambia si un voto cambia de sentido', () => {
    const cambiado = { ...a, voto: 'rechazar' }
    expect(calcularHashVotos(reporteId, [a, b])).not.toBe(calcularHashVotos(reporteId, [cambiado, b]))
  })

  it('cambia si cambia el reporte', () => {
    expect(calcularHashVotos(reporteId, [a, b])).not.toBe(calcularHashVotos(nuevoId(), [a, b]))
  })
})

describe('calcularHashRegistro', () => {
  const base = {
    reporteId: nuevoId(),
    decision: 'confirmado',
    confirmaciones: 3,
    rechazos: 1,
    fecha: new Date('2026-10-01T10:00:00Z'),
    hashVotos: 'a'.repeat(64),
  }

  it('es determinista', () => {
    expect(calcularHashRegistro(base)).toBe(calcularHashRegistro({ ...base }))
  })

  it.each([
    ['la decisión', { decision: 'rechazado' }],
    ['las confirmaciones', { confirmaciones: 4 }],
    ['los rechazos', { rechazos: 2 }],
    ['la fecha', { fecha: new Date('2026-10-01T10:00:01Z') }],
    ['el hash de votos', { hashVotos: 'b'.repeat(64) }],
  ])('cambia si cambia %s', (_campo, cambio) => {
    expect(calcularHashRegistro({ ...base, ...cambio })).not.toBe(calcularHashRegistro(base))
  })
})

describe('registrarCierre y verificarRegistro', () => {
  const crearEscenario = async () => {
    const reporte = { _id: nuevoId(), confirmaciones: 2, rechazos: 1 }
    await Vote.create([
      { reporte: reporte._id, usuario: nuevoId(), voto: 'confirmar' },
      { reporte: reporte._id, usuario: nuevoId(), voto: 'confirmar' },
      { reporte: reporte._id, usuario: nuevoId(), voto: 'rechazar' },
    ])
    return reporte
  }

  it('guarda el registro como pendiente cuando no hay red configurada', async () => {
    const reporte = await crearEscenario()
    const registro = await registrarCierre(reporte, 'confirmado')
    expect(registro).toMatchObject({
      decision: 'confirmado',
      confirmaciones: 2,
      rechazos: 1,
      estado: 'pendiente',
      txHash: '',
    })
    expect(registro.hashVotos).toMatch(/^[a-f0-9]{64}$/)
    expect(registro.hashRegistro).toMatch(/^[a-f0-9]{64}$/)
  })

  it('no almacena datos personales en el registro', async () => {
    const reporte = await crearEscenario()
    const registro = await registrarCierre(reporte, 'confirmado')
    const claves = Object.keys(registro.toJSON())
    expect(claves).not.toContain('usuario')
    expect(claves).not.toContain('autor')
    expect(claves).not.toContain('votos')
  })

  it('verifica un registro íntegro', async () => {
    const reporte = await crearEscenario()
    await registrarCierre(reporte, 'confirmado')
    const { verificado } = await verificarRegistro(reporte._id)
    expect(verificado).toBe(true)
  })

  it('detecta que se alteró la decisión registrada', async () => {
    const reporte = await crearEscenario()
    await registrarCierre(reporte, 'confirmado')
    await ChainRecord.updateOne({ reporte: reporte._id }, { $set: { decision: 'rechazado' } })
    const { verificado } = await verificarRegistro(reporte._id)
    expect(verificado).toBe(false)
  })

  it('detecta que se alteró un voto', async () => {
    const reporte = await crearEscenario()
    await registrarCierre(reporte, 'confirmado')
    await Vote.updateOne({ reporte: reporte._id, voto: 'rechazar' }, { $set: { voto: 'confirmar' } })
    const { verificado } = await verificarRegistro(reporte._id)
    expect(verificado).toBe(false)
  })

  it('no permite registrar dos veces el mismo reporte', async () => {
    const reporte = await crearEscenario()
    await registrarCierre(reporte, 'confirmado')
    await expect(registrarCierre(reporte, 'confirmado')).rejects.toMatchObject({ code: 11000 })
  })

  it('responde 404 si el reporte no tiene registro', async () => {
    await expect(verificarRegistro(nuevoId())).rejects.toMatchObject({ status: 404 })
  })
})