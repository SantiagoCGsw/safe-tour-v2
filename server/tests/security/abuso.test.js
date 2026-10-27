// server/tests/security/abuso.test.js
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'
import Report from '../../src/models/Report.model.js'
import Vote from '../../src/models/Vote.model.js'
import { signToken } from '../../src/utils/generateToken.js'

const reporteBase = {
  titulo: 'Hurto de celular',
  tipo: 'robo',
  ubicacion: { lat: 4.598, lng: -74.068 },
}

const crearUsuario = async (email, extra = {}) => {
  const user = await User.create({
    nombre: 'Usuario Prueba',
    email,
    password: 'hash-no-usado',
    rol: 'turista',
    ...extra,
  })
  return { user, token: signToken(user._id) }
}

const crearReporte = (autor, extra = {}) =>
  Report.create({
    ...reporteBase,
    autor: autor._id,
    estado: 'pendiente',
    cierreVotacion: new Date(Date.now() + 60 * 60 * 1000),
    ...extra,
  })

const auth = (token) => ({ Authorization: `Bearer ${token}` })

beforeAll(async () => {
  await User.init()
  await Vote.init()
})

describe('configuración base de la API', () => {
  it('responde el chequeo de salud', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('no expone x-powered-by', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('envía cabeceras de helmet', async () => {
    const res = await request(app).get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('permite un origen de la lista exacta', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it.each([
    'https://safe-tour-evil.vercel.app',
    'http://localhost:5173.evil.com',
    'http://localhost:51730',
  ])('no concede CORS a %s', async (origen) => {
    const res = await request(app).get('/api/health').set('Origin', origen)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('responde 400 genérico ante JSON mal formado', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"a":')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ message: 'JSON inválido' })
  })

  it('rechaza cuerpos mayores a 10 kb', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ a: 'x'.repeat(20000) }))
    expect(res.status).toBe(413)
  })

  it('responde 404 genérico en rutas inexistentes', async () => {
    const res = await request(app).get('/api/no-existe')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ message: 'Recurso no encontrado' })
  })
})

describe('antiabuso en la votación por consenso', () => {
  it('nadie vota su propio reporte', async () => {
    const { user: autor, token } = await crearUsuario('autor@correo.com')
    const reporte = await crearReporte(autor)
    const res = await request(app)
      .post(`/api/votes/${reporte._id}`)
      .set(auth(token))
      .send({ voto: 'confirmar' })
    expect(res.status).toBe(403)
    expect(await Vote.countDocuments()).toBe(0)
    const actual = await Report.findById(reporte._id)
    expect(actual.confirmaciones).toBe(0)
  })

  it('un usuario no puede votar dos veces el mismo reporte', async () => {
    const { user: autor } = await crearUsuario('autor@correo.com')
    const { token } = await crearUsuario('votante@correo.com')
    const reporte = await crearReporte(autor)

    const primero = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    const segundo = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    expect(primero.status).toBe(201)
    expect(segundo.status).toBe(409)

    const actual = await Report.findById(reporte._id)
    expect(actual.confirmaciones).toBe(1)
    expect(await Vote.countDocuments()).toBe(1)
  })

  it('no permite cambiar el voto emitido', async () => {
    const { user: autor } = await crearUsuario('autor@correo.com')
    const { token } = await crearUsuario('votante@correo.com')
    const reporte = await crearReporte(autor)

    await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    const cambio = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'rechazar' })
    expect(cambio.status).toBe(409)

    const actual = await Report.findById(reporte._id)
    expect(actual.confirmaciones).toBe(1)
    expect(actual.rechazos).toBe(0)
  })

  it('solo cuenta un voto cuando llegan varias peticiones simultáneas del mismo usuario', async () => {
    const { user: autor } = await crearUsuario('autor@correo.com')
    const { token } = await crearUsuario('votante@correo.com')
    const reporte = await crearReporte(autor)

    const respuestas = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' }),
      ),
    )
    const estados = respuestas.map((r) => r.status)
    expect(estados.filter((s) => s === 201)).toHaveLength(1)
    expect(estados.filter((s) => s === 409)).toHaveLength(5)

    const actual = await Report.findById(reporte._id)
    expect(actual.confirmaciones).toBe(1)
    expect(await Vote.countDocuments({ reporte: reporte._id })).toBe(1)
  })

  it('suma los votos de usuarios distintos', async () => {
    const { user: autor } = await crearUsuario('autor@correo.com')
    const a = await crearUsuario('a@correo.com')
    const b = await crearUsuario('b@correo.com')
    const c = await crearUsuario('c@correo.com')
    const reporte = await crearReporte(autor)

    await request(app).post(`/api/votes/${reporte._id}`).set(auth(a.token)).send({ voto: 'confirmar' })
    await request(app).post(`/api/votes/${reporte._id}`).set(auth(b.token)).send({ voto: 'confirmar' })
    await request(app).post(`/api/votes/${reporte._id}`).set(auth(c.token)).send({ voto: 'rechazar' })

    const actual = await Report.findById(reporte._id)
    expect(actual.confirmaciones).toBe(2)
    expect(actual.rechazos).toBe(1)
  })

  it.each([
    ['ya confirmado', { estado: 'confirmado', cierreVotacion: undefined }],
    ['ya rechazado', { estado: 'rechazado', cierreVotacion: undefined }],
    ['en disputa', { estado: 'disputa', cierreVotacion: undefined }],
    ['con el plazo vencido', { cierreVotacion: new Date(Date.now() - 60 * 1000) }],
  ])('no admite votos en un reporte %s', async (_caso, extra) => {
    const { user: autor } = await crearUsuario('autor@correo.com')
    const { token } = await crearUsuario('votante@correo.com')
    const reporte = await crearReporte(autor, extra)

    const res = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    expect(res.status).toBe(409)
    expect(await Vote.countDocuments()).toBe(0)
  })

  it('no admite votos en un reporte desactivado', async () => {
    const { user: autor } = await crearUsuario('autor@correo.com')
    const { token } = await crearUsuario('votante@correo.com')
    const reporte = await crearReporte(autor, { activo: false })
    const res = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    expect(res.status).toBe(404)
    expect(await Vote.countDocuments()).toBe(0)
  })

  it('responde 404 si el reporte no existe', async () => {
    const { token } = await crearUsuario('votante@correo.com')
    const res = await request(app)
      .post('/api/votes/64b0c0c0c0c0c0c0c0c0c0c0')
      .set(auth(token))
      .send({ voto: 'confirmar' })
    expect(res.status).toBe(404)
  })

  it.each([
    ['voto inexistente', { voto: 'abstenerse' }],
    ['voto vacío', {}],
    ['campo extra', { voto: 'confirmar', peso: 100 }],
    ['voto con tipo incorrecto', { voto: true }],
  ])('responde 400 por %s', async (_caso, cuerpo) => {
    const { user: autor } = await crearUsuario('autor@correo.com')
    const { token } = await crearUsuario('votante@correo.com')
    const reporte = await crearReporte(autor)
    const res = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send(cuerpo)
    expect(res.status).toBe(400)
    expect(await Vote.countDocuments()).toBe(0)
  })

  it('responde 400 con un identificador de reporte inválido', async () => {
    const { token } = await crearUsuario('votante@correo.com')
    const res = await request(app).post('/api/votes/no-es-un-id').set(auth(token)).send({ voto: 'confirmar' })
    expect(res.status).toBe(400)
  })

  it('exige sesión para votar', async () => {
    const { user: autor } = await crearUsuario('autor@correo.com')
    const reporte = await crearReporte(autor)
    const res = await request(app).post(`/api/votes/${reporte._id}`).send({ voto: 'confirmar' })
    expect(res.status).toBe(401)
    expect(await Vote.countDocuments()).toBe(0)
  })

  it('una cuenta desactivada no puede votar aunque conserve su token', async () => {
    const { user: autor } = await crearUsuario('autor@correo.com')
    const { token } = await crearUsuario('votante@correo.com', { activo: false })
    const reporte = await crearReporte(autor)
    const res = await request(app).post(`/api/votes/${reporte._id}`).set(auth(token)).send({ voto: 'confirmar' })
    expect(res.status).toBe(401)
    expect(await Vote.countDocuments()).toBe(0)
  })

  it('un voto ajeno no es visible: mio devuelve solo el voto propio', async () => {
    const { user: autor } = await crearUsuario('autor@correo.com')
    const a = await crearUsuario('a@correo.com')
    const b = await crearUsuario('b@correo.com')
    const reporte = await crearReporte(autor)

    await request(app).post(`/api/votes/${reporte._id}`).set(auth(a.token)).send({ voto: 'confirmar' })
    const deA = await request(app).get(`/api/votes/${reporte._id}/mio`).set(auth(a.token))
    const deB = await request(app).get(`/api/votes/${reporte._id}/mio`).set(auth(b.token))
    expect(deA.body.voto).toBe('confirmar')
    expect(deB.body.voto).toBeNull()
  })
})