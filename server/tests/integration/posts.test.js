// server/tests/integration/posts.test.js
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'
import Zone from '../../src/models/Zone.model.js'
import Post from '../../src/models/Post.model.js'
import AuditLog from '../../src/models/AuditLog.model.js'
import { signToken } from '../../src/utils/generateToken.js'

const ID_INEXISTENTE = '64b0c0c0c0c0c0c0c0c0c0c0'

const poligono = [
  { lat: 4.59, lng: -74.07 },
  { lat: 4.6, lng: -74.07 },
  { lat: 4.6, lng: -74.06 },
]

const crearUsuario = async (rol, email, nombre = 'Usuario Prueba') => {
  const user = await User.create({ nombre, email, password: 'hash-no-usado', rol })
  return { user, token: signToken(user._id) }
}

const crearPost = (autor, extra = {}) =>
  Post.create({ autor: autor._id, contenido: 'Publicación de prueba', ...extra })

const fechar = (post, minutosAtras) =>
  Post.updateOne(
    { _id: post._id },
    { createdAt: new Date(Date.now() - minutosAtras * 60 * 1000) },
    { timestamps: false },
  )

const auth = (token) => ({ Authorization: `Bearer ${token}` })

beforeAll(async () => {
  await User.init()
  await AuditLog.init()
})

describe('HU-08 creación de publicaciones', () => {
  it('crea una publicación y expone solo datos públicos del autor', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com', 'Ana Torres')
    const res = await request(app).post('/api/posts').set(auth(token)).send({ contenido: '  Hola Bogotá  ' })
    expect(res.status).toBe(201)
    expect(res.body.publicacion).toMatchObject({
      contenido: 'Hola Bogotá',
      reacciones: 0,
      reaccionado: false,
      comentarios: [],
    })
    expect(res.body.publicacion.autor).toEqual({ _id: String(user._id), nombre: 'Ana Torres' })
    const texto = JSON.stringify(res.body)
    expect(texto).not.toContain('ana@correo.com')
    expect(texto).not.toContain('password')
    expect(await Post.countDocuments()).toBe(1)
  })

  it('asocia la publicación a una zona activa', async () => {
    const { token } = await crearUsuario('turista', 'ana@correo.com')
    const zona = await Zone.create({ nombre: 'La Candelaria', tipo: 'cultural', coordenadas: poligono })
    const res = await request(app)
      .post('/api/posts')
      .set(auth(token))
      .send({ contenido: 'Hola', zona: String(zona._id) })
    expect(res.status).toBe(201)
    expect(res.body.publicacion.zona).toEqual({ _id: String(zona._id), nombre: 'La Candelaria' })
  })

  it('responde 404 si la zona no existe o está desactivada', async () => {
    const { token } = await crearUsuario('turista', 'ana@correo.com')
    const inactiva = await Zone.create({
      nombre: 'Zona vieja',
      tipo: 'cultural',
      coordenadas: poligono,
      activo: false,
    })
    const inexistente = await request(app).post('/api/posts').set(auth(token)).send({ contenido: 'Hola', zona: ID_INEXISTENTE })
    const desactivada = await request(app)
      .post('/api/posts')
      .set(auth(token))
      .send({ contenido: 'Hola', zona: String(inactiva._id) })
    expect(inexistente.status).toBe(404)
    expect(desactivada.status).toBe(404)
    expect(await Post.countDocuments()).toBe(0)
  })

  it.each([
    ['contenido vacío', { contenido: '' }],
    ['contenido solo con espacios', { contenido: '    ' }],
    ['contenido de 501 caracteres', { contenido: 'x'.repeat(501) }],
    ['cuerpo vacío', {}],
    ['contenido que no es texto', { contenido: 123 }],
    ['campo extra', { contenido: 'Hola', autor: ID_INEXISTENTE }],
    ['zona con formato inválido', { contenido: 'Hola', zona: 'no-es-un-id' }],
  ])('responde 400 por %s', async (_caso, cuerpo) => {
    const { token } = await crearUsuario('turista', 'ana@correo.com')
    const res = await request(app).post('/api/posts').set(auth(token)).send(cuerpo)
    expect(res.status).toBe(400)
    expect(await Post.countDocuments()).toBe(0)
  })

  it('exige sesión', async () => {
    const res = await request(app).post('/api/posts').send({ contenido: 'Hola' })
    expect(res.status).toBe(401)
  })

  it('limita a 10 publicaciones por hora a los turistas', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    await Post.insertMany(Array.from({ length: 10 }, () => ({ autor: user._id, contenido: 'Previa' })))
    const res = await request(app).post('/api/posts').set(auth(token)).send({ contenido: 'Una más' })
    expect(res.status).toBe(429)
    expect(await Post.countDocuments()).toBe(10)
  })

  it('no cuenta las publicaciones de hace más de una hora', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    await Post.insertMany(Array.from({ length: 10 }, () => ({ autor: user._id, contenido: 'Previa' })))
    await Post.updateMany({}, { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, { timestamps: false })
    const res = await request(app).post('/api/posts').set(auth(token)).send({ contenido: 'Nueva' })
    expect(res.status).toBe(201)
  })

  it.each(['gestor', 'admin'])('el límite por hora no aplica a un %s', async (rol) => {
    const { user, token } = await crearUsuario(rol, `${rol}@correo.com`)
    await Post.insertMany(Array.from({ length: 10 }, () => ({ autor: user._id, contenido: 'Previa' })))
    const res = await request(app).post('/api/posts').set(auth(token)).send({ contenido: 'Aviso oficial' })
    expect(res.status).toBe(201)
  })
})

describe('HU-08 listado del feed', () => {
  it('lista solo publicaciones activas, de la más reciente a la más antigua', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const vieja = await crearPost(user, { contenido: 'Vieja' })
    const nueva = await crearPost(user, { contenido: 'Nueva' })
    const media = await crearPost(user, { contenido: 'Media' })
    await crearPost(user, { contenido: 'Retirada', activo: false })
    await fechar(vieja, 30)
    await fechar(media, 20)
    await fechar(nueva, 10)

    const res = await request(app).get('/api/posts').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.publicaciones.map((p) => p.contenido)).toEqual(['Nueva', 'Media', 'Vieja'])
  })

  it('no expone las denuncias ni datos privados en el feed público', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const { user: otro } = await crearUsuario('turista', 'otro@correo.com')
    await crearPost(user, { denuncias: [{ usuario: otro._id, motivo: 'Spam' }] })
    const res = await request(app).get('/api/posts').set(auth(token))
    expect(res.body.publicaciones[0].denuncias).toBeUndefined()
    const texto = JSON.stringify(res.body)
    expect(texto).not.toContain('ana@correo.com')
    expect(texto).not.toContain('otro@correo.com')
  })

  it('filtra por zona y respeta el límite', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const zona = await Zone.create({ nombre: 'Zona A', tipo: 'cultural', coordenadas: poligono })
    await crearPost(user, { contenido: 'En zona 1', zona: zona._id })
    await crearPost(user, { contenido: 'En zona 2', zona: zona._id })
    await crearPost(user, { contenido: 'Sin zona' })

    const porZona = await request(app).get('/api/posts').query({ zona: String(zona._id) }).set(auth(token))
    const limitado = await request(app).get('/api/posts').query({ limite: 2 }).set(auth(token))
    expect(porZona.body.publicaciones).toHaveLength(2)
    expect(limitado.body.publicaciones).toHaveLength(2)
  })

  it.each([
    ['límite en cero', { limite: '0' }],
    ['límite sobre el máximo', { limite: '101' }],
    ['zona inválida', { zona: 'no-es-un-id' }],
    ['parámetro desconocido', { autor: ID_INEXISTENTE }],
  ])('responde 400 por %s', async (_caso, query) => {
    const { token } = await crearUsuario('turista', 'ana@correo.com')
    const res = await request(app).get('/api/posts').query(query).set(auth(token))
    expect(res.status).toBe(400)
  })

  it('indica si el usuario que consulta ya reaccionó', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const { token: tokenOtro } = await crearUsuario('turista', 'otro@correo.com')
    await crearPost(user, { reacciones: [user._id] })
    const propio = await request(app).get('/api/posts').set(auth(token))
    const ajeno = await request(app).get('/api/posts').set(auth(tokenOtro))
    expect(propio.body.publicaciones[0]).toMatchObject({ reacciones: 1, reaccionado: true })
    expect(ajeno.body.publicaciones[0]).toMatchObject({ reacciones: 1, reaccionado: false })
  })

  it('oculta los comentarios desactivados', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    await crearPost(user, {
      comentarios: [
        { autor: user._id, texto: 'Visible' },
        { autor: user._id, texto: 'Oculto', activo: false },
      ],
    })
    const res = await request(app).get('/api/posts').set(auth(token))
    expect(res.body.publicaciones[0].comentarios.map((c) => c.texto)).toEqual(['Visible'])
  })

  it('exige sesión', async () => {
    const res = await request(app).get('/api/posts')
    expect(res.status).toBe(401)
  })
})

describe('HU-20 reacciones', () => {
  it('registra una reacción por usuario aunque se repita', async () => {
    const { user } = await crearUsuario('turista', 'ana@correo.com')
    const { token } = await crearUsuario('turista', 'otro@correo.com')
    const post = await crearPost(user)

    const primera = await request(app).post(`/api/posts/${post._id}/reacciones`).set(auth(token))
    const segunda = await request(app).post(`/api/posts/${post._id}/reacciones`).set(auth(token))
    expect(primera.status).toBe(200)
    expect(primera.body.publicacion).toMatchObject({ reacciones: 1, reaccionado: true })
    expect(segunda.body.publicacion.reacciones).toBe(1)
    expect((await Post.findById(post._id)).reacciones).toHaveLength(1)
  })

  it('suma las reacciones de usuarios distintos', async () => {
    const { user } = await crearUsuario('turista', 'ana@correo.com')
    const a = await crearUsuario('turista', 'a@correo.com')
    const b = await crearUsuario('turista', 'b@correo.com')
    const post = await crearPost(user)
    await request(app).post(`/api/posts/${post._id}/reacciones`).set(auth(a.token))
    const res = await request(app).post(`/api/posts/${post._id}/reacciones`).set(auth(b.token))
    expect(res.body.publicacion.reacciones).toBe(2)
  })

  it('cuenta una sola reacción ante peticiones simultáneas del mismo usuario', async () => {
    const { user } = await crearUsuario('turista', 'ana@correo.com')
    const { token } = await crearUsuario('turista', 'otro@correo.com')
    const post = await crearPost(user)
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post(`/api/posts/${post._id}/reacciones`).set(auth(token))),
    )
    expect(respuestas.every((r) => r.status === 200)).toBe(true)
    expect((await Post.findById(post._id)).reacciones).toHaveLength(1)
  })

  it('quita solo la reacción propia y la operación es idempotente', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const { user: otro } = await crearUsuario('turista', 'otro@correo.com')
    const post = await crearPost(user, { reacciones: [user._id, otro._id] })

    const quitar = await request(app).delete(`/api/posts/${post._id}/reacciones`).set(auth(token))
    const repetir = await request(app).delete(`/api/posts/${post._id}/reacciones`).set(auth(token))
    expect(quitar.status).toBe(200)
    expect(quitar.body.publicacion).toMatchObject({ reacciones: 1, reaccionado: false })
    expect(repetir.status).toBe(200)
    const guardada = await Post.findById(post._id)
    expect(guardada.reacciones.map(String)).toEqual([String(otro._id)])
  })

  it('responde 404 en publicaciones inexistentes o retiradas', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const retirada = await crearPost(user, { activo: false })
    const inexistente = await request(app).post(`/api/posts/${ID_INEXISTENTE}/reacciones`).set(auth(token))
    const alRetirada = await request(app).post(`/api/posts/${retirada._id}/reacciones`).set(auth(token))
    const quitarRetirada = await request(app).delete(`/api/posts/${retirada._id}/reacciones`).set(auth(token))
    expect(inexistente.status).toBe(404)
    expect(alRetirada.status).toBe(404)
    expect(quitarRetirada.status).toBe(404)
  })

  it('responde 400 con un identificador inválido y 401 sin sesión', async () => {
    const { token } = await crearUsuario('turista', 'ana@correo.com')
    const invalido = await request(app).post('/api/posts/no-es-un-id/reacciones').set(auth(token))
    const sinSesion = await request(app).post(`/api/posts/${ID_INEXISTENTE}/reacciones`)
    expect(invalido.status).toBe(400)
    expect(sinSesion.status).toBe(401)
  })
})

describe('HU-20 comentarios', () => {
  it('agrega comentarios en orden y expone solo el nombre del autor', async () => {
    const { user } = await crearUsuario('turista', 'ana@correo.com')
    const { user: autor, token } = await crearUsuario('turista', 'beto@correo.com', 'Beto Ruiz')
    const post = await crearPost(user)

    const primero = await request(app)
      .post(`/api/posts/${post._id}/comentarios`)
      .set(auth(token))
      .send({ texto: '  Buen dato  ' })
    const segundo = await request(app)
      .post(`/api/posts/${post._id}/comentarios`)
      .set(auth(token))
      .send({ texto: 'Gracias' })
    expect(primero.status).toBe(201)
    expect(segundo.status).toBe(201)

    const comentarios = segundo.body.publicacion.comentarios
    expect(comentarios.map((c) => c.texto)).toEqual(['Buen dato', 'Gracias'])
    expect(comentarios[0].autor).toEqual({ _id: String(autor._id), nombre: 'Beto Ruiz' })
    expect(JSON.stringify(segundo.body)).not.toContain('beto@correo.com')
  })

  it.each([
    ['texto vacío', { texto: '' }],
    ['texto solo con espacios', { texto: '   ' }],
    ['texto de 301 caracteres', { texto: 'x'.repeat(301) }],
    ['cuerpo vacío', {}],
    ['campo extra', { texto: 'Hola', autor: ID_INEXISTENTE }],
  ])('responde 400 por %s', async (_caso, cuerpo) => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const post = await crearPost(user)
    const res = await request(app).post(`/api/posts/${post._id}/comentarios`).set(auth(token)).send(cuerpo)
    expect(res.status).toBe(400)
    expect((await Post.findById(post._id)).comentarios).toHaveLength(0)
  })

  it('permite hasta 100 comentarios y rechaza el siguiente con 409', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const post = await crearPost(user, {
      comentarios: Array.from({ length: 99 }, () => ({ autor: user._id, texto: 'Previo' })),
    })
    const ultimo = await request(app).post(`/api/posts/${post._id}/comentarios`).set(auth(token)).send({ texto: 'Número 100' })
    const excedido = await request(app).post(`/api/posts/${post._id}/comentarios`).set(auth(token)).send({ texto: 'Número 101' })
    expect(ultimo.status).toBe(201)
    expect(excedido.status).toBe(409)
    expect((await Post.findById(post._id)).comentarios).toHaveLength(100)
  })

  it('responde 404 en publicaciones inexistentes o retiradas', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const retirada = await crearPost(user, { activo: false })
    const inexistente = await request(app).post(`/api/posts/${ID_INEXISTENTE}/comentarios`).set(auth(token)).send({ texto: 'Hola' })
    const enRetirada = await request(app).post(`/api/posts/${retirada._id}/comentarios`).set(auth(token)).send({ texto: 'Hola' })
    expect(inexistente.status).toBe(404)
    expect(enRetirada.status).toBe(404)
  })

  it('exige sesión', async () => {
    const res = await request(app).post(`/api/posts/${ID_INEXISTENTE}/comentarios`).send({ texto: 'Hola' })
    expect(res.status).toBe(401)
  })
})

describe('HU-13 denuncias', () => {
  it('registra la denuncia con el motivo y el usuario', async () => {
    const { user } = await crearUsuario('turista', 'ana@correo.com')
    const { user: denunciante, token } = await crearUsuario('turista', 'otro@correo.com')
    const post = await crearPost(user)
    const res = await request(app)
      .post(`/api/posts/${post._id}/denuncias`)
      .set(auth(token))
      .send({ motivo: 'Contenido ofensivo' })
    expect(res.status).toBe(204)
    const guardada = await Post.findById(post._id)
    expect(guardada.denuncias).toHaveLength(1)
    expect(String(guardada.denuncias[0].usuario)).toBe(String(denunciante._id))
    expect(guardada.denuncias[0].motivo).toBe('Contenido ofensivo')
  })

  it('no permite denunciar dos veces la misma publicación', async () => {
    const { user } = await crearUsuario('turista', 'ana@correo.com')
    const { token } = await crearUsuario('turista', 'otro@correo.com')
    const post = await crearPost(user)
    const primera = await request(app).post(`/api/posts/${post._id}/denuncias`).set(auth(token)).send({ motivo: 'Spam' })
    const segunda = await request(app).post(`/api/posts/${post._id}/denuncias`).set(auth(token)).send({ motivo: 'Spam otra vez' })
    expect(primera.status).toBe(204)
    expect(segunda.status).toBe(409)
    expect((await Post.findById(post._id)).denuncias).toHaveLength(1)
  })

  it('cuenta una sola denuncia ante peticiones simultáneas del mismo usuario', async () => {
    const { user } = await crearUsuario('turista', 'ana@correo.com')
    const { token } = await crearUsuario('turista', 'otro@correo.com')
    const post = await crearPost(user)
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post(`/api/posts/${post._id}/denuncias`).set(auth(token)).send({ motivo: 'Spam' }),
      ),
    )
    const estados = respuestas.map((r) => r.status)
    expect(estados.filter((s) => s === 204)).toHaveLength(1)
    expect(estados.filter((s) => s === 409)).toHaveLength(4)
    expect((await Post.findById(post._id)).denuncias).toHaveLength(1)
  })

  it('no permite denunciar la propia publicación', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const post = await crearPost(user)
    const res = await request(app).post(`/api/posts/${post._id}/denuncias`).set(auth(token)).send({ motivo: 'Spam' })
    expect(res.status).toBe(403)
    expect((await Post.findById(post._id)).denuncias).toHaveLength(0)
  })

  it.each([
    ['motivo muy corto', { motivo: 'ab' }],
    ['motivo de 201 caracteres', { motivo: 'x'.repeat(201) }],
    ['cuerpo vacío', {}],
    ['campo extra', { motivo: 'Spam', usuario: ID_INEXISTENTE }],
  ])('responde 400 por %s', async (_caso, cuerpo) => {
    const { user } = await crearUsuario('turista', 'ana@correo.com')
    const { token } = await crearUsuario('turista', 'otro@correo.com')
    const post = await crearPost(user)
    const res = await request(app).post(`/api/posts/${post._id}/denuncias`).set(auth(token)).send(cuerpo)
    expect(res.status).toBe(400)
    expect((await Post.findById(post._id)).denuncias).toHaveLength(0)
  })

  it('responde 404 en publicaciones inexistentes o retiradas', async () => {
    const { user } = await crearUsuario('turista', 'ana@correo.com')
    const { token } = await crearUsuario('turista', 'otro@correo.com')
    const retirada = await crearPost(user, { activo: false })
    const inexistente = await request(app).post(`/api/posts/${ID_INEXISTENTE}/denuncias`).set(auth(token)).send({ motivo: 'Spam' })
    const enRetirada = await request(app).post(`/api/posts/${retirada._id}/denuncias`).set(auth(token)).send({ motivo: 'Spam' })
    expect(inexistente.status).toBe(404)
    expect(enRetirada.status).toBe(404)
  })
})

describe('HU-13 y HU-20 retiro de publicaciones', () => {
  it('el autor retira su publicación sin dejar auditoría de moderación', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const post = await crearPost(user)
    const res = await request(app).delete(`/api/posts/${post._id}`).set(auth(token))
    expect(res.status).toBe(204)

    const guardada = await Post.findById(post._id)
    expect(guardada.activo).toBe(false)
    expect(guardada.moderadoPor).toBeUndefined()
    expect(await AuditLog.countDocuments({ accion: 'post.desactivar' })).toBe(0)

    const feed = await request(app).get('/api/posts').set(auth(token))
    expect(feed.body.publicaciones).toHaveLength(0)
  })

  it.each(['gestor', 'admin'])('un %s retira una publicación ajena y queda auditado', async (rol) => {
    const { user: autor } = await crearUsuario('turista', 'ana@correo.com')
    const { user: moderador, token } = await crearUsuario(rol, `${rol}@correo.com`)
    const post = await crearPost(autor)
    const res = await request(app).delete(`/api/posts/${post._id}`).set(auth(token))
    expect(res.status).toBe(204)

    const guardada = await Post.findById(post._id)
    expect(guardada.activo).toBe(false)
    expect(String(guardada.moderadoPor)).toBe(String(moderador._id))
    expect(guardada.moderadoEn).toBeDefined()

    const auditoria = await AuditLog.findOne({ accion: 'post.desactivar' })
    expect(String(auditoria.actor)).toBe(String(moderador._id))
    expect(String(auditoria.objetivo)).toBe(String(autor._id))
    expect(auditoria.detalle).toEqual({ publicacion: String(post._id) })
  })

  it('un turista no puede retirar la publicación de otro', async () => {
    const { user: autor } = await crearUsuario('turista', 'ana@correo.com')
    const { token } = await crearUsuario('turista', 'otro@correo.com')
    const post = await crearPost(autor)
    const res = await request(app).delete(`/api/posts/${post._id}`).set(auth(token))
    expect(res.status).toBe(403)
    expect((await Post.findById(post._id)).activo).toBe(true)
  })

  it('responde 404 si la publicación ya fue retirada o no existe', async () => {
    const { user, token } = await crearUsuario('turista', 'ana@correo.com')
    const retirada = await crearPost(user, { activo: false })
    const yaRetirada = await request(app).delete(`/api/posts/${retirada._id}`).set(auth(token))
    const inexistente = await request(app).delete(`/api/posts/${ID_INEXISTENTE}`).set(auth(token))
    expect(yaRetirada.status).toBe(404)
    expect(inexistente.status).toBe(404)
  })

  it('responde 400 con un identificador inválido y 401 sin sesión', async () => {
    const { token } = await crearUsuario('turista', 'ana@correo.com')
    const invalido = await request(app).delete('/api/posts/no-es-un-id').set(auth(token))
    const sinSesion = await request(app).delete(`/api/posts/${ID_INEXISTENTE}`)
    expect(invalido.status).toBe(400)
    expect(sinSesion.status).toBe(401)
  })
})

describe('HU-13 moderación del feed', () => {
  it.each(['turista'])('rechaza a un %s con 403', async (rol) => {
    const { token } = await crearUsuario(rol, `${rol}@correo.com`)
    const res = await request(app).get('/api/posts/moderacion').set(auth(token))
    expect(res.status).toBe(403)
  })

  it('rechaza sin sesión con 401', async () => {
    const res = await request(app).get('/api/posts/moderacion')
    expect(res.status).toBe(401)
  })

  it('ordena por cantidad de denuncias e incluye el conteo', async () => {
    const { user: autor } = await crearUsuario('turista', 'ana@correo.com')
    const { user: a } = await crearUsuario('turista', 'a@correo.com')
    const { user: b } = await crearUsuario('turista', 'b@correo.com')
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    await crearPost(autor, { contenido: 'Sin denuncias' })
    await crearPost(autor, {
      contenido: 'Dos denuncias',
      denuncias: [
        { usuario: a._id, motivo: 'Spam' },
        { usuario: b._id, motivo: 'Ofensivo' },
      ],
    })
    await crearPost(autor, { contenido: 'Una denuncia', denuncias: [{ usuario: a._id, motivo: 'Spam' }] })
    await crearPost(autor, { contenido: 'Retirada', activo: false })

    const res = await request(app).get('/api/posts/moderacion').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.publicaciones.map((p) => [p.contenido, p.denuncias])).toEqual([
      ['Dos denuncias', 2],
      ['Una denuncia', 1],
      ['Sin denuncias', 0],
    ])
  })

  it('filtra por autor, zona y rango de fechas', async () => {
    const { user: ana } = await crearUsuario('turista', 'ana@correo.com')
    const { user: beto } = await crearUsuario('turista', 'beto@correo.com')
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const zona = await Zone.create({ nombre: 'Zona A', tipo: 'cultural', coordenadas: poligono })
    const deAna = await crearPost(ana, { contenido: 'De Ana', zona: zona._id })
    const deBeto = await crearPost(beto, { contenido: 'De Beto' })
    await fechar(deBeto, 3 * 24 * 60)

    const porAutor = await request(app).get('/api/posts/moderacion').query({ autor: String(ana._id) }).set(auth(token))
    const porZona = await request(app).get('/api/posts/moderacion').query({ zona: String(zona._id) }).set(auth(token))
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const recientes = await request(app).get('/api/posts/moderacion').query({ desde: ayer }).set(auth(token))
    const antiguas = await request(app).get('/api/posts/moderacion').query({ hasta: ayer }).set(auth(token))

    expect(porAutor.body.publicaciones.map((p) => p.contenido)).toEqual(['De Ana'])
    expect(porZona.body.publicaciones.map((p) => p.contenido)).toEqual([String(deAna.contenido)])
    expect(recientes.body.publicaciones.map((p) => p.contenido)).toEqual(['De Ana'])
    expect(antiguas.body.publicaciones.map((p) => p.contenido)).toEqual(['De Beto'])
  })

  it.each([
    ['fecha inválida', { desde: 'no-es-fecha' }],
    ['rango invertido', { desde: '2030-01-02T00:00:00Z', hasta: '2030-01-01T00:00:00Z' }],
    ['autor inválido', { autor: 'no-es-un-id' }],
    ['parámetro desconocido', { estado: 'activo' }],
  ])('responde 400 por %s', async (_caso, query) => {
    const { token } = await crearUsuario('gestor', 'gestor@correo.com')
    const res = await request(app).get('/api/posts/moderacion').query(query).set(auth(token))
    expect(res.status).toBe(400)
  })
})