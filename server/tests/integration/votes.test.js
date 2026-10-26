import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'
import Zone from '../../src/models/Zone.model.js'
import Report from '../../src/models/Report.model.js'
import AuditLog from '../../src/models/AuditLog.model.js'
import { signToken } from '../../src/utils/generateToken.js'

const poligono = [
  { lat: 4.59, lng: -74.07 },
  { lat: 4.6, lng: -74.07 },
  { lat: 4.6, lng: -74.06 },
]

const reporteBase = {
  titulo: 'Hurto de celular',
  tipo: 'robo',
  ubicacion: { lat: 4.598, lng: -74.068 },
}

const crearUsuario = async (rol, email) => {
  const user = await User.create({ nombre: 'Usuario Prueba', email, password: 'hash-no-usado', rol })
  return { user, token: signToken(user._id) }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

beforeAll(async () => {
  await User.init()
})

describe('HU-11 resolución de reportes en disputa', () => {
  it('el gestor lista solo los reportes en disputa', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const { user: autor } = await crearUsuario('turista', 'turista@correo.com')
    await Report.create([
      { ...reporteBase, autor: autor._id, estado: 'disputa' },
      { ...reporteBase, autor: autor._id, estado: 'pendiente' },
      { ...reporteBase, autor: autor._id, estado: 'publicado' },
    ])
    const res = await request(app).get('/api/reports/disputas').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.reportes).toHaveLength(1)
    expect(res.body.reportes[0].estado).toBe('disputa')
  })

  it('rechaza a un turista con 403 y sin sesión con 401', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const conTurista = await request(app).get('/api/reports/disputas').set(auth(token))
    const sinSesion = await request(app).get('/api/reports/disputas')
    expect(conTurista.status).toBe(403)
    expect(sinSesion.status).toBe(401)
  })

  it.each(['confirmado', 'rechazado'])('el gestor resuelve una disputa como %s y queda auditado', async (decision) => {
    const { user: gestor, token } = await crearUsuario('gestor', 'gestor@correo.com')
    const { user: autor } = await crearUsuario('turista', 'turista@correo.com')
    const reporte = await Report.create({ ...reporteBase, autor: autor._id, estado: 'disputa' })

    const res = await request(app)
      .patch(`/api/reports/${reporte._id}/resolver`)
      .set(auth(token))
      .send({ decision })
    expect(res.status).toBe(200)
    expect(res.body.reporte).toMatchObject({ estado: decision, resueltoPor: String(gestor._id) })
    expect(res.body.reporte.resueltoEn).toBeDefined()

    const auditoria = await AuditLog.findOne({ accion: 'reporte.resolver_disputa' })
    expect(String(auditoria.actor)).toBe(String(gestor._id))
    expect(auditoria.detalle).toEqual({ reporteId: String(reporte._id), decision })
  })

  it('un reporte confirmado por el gestor cuenta en el mapa de calor', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const { user: autor } = await crearUsuario('turista', 'turista@correo.com')
    await Zone.create({ nombre: 'Zona A', tipo: 'cultural', coordenadas: poligono })
    const reporte = await Report.create({ ...reporteBase, autor: autor._id, estado: 'disputa' })

    const antes = await request(app).get('/api/reports/mapa-calor').set(auth(token))
    await request(app).patch(`/api/reports/${reporte._id}/resolver`).set(auth(token)).send({ decision: 'confirmado' })
    const despues = await request(app).get('/api/reports/mapa-calor').set(auth(token))

    expect(antes.body.mapa.puntos).toHaveLength(0)
    expect(despues.body.mapa.puntos).toHaveLength(1)
  })

  it('no resuelve reportes que no están en disputa (404) y no cambia su estado', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const { user: autor } = await crearUsuario('turista', 'turista@correo.com')
    const reporte = await Report.create({ ...reporteBase, autor: autor._id, estado: 'pendiente' })
    const res = await request(app)
      .patch(`/api/reports/${reporte._id}/resolver`)
      .set(auth(token))
      .send({ decision: 'confirmado' })
    expect(res.status).toBe(404)
    expect((await Report.findById(reporte._id)).estado).toBe('pendiente')
  })

  it('no permite resolver una disputa dos veces', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const { user: autor } = await crearUsuario('turista', 'turista@correo.com')
    const reporte = await Report.create({ ...reporteBase, autor: autor._id, estado: 'disputa' })
    await request(app).patch(`/api/reports/${reporte._id}/resolver`).set(auth(token)).send({ decision: 'confirmado' })
    const segunda = await request(app)
      .patch(`/api/reports/${reporte._id}/resolver`)
      .set(auth(token))
      .send({ decision: 'rechazado' })
    expect(segunda.status).toBe(404)
    expect((await Report.findById(reporte._id)).estado).toBe('confirmado')
  })

  it('rechaza a un turista con 403 sin alterar el reporte', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const { user: autor } = await crearUsuario('turista', 'otro@correo.com')
    const reporte = await Report.create({ ...reporteBase, autor: autor._id, estado: 'disputa' })
    const res = await request(app)
      .patch(`/api/reports/${reporte._id}/resolver`)
      .set(auth(token))
      .send({ decision: 'confirmado' })
    expect(res.status).toBe(403)
    expect((await Report.findById(reporte._id)).estado).toBe('disputa')
  })

  it.each([
    ['decisión inválida', { decision: 'publicado' }],
    ['campo extra', { decision: 'confirmado', estado: 'publicado' }],
    ['cuerpo vacío', {}],
  ])('responde 400 por %s', async (_caso, cuerpo) => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const { user: autor } = await crearUsuario('turista', 'turista@correo.com')
    const reporte = await Report.create({ ...reporteBase, autor: autor._id, estado: 'disputa' })
    const res = await request(app).patch(`/api/reports/${reporte._id}/resolver`).set(auth(token)).send(cuerpo)
    expect(res.status).toBe(400)
    expect((await Report.findById(reporte._id)).estado).toBe('disputa')
  })

  it('responde 400 con un identificador inválido', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const res = await request(app).patch('/api/reports/no-es-un-id/resolver').set(auth(token)).send({ decision: 'confirmado' })
    expect(res.status).toBe(400)
  })
})