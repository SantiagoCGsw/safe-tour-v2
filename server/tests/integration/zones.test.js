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

const zonaValida = {
  nombre: 'La Candelaria',
  descripcion: 'Centro histórico',
  tipo: 'cultural',
  nivelSeguridad: 2,
  coordenadas: poligono,
}

const crearUsuario = async (rol, email) => {
  const user = await User.create({ nombre: 'Usuario Prueba', email, password: 'hash-no-usado', rol })
  return { user, token: signToken(user._id) }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

beforeAll(async () => {
  await User.init()
  await Zone.init()
})

describe('HU-12 listado público de zonas', () => {
  it('lista solo las zonas activas sin exigir sesión', async () => {
    await Zone.create([zonaValida, { ...zonaValida, nombre: 'Inactiva', activo: false }])
    const res = await request(app).get('/api/zones')
    expect(res.status).toBe(200)
    expect(res.body.zonas).toHaveLength(1)
    expect(res.body.zonas[0].nombre).toBe('La Candelaria')
  })

  it('filtra por tipo', async () => {
    await Zone.create([zonaValida, { ...zonaValida, nombre: 'Parque', tipo: 'segura' }])
    const res = await request(app).get('/api/zones').query({ tipo: 'segura' })
    expect(res.body.zonas).toHaveLength(1)
    expect(res.body.zonas[0].nombre).toBe('Parque')
  })

  it('rechaza un tipo inválido con 400', async () => {
    const res = await request(app).get('/api/zones').query({ tipo: 'otra' })
    expect(res.status).toBe(400)
  })

  it('rechaza parámetros de consulta desconocidos', async () => {
    const res = await request(app).get('/api/zones').query({ activo: 'false' })
    expect(res.status).toBe(400)
  })
})

describe('HU-12 creación de zonas', () => {
  it('permite al gestor crear una zona y registra al autor', async () => {
    const { user, token } = await crearUsuario('gestor', 'gestor@correo.com')
    const res = await request(app).post('/api/zones').set(auth(token)).send(zonaValida)
    expect(res.status).toBe(201)
    expect(res.body.zona).toMatchObject({ nombre: 'La Candelaria', tipo: 'cultural', nivelSeguridad: 2, activo: true })
    expect(res.body.zona.creadoPor).toBe(String(user._id))
  })

  it('permite al admin crear una zona', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const res = await request(app).post('/api/zones').set(auth(token)).send(zonaValida)
    expect(res.status).toBe(201)
  })

  it('asigna nivel de seguridad 3 por defecto', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const { nivelSeguridad, ...sinNivel } = zonaValida
    const res = await request(app).post('/api/zones').set(auth(token)).send(sinNivel)
    expect(res.status).toBe(201)
    expect(res.body.zona.nivelSeguridad).toBe(3)
  })

  it('rechaza a un turista con 403', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).post('/api/zones').set(auth(token)).send(zonaValida)
    expect(res.status).toBe(403)
    expect(await Zone.countDocuments()).toBe(0)
  })

  it('rechaza sin sesión con 401', async () => {
    const res = await request(app).post('/api/zones').send(zonaValida)
    expect(res.status).toBe(401)
  })

  it.each([
    ['polígono de dos puntos', { coordenadas: poligono.slice(0, 2) }],
    ['nivel de seguridad 0', { nivelSeguridad: 0 }],
    ['nivel de seguridad 6', { nivelSeguridad: 6 }],
    ['nivel de seguridad decimal', { nivelSeguridad: 2.5 }],
    ['tipo desconocido', { tipo: 'otra' }],
    ['latitud fuera de rango', { coordenadas: [{ lat: 95, lng: -74 }, ...poligono.slice(1)] }],
    ['nombre de un carácter', { nombre: 'A' }],
  ])('responde 400 por %s', async (_caso, cambio) => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const res = await request(app).post('/api/zones').set(auth(token)).send({ ...zonaValida, ...cambio })
    expect(res.status).toBe(400)
    expect(await Zone.countDocuments()).toBe(0)
  })

  it.each([
    ['activo', { activo: false }],
    ['creadoPor', { creadoPor: '64b0c0c0c0c0c0c0c0c0c0c0' }],
    ['_id', { _id: '64b0c0c0c0c0c0c0c0c0c0c0' }],
  ])('rechaza el campo extra %s (asignación masiva)', async (_nombre, extra) => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const res = await request(app).post('/api/zones').set(auth(token)).send({ ...zonaValida, ...extra })
    expect(res.status).toBe(400)
    expect(await Zone.countDocuments()).toBe(0)
  })
})

describe('HU-12 edición de zonas', () => {
  it('permite al gestor editar atributos', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const zona = await Zone.create(zonaValida)
    const res = await request(app)
      .put(`/api/zones/${zona._id}`)
      .set(auth(token))
      .send({ nivelSeguridad: 4, nombre: 'Candelaria Norte' })
    expect(res.status).toBe(200)
    expect(res.body.zona).toMatchObject({ nivelSeguridad: 4, nombre: 'Candelaria Norte' })
  })

  it('rechaza una edición vacía con 400', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const zona = await Zone.create(zonaValida)
    const res = await request(app).put(`/api/zones/${zona._id}`).set(auth(token)).send({})
    expect(res.status).toBe(400)
  })

  it('no permite reactivar ni cambiar el estado por esta vía', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const zona = await Zone.create(zonaValida)
    const res = await request(app).put(`/api/zones/${zona._id}`).set(auth(token)).send({ activo: false })
    expect(res.status).toBe(400)
    expect((await Zone.findById(zona._id)).activo).toBe(true)
  })

  it('rechaza a un turista con 403', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const zona = await Zone.create(zonaValida)
    const res = await request(app).put(`/api/zones/${zona._id}`).set(auth(token)).send({ nivelSeguridad: 5 })
    expect(res.status).toBe(403)
    expect((await Zone.findById(zona._id)).nivelSeguridad).toBe(2)
  })

  it('responde 404 si la zona no existe', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const res = await request(app)
      .put('/api/zones/64b0c0c0c0c0c0c0c0c0c0c0')
      .set(auth(token))
      .send({ nivelSeguridad: 5 })
    expect(res.status).toBe(404)
  })

  it('responde 400 con un identificador inválido', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const res = await request(app).put('/api/zones/no-es-un-id').set(auth(token)).send({ nivelSeguridad: 5 })
    expect(res.status).toBe(400)
  })
})

describe('HU-12 desactivación de zonas', () => {
  it('desactiva sin borrar el documento', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const zona = await Zone.create(zonaValida)
    const res = await request(app).delete(`/api/zones/${zona._id}`).set(auth(token))
    expect(res.status).toBe(200)
    const guardada = await Zone.findById(zona._id)
    expect(guardada).not.toBeNull()
    expect(guardada.activo).toBe(false)
  })

  it('una zona desactivada deja de aparecer en el listado y en el detalle', async () => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const zona = await Zone.create(zonaValida)
    await request(app).delete(`/api/zones/${zona._id}`).set(auth(token))
    const lista = await request(app).get('/api/zones')
    const detalle = await request(app).get(`/api/zones/${zona._id}`)
    expect(lista.body.zonas).toHaveLength(0)
    expect(detalle.status).toBe(404)
  })

  it('rechaza a un turista con 403', async () => {
    const { token } = await crearUsuario('turista', 'turista@correo.com')
    const zona = await Zone.create(zonaValida)
    const res = await request(app).delete(`/api/zones/${zona._id}`).set(auth(token))
    expect(res.status).toBe(403)
    expect((await Zone.findById(zona._id)).activo).toBe(true)
  })
})