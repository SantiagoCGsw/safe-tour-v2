import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'
import Zone from '../../src/models/Zone.model.js'
import { signToken } from '../../src/utils/generateToken.js'

const poligono = [
  { lat: 4.59, lng: -74.07 },
  { lat: 4.6, lng: -74.07 },
  { lat: 4.6, lng: -74.06 },
]

const crearUsuario = async (rol, email) => {
  const user = await User.create({ nombre: 'Usuario Prueba', email, password: 'hash-no-usado', rol })
  return { user, token: signToken(user._id) }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

const ID = '64b0c0c0c0c0c0c0c0c0c0c0'

const rutasAdmin = [
  ['get', '/api/admin/stats'],
  ['get', '/api/admin/users'],
  ['post', '/api/admin/users'],
  ['patch', `/api/admin/users/${ID}/rol`],
  ['patch', `/api/admin/users/${ID}/estado`],
]

const rutasEscrituraZonas = [
  ['post', '/api/zones'],
  ['put', `/api/zones/${ID}`],
  ['delete', `/api/zones/${ID}`],
]

beforeAll(async () => {
  await User.init()
})

describe('rutas de administración', () => {
  it.each(rutasAdmin)('%s %s responde 401 sin sesión', async (metodo, ruta) => {
    const res = await request(app)[metodo](ruta).send({})
    expect(res.status).toBe(401)
  })

  it.each(rutasAdmin)('%s %s responde 403 a un turista', async (metodo, ruta) => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app)[metodo](ruta).set(auth(token)).send({})
    expect(res.status).toBe(403)
  })

  it.each(rutasAdmin)('%s %s responde 403 a un gestor', async (metodo, ruta) => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const res = await request(app)[metodo](ruta).set(auth(token)).send({})
    expect(res.status).toBe(403)
  })
})

describe('escritura de zonas', () => {
  it.each(rutasEscrituraZonas)('%s %s responde 401 sin sesión', async (metodo, ruta) => {
    const res = await request(app)[metodo](ruta).send({})
    expect(res.status).toBe(401)
  })

  it.each(rutasEscrituraZonas)('%s %s responde 403 a un turista', async (metodo, ruta) => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app)[metodo](ruta).set(auth(token)).send({})
    expect(res.status).toBe(403)
  })

  it('un turista no altera zonas existentes', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const zona = await Zone.create({ nombre: 'Zona A', tipo: 'cultural', coordenadas: poligono })
    await request(app).put(`/api/zones/${zona._id}`).set(auth(token)).send({ nivelSeguridad: 5 })
    await request(app).delete(`/api/zones/${zona._id}`).set(auth(token))
    const guardada = await Zone.findById(zona._id)
    expect(guardada.nivelSeguridad).toBe(3)
    expect(guardada.activo).toBe(true)
  })
})

describe('escalada de privilegios', () => {
  it('un turista no puede cambiarse el rol desde su perfil', async () => {
    const { user, token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).put('/api/users/perfil').set(auth(token)).send({ rol: 'admin' })
    expect(res.status).toBe(400)
    expect((await User.findById(user._id)).rol).toBe('turista')
  })

  it.each([
    ['activo', { activo: false }],
    ['email', { email: 'otro@correo.com' }],
    ['password', { password: 'Clave1234' }],
    ['_id', { _id: ID }],
  ])('el perfil rechaza el campo %s', async (_nombre, extra) => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).put('/api/users/perfil').set(auth(token)).send({ nombre: 'Nuevo Nombre', ...extra })
    expect(res.status).toBe(400)
  })

  it('el registro público no crea gestores ni admins', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nombre: 'Intruso', email: 'intruso@correo.com', password: 'Clave1234', rol: 'admin' })
    expect(res.status).toBe(400)
    expect(await User.countDocuments()).toBe(0)
  })
})

describe('HU-19 perfil propio', () => {
  it('actualiza nombre y foto del propio usuario', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app)
      .put('/api/users/perfil')
      .set(auth(token))
      .send({ nombre: 'Nombre Nuevo', fotoPerfil: 'https://ejemplo.com/foto.png' })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ nombre: 'Nombre Nuevo', fotoPerfil: 'https://ejemplo.com/foto.png' })
    expect(res.body.user.password).toBeUndefined()
  })

  it.each([
    ['http sin cifrado', 'http://ejemplo.com/foto.png'],
    ['esquema javascript', 'javascript:alert(1)'],
    ['texto que no es URL', 'foto.png'],
  ])('rechaza una foto con %s', async (_caso, fotoPerfil) => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).put('/api/users/perfil').set(auth(token)).send({ fotoPerfil })
    expect(res.status).toBe(400)
  })

  it('rechaza una edición vacía y exige sesión', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const vacia = await request(app).put('/api/users/perfil').set(auth(token)).send({})
    const sinSesion = await request(app).put('/api/users/perfil').send({ nombre: 'Nombre Nuevo' })
    expect(vacia.status).toBe(400)
    expect(sinSesion.status).toBe(401)
  })

  it('GET /perfil devuelve solo al usuario autenticado', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    await crearUsuario('turista', 'otro@correo.com')
    const res = await request(app).get('/api/users/perfil').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('turista@correo.com')
  })
})