import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'

const valido = {
  nombre: 'Ana Pérez',
  email: 'ana@correo.com',
  password: 'Clave1234',
}

const registrar = (datos = valido) => request(app).post('/api/auth/register').send(datos)
const consultarMe = (token) =>
  request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)

const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')

beforeAll(async () => {
  await User.init()
})

describe('asignación masiva en el registro', () => {
  it('rechaza rol admin en el body y no crea la cuenta', async () => {
    const res = await registrar({ ...valido, rol: 'admin' })
    expect(res.status).toBe(400)
    expect(await User.countDocuments()).toBe(0)
  })

  it('rechaza rol gestor en el body', async () => {
    const res = await registrar({ ...valido, rol: 'gestor' })
    expect(res.status).toBe(400)
  })

  it.each([
    ['activo', { activo: false }],
    ['_id', { _id: '64b0c0c0c0c0c0c0c0c0c0c0' }],
    ['fotoPerfil', { fotoPerfil: 'http://x.com/a.png' }],
    ['campo desconocido', { cualquierCosa: 1 }],
  ])('rechaza el campo extra %s', async (_nombre, extra) => {
    const res = await registrar({ ...valido, ...extra })
    expect(res.status).toBe(400)
    expect(await User.countDocuments()).toBe(0)
  })

  it('el registro público siempre crea turistas', async () => {
    const res = await registrar()
    expect(res.status).toBe(201)
    const guardado = await User.findOne({ email: valido.email })
    expect(guardado.rol).toBe('turista')
  })
})

describe('inyección NoSQL en el login', () => {
  it('rechaza un operador en el correo', async () => {
    await registrar()
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: valido.password })
    expect(res.status).toBe(400)
    expect(res.body.token).toBeUndefined()
  })

  it('rechaza un operador en la contraseña', async () => {
    await registrar()
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: valido.email, password: { $ne: null } })
    expect(res.status).toBe(400)
    expect(res.body.token).toBeUndefined()
  })

  it('rechaza un arreglo en el correo', async () => {
    await registrar()
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: [valido.email], password: valido.password })
    expect(res.status).toBe(400)
  })
})

describe('usuario desactivado o eliminado con token válido', () => {
  it('rechaza el token de un usuario desactivado', async () => {
    const { body } = await registrar()
    await User.updateOne({ email: valido.email }, { activo: false })
    const res = await consultarMe(body.token)
    expect(res.status).toBe(401)
  })

  it('impide iniciar sesión a un usuario desactivado', async () => {
    await registrar()
    await User.updateOne({ email: valido.email }, { activo: false })
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: valido.email, password: valido.password })
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ message: 'Credenciales inválidas' })
  })

  it('rechaza el token de un usuario eliminado', async () => {
    const { body } = await registrar()
    await User.deleteOne({ email: valido.email })
    const res = await consultarMe(body.token)
    expect(res.status).toBe(401)
  })
})

describe('el rol se lee de la base de datos', () => {
  it('refleja el rol actual aunque el token se emitió antes del cambio', async () => {
    const { body } = await registrar()
    expect(body.user.rol).toBe('turista')
    await User.updateOne({ email: valido.email }, { rol: 'gestor' })
    const res = await consultarMe(body.token)
    expect(res.status).toBe(200)
    expect(res.body.user.rol).toBe('gestor')
  })

  it('ignora un rol incluido en el payload del token', async () => {
    const { body } = await registrar()
    const id = body.user._id ?? body.user.id
    const forjado = jwt.sign({ id, rol: 'admin' }, process.env.JWT_SECRET, { algorithm: 'HS256' })
    const res = await consultarMe(forjado)
    expect(res.status).toBe(200)
    expect(res.body.user.rol).toBe('turista')
  })
})

describe('tokens inválidos', () => {
  it('rechaza un token firmado con otra clave', async () => {
    const { body } = await registrar()
    const id = body.user._id ?? body.user.id
    const ajeno = jwt.sign({ id }, 'otra-clave-distinta-'.repeat(3))
    const res = await consultarMe(ajeno)
    expect(res.status).toBe(401)
  })

  it('rechaza un token con algoritmo none', async () => {
    const { body } = await registrar()
    const id = body.user._id ?? body.user.id
    const sinFirma = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ id })}.`
    const res = await consultarMe(sinFirma)
    expect(res.status).toBe(401)
  })

  it('rechaza un token expirado', async () => {
    const { body } = await registrar()
    const id = body.user._id ?? body.user.id
    const expirado = jwt.sign(
      { id, exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET,
    )
    const res = await consultarMe(expirado)
    expect(res.status).toBe(401)
  })

  it('rechaza un token con id que no corresponde a ningún usuario', async () => {
    const inexistente = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString() },
      process.env.JWT_SECRET,
    )
    const res = await consultarMe(inexistente)
    expect(res.status).toBe(401)
  })

  it.each([
    ['id que no es ObjectId', { id: 'no-es-un-id' }],
    ['id como objeto', { id: { $ne: null } }],
    ['sin id', {}],
  ])('rechaza un token con %s', async (_caso, payload) => {
    const token = jwt.sign(payload, process.env.JWT_SECRET)
    const res = await consultarMe(token)
    expect(res.status).toBe(401)
  })

  it('rechaza una cabecera sin el esquema Bearer', async () => {
    const { body } = await registrar()
    const res = await request(app).get('/api/auth/me').set('Authorization', body.token)
    expect(res.status).toBe(401)
  })

  it('rechaza un token basura', async () => {
    const res = await consultarMe('esto.no.es.un.jwt')
    expect(res.status).toBe(401)
  })
})

describe('respuestas de error', () => {
  it('no filtra detalles internos en un 401', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.body).toEqual({ message: 'No autorizado' })
  })
})