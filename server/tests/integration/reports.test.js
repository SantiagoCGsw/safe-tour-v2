import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'
import Zone from '../../src/models/Zone.model.js'
import Report from '../../src/models/Report.model.js'
import { signToken } from '../../src/utils/generateToken.js'

const poligono = [
  { lat: 4.59, lng: -74.07 },
  { lat: 4.6, lng: -74.07 },
  { lat: 4.6, lng: -74.06 },
]

const reporteValido = {
  titulo: 'Hurto de celular',
  descripcion: 'Ocurrió cerca de la plaza',
  tipo: 'robo',
  ubicacion: { lat: 4.598, lng: -74.068, direccion: 'Calle 10' },
}

const crearUsuario = async (rol, email) => {
  const user = await User.create({ nombre: 'Usuario Prueba', email, password: 'hash-no-usado', rol })
  return { user, token: signToken(user._id) }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

beforeAll(async () => {
  await User.init()
})

describe('HU-04 creación de reportes', () => {
  it('un turista crea un reporte pendiente con plazo de votación', async () => {
    const { user, token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).post('/api/reports').set(auth(token)).send(reporteValido)
    expect(res.status).toBe(201)
    expect(res.body.reporte).toMatchObject({ estado: 'pendiente', tipo: 'robo', autor: String(user._id) })
    expect(res.body.reporte.cierreVotacion).toBeDefined()
  })

  it.each(['gestor', 'admin'])('un %s publica directamente sin votación', async (rol) => {
    const { token } = await crearUsuario(rol, `${rol}@correo.com`)
    const res = await request(app).post('/api/reports').set(auth(token)).send(reporteValido)
    expect(res.status).toBe(201)
    expect(res.body.reporte.estado).toBe('publicado')
    expect(res.body.reporte.cierreVotacion).toBeUndefined()
  })

  it('exige sesión', async () => {
    const res = await request(app).post('/api/reports').send(reporteValido)
    expect(res.status).toBe(401)
  })

  it.each([
    ['estado', { estado: 'publicado' }],
    ['autor', { autor: '64b0c0c0c0c0c0c0c0c0c0c0' }],
    ['confirmaciones', { confirmaciones: 99 }],
    ['activo', { activo: false }],
  ])('rechaza el campo extra %s', async (_nombre, extra) => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).post('/api/reports').set(auth(token)).send({ ...reporteValido, ...extra })
    expect(res.status).toBe(400)
    expect(await Report.countDocuments()).toBe(0)
  })

  it.each([
    ['tipo desconocido', { tipo: 'otro' }],
    ['título corto', { titulo: 'ab' }],
    ['latitud fuera de rango', { ubicacion: { lat: 95, lng: -74 } }],
    ['sin ubicación', { ubicacion: undefined }],
  ])('responde 400 por %s', async (_caso, cambio) => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).post('/api/reports').set(auth(token)).send({ ...reporteValido, ...cambio })
    expect(res.status).toBe(400)
  })

  it('limita a 10 reportes por hora a un turista', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    for (let i = 0; i < 10; i += 1) {
      const ok = await request(app).post('/api/reports').set(auth(token)).send(reporteValido)
      expect(ok.status).toBe(201)
    }
    const excedido = await request(app).post('/api/reports').set(auth(token)).send(reporteValido)
    expect(excedido.status).toBe(429)
  })
})

describe('HU-08 listado y HU-19 historial', () => {
  it('el listado incluye pendientes y oculta rechazados e inactivos', async () => {
    const { user, token } = await crearUsuario('turista', 'turista@correo.com')
    const base = { ...reporteValido, autor: user._id }
    await Report.create([
      { ...base, estado: 'pendiente' },
      { ...base, estado: 'publicado' },
      { ...base, estado: 'rechazado' },
      { ...base, estado: 'publicado', activo: false },
    ])
    const res = await request(app).get('/api/reports').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.reportes).toHaveLength(2)
  })

  it('el historial devuelve solo los reportes del usuario, incluidos los rechazados', async () => {
    const { user, token } = await crearUsuario('turista', 'turista@correo.com')
    const { user: otro } = await crearUsuario('turista', 'otro@correo.com')
    await Report.create([
      { ...reporteValido, autor: user._id, estado: 'rechazado' },
      { ...reporteValido, autor: otro._id, estado: 'publicado' },
    ])
    const res = await request(app).get('/api/reports/mios').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.reportes).toHaveLength(1)
    expect(res.body.reportes[0].estado).toBe('rechazado')
  })

  it('rechaza parámetros de consulta desconocidos', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).get('/api/reports').query({ activo: 'false' }).set(auth(token))
    expect(res.status).toBe(400)
  })
})

describe('HU-03 mapa de calor', () => {
  it('cuenta solo reportes confirmados o publicados dentro de la zona', async () => {
    const { user, token } = await crearUsuario('turista', 'turista@correo.com')
    await Zone.create({ nombre: 'Zona A', tipo: 'cultural', coordenadas: poligono })
    const base = { ...reporteValido, autor: user._id }
    await Report.create([
      { ...base, estado: 'publicado' },
      { ...base, estado: 'confirmado' },
      { ...base, estado: 'pendiente' },
      { ...base, estado: 'disputa' },
      { ...base, estado: 'rechazado' },
      { ...base, estado: 'publicado', ubicacion: { lat: 4.7, lng: -74.0 } },
    ])
    const res = await request(app).get('/api/reports/mapa-calor').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.mapa.puntos).toHaveLength(3)
    expect(res.body.mapa.zonas).toHaveLength(1)
    expect(res.body.mapa.zonas[0]).toMatchObject({ nombre: 'Zona A', reportes: 2, riesgo: 'bajo' })
  })

  it('excluye reportes fuera de la vigencia', async () => {
    const { user, token } = await crearUsuario('turista', 'turista@correo.com')
    const viejo = await Report.create({ ...reporteValido, autor: user._id, estado: 'publicado' })
    await Report.collection.updateOne(
      { _id: viejo._id },
      { $set: { createdAt: new Date(Date.now() - 100 * 60 * 60 * 1000) } },
    )
    const res = await request(app).get('/api/reports/mapa-calor').set(auth(token))
    expect(res.body.mapa.puntos).toHaveLength(0)
  })
})