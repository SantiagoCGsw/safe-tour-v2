import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'
import Report from '../../src/models/Report.model.js'
import Vote from '../../src/models/Vote.model.js'
import ChainRecord from '../../src/models/ChainRecord.model.js'
import { signToken } from '../../src/utils/generateToken.js'
import { decidirResultado, cerrarVotacionesVencidas } from '../../src/services/consensus.service.js'
import { expirarReportes } from '../../src/services/scheduler.service.js'

const HORA_MS = 60 * 60 * 1000

let contador = 0

const crearUsuario = async (rol = 'turista') => {
  contador += 1
  const user = await User.create({
    nombre: 'Usuario Prueba',
    email: `usuario${contador}@correo.com`,
    password: 'hash-no-usado',
    rol,
  })
  return { user, token: signToken(user._id) }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

const crearReporte = (autor, extra = {}) =>
  Report.create({
    titulo: 'Hurto de celular',
    tipo: 'robo',
    ubicacion: { lat: 4.598, lng: -74.068 },
    autor: autor._id,
    estado: 'pendiente',
    cierreVotacion: new Date(Date.now() + HORA_MS),
    ...extra,
  })

const agregarVotos = async (reporte, confirmar, rechazar) => {
  const pedidos = [
    ...Array(confirmar).fill('confirmar'),
    ...Array(rechazar).fill('rechazar'),
  ]
  for (const voto of pedidos) {
    const { user } = await crearUsuario()
    await Vote.create({ reporte: reporte._id, usuario: user._id, voto })
  }
  await Report.updateOne({ _id: reporte._id }, { $set: { confirmaciones: confirmar, rechazos: rechazar } })
}

beforeAll(async () => {
  await User.init()
  await Vote.init()
  await ChainRecord.init()
})

describe('decidirResultado', () => {
  it.each([
    [3, 0, 3, 'confirmado'],
    [2, 1, 3, 'confirmado'],
    [51, 49, 3, 'confirmado'],
    [1, 2, 3, 'rechazado'],
    [0, 3, 3, 'rechazado'],
    [2, 2, 3, 'disputa'],
    [50, 50, 3, 'disputa'],
    [50, 49, 3, 'disputa'],
    [2, 0, 3, 'disputa'],
    [0, 0, 3, 'disputa'],
    [1, 0, 1, 'confirmado'],
  ])('con %i confirmaciones, %i rechazos y quórum %i resulta %s', (c, r, quorum, esperado) => {
    expect(decidirResultado({ confirmaciones: c, rechazos: r }, quorum)).toBe(esperado)
  })
})

describe('HU-17 emisión de votos', () => {
  it('registra el voto y actualiza el contador', async () => {
    const { user: autor } = await crearUsuario()
    const { token } = await crearUsuario()
    const reporte = await crearReporte(autor)
    const res = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    expect(res.status).toBe(201)
    expect(res.body.reporte).toMatchObject({ confirmaciones: 1, rechazos: 0 })
  })

  it('rechaza el segundo voto de la misma cuenta con 409', async () => {
    const { user: autor } = await crearUsuario()
    const { token } = await crearUsuario()
    const reporte = await crearReporte(autor)
    await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    const segundo = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'rechazar' })
    expect(segundo.status).toBe(409)
    const guardado = await Report.findById(reporte._id)
    expect(guardado).toMatchObject({ confirmaciones: 1, rechazos: 0 })
    expect(await Vote.countDocuments({ reporte: reporte._id })).toBe(1)
  })

  it('no permite votar el propio reporte', async () => {
    const { user: autor, token } = await crearUsuario()
    const reporte = await crearReporte(autor)
    const res = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    expect(res.status).toBe(403)
    expect(await Vote.countDocuments()).toBe(0)
  })

  it('exige sesión', async () => {
    const { user: autor } = await crearUsuario()
    const reporte = await crearReporte(autor)
    const res = await request(app).post(`/api/votes/${reporte._id}`).send({ voto: 'confirmar' })
    expect(res.status).toBe(401)
  })

  it.each(['publicado', 'confirmado', 'rechazado', 'disputa'])('rechaza votar un reporte en estado %s', async (estado) => {
    const { user: autor } = await crearUsuario()
    const { token } = await crearUsuario()
    const reporte = await crearReporte(autor, { estado })
    const res = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    expect(res.status).toBe(409)
  })

  it('rechaza votar después del plazo aunque el reporte siga pendiente', async () => {
    const { user: autor } = await crearUsuario()
    const { token } = await crearUsuario()
    const reporte = await crearReporte(autor, { cierreVotacion: new Date(Date.now() - 1000) })
    const res = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    expect(res.status).toBe(409)
  })

  it.each([
    ['voto inválido', { voto: 'quizas' }],
    ['campo extra', { voto: 'confirmar', peso: 10 }],
    ['cuerpo vacío', {}],
  ])('responde 400 por %s', async (_caso, cuerpo) => {
    const { user: autor } = await crearUsuario()
    const { token } = await crearUsuario()
    const reporte = await crearReporte(autor)
    const res = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send(cuerpo)
    expect(res.status).toBe(400)
  })

  it('responde 404 si el reporte no existe y 400 si el id es inválido', async () => {
    const { token } = await crearUsuario()
    const inexistente = await request(app)
      .post('/api/votes/64b0c0c0c0c0c0c0c0c0c0c0')
      .set(auth(token))
      .send({ voto: 'confirmar' })
    const invalido = await request(app).post('/api/votes/no-es-un-id').set(auth(token)).send({ voto: 'confirmar' })
    expect(inexistente.status).toBe(404)
    expect(invalido.status).toBe(400)
  })

  it('informa el voto propio y null si no ha votado', async () => {
    const { user: autor } = await crearUsuario()
    const { token } = await crearUsuario()
    const reporte = await crearReporte(autor)
    const antes = await request(app).get(`/api/votes/${reporte._id}/mio`).set(auth(token))
    await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'rechazar' })
    const despues = await request(app).get(`/api/votes/${reporte._id}/mio`).set(auth(token))
    expect(antes.body.voto).toBeNull()
    expect(despues.body.voto).toBe('rechazar')
  })
})

describe('cierre de votaciones vencidas', () => {
  const vencido = { cierreVotacion: new Date(Date.now() - 1000) }

  it.each([
    [3, 0, 'confirmado'],
    [2, 1, 'confirmado'],
    [1, 2, 'rechazado'],
    [1, 1, 'disputa'],
    [2, 0, 'disputa'],
    [0, 0, 'disputa'],
  ])('con %i confirmaciones y %i rechazos el reporte queda %s', async (c, r, esperado) => {
    const { user: autor } = await crearUsuario()
    const reporte = await crearReporte(autor, vencido)
    await agregarVotos(reporte, c, r)

    const cerrados = await cerrarVotacionesVencidas()
    expect(cerrados).toBe(1)
    expect((await Report.findById(reporte._id)).estado).toBe(esperado)
  })

  it('registra el cierre con hash verificable y sin datos personales', async () => {
    const { user: autor } = await crearUsuario()
    const reporte = await crearReporte(autor, vencido)
    await agregarVotos(reporte, 3, 0)
    await cerrarVotacionesVencidas()

    const registro = await ChainRecord.findOne({ reporte: reporte._id })
    expect(registro).toMatchObject({ decision: 'confirmado', confirmaciones: 3, rechazos: 0, estado: 'pendiente' })
    expect(Object.keys(registro.toJSON())).not.toContain('usuario')
  })

  it('el endpoint de registro confirma la integridad', async () => {
    const { user: autor } = await crearUsuario()
    const { token } = await crearUsuario()
    const reporte = await crearReporte(autor, vencido)
    await agregarVotos(reporte, 3, 0)
    await cerrarVotacionesVencidas()

    const res = await request(app).get(`/api/votes/registro/${reporte._id}`).set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.verificado).toBe(true)
    expect(res.body.registro.decision).toBe('confirmado')
  })

  it('no toca reportes cuyo plazo no ha vencido', async () => {
    const { user: autor } = await crearUsuario()
    const reporte = await crearReporte(autor)
    await agregarVotos(reporte, 3, 0)
    expect(await cerrarVotacionesVencidas()).toBe(0)
    expect((await Report.findById(reporte._id)).estado).toBe('pendiente')
  })

  it('es idempotente: un segundo ciclo no cierra de nuevo ni duplica registros', async () => {
    const { user: autor } = await crearUsuario()
    const reporte = await crearReporte(autor, vencido)
    await agregarVotos(reporte, 3, 0)
    await cerrarVotacionesVencidas()
    expect(await cerrarVotacionesVencidas()).toBe(0)
    expect(await ChainRecord.countDocuments({ reporte: reporte._id })).toBe(1)
  })

  it('un reporte publicado por gestor nunca entra a votación', async () => {
    const { user: gestor, token } = await crearUsuario('gestor')
    const res = await request(app)
      .post('/api/reports')
      .set(auth(token))
      .send({ titulo: 'Cierre vial', tipo: 'obra', ubicacion: { lat: 4.6, lng: -74.07 } })
    expect(res.body.reporte.estado).toBe('publicado')
    expect(await cerrarVotacionesVencidas()).toBe(0)
    expect(String(res.body.reporte.autor)).toBe(String(gestor._id))
  })
})

describe('vigencia de reportes', () => {
  it('desactiva los reportes vencidos que no están pendientes', async () => {
    const { user: autor } = await crearUsuario()
    const viejo = await crearReporte(autor, { estado: 'publicado' })
    const viejoPendiente = await crearReporte(autor)
    const reciente = await crearReporte(autor, { estado: 'publicado' })
    const hace100h = new Date(Date.now() - 100 * HORA_MS)
    await Report.collection.updateMany(
      { _id: { $in: [viejo._id, viejoPendiente._id] } },
      { $set: { createdAt: hace100h } },
    )

    expect(await expirarReportes()).toBe(1)
    expect((await Report.findById(viejo._id)).activo).toBe(false)
    expect((await Report.findById(viejoPendiente._id)).activo).toBe(true)
    expect((await Report.findById(reciente._id)).activo).toBe(true)
  })
})