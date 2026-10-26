import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'
import Zone from '../../src/models/Zone.model.js'
import AuditLog from '../../src/models/AuditLog.model.js'
import { signToken } from '../../src/utils/generateToken.js'

const poligono = [
  { lat: 4.59, lng: -74.07 },
  { lat: 4.6, lng: -74.07 },
  { lat: 4.6, lng: -74.06 },
]

const crearUsuario = async (rol, email, extra = {}) => {
  const user = await User.create({ nombre: 'Usuario Prueba', email, password: 'hash-no-usado', rol, ...extra })
  return { user, token: signToken(user._id) }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

const cuentaNueva = {
  nombre: 'Gestor Nuevo',
  email: 'gestor.nuevo@correo.com',
  password: 'Clave1234',
  rol: 'gestor',
}

beforeAll(async () => {
  await User.init()
  await AuditLog.init()
})

describe('HU-15 listado de usuarios', () => {
  it('lista todos los usuarios sin exponer contraseñas', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).get('/api/admin/users').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.usuarios).toHaveLength(2)
    for (const u of res.body.usuarios) {
      expect(u.password).toBeUndefined()
      expect(u).toHaveProperty('email')
      expect(u).toHaveProperty('rol')
      expect(u).toHaveProperty('activo')
    }
  })

  it('filtra por rol y por estado', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    await crearUsuario('turista', 'a@correo.com')
    await crearUsuario('turista', 'b@correo.com', { activo: false })
    const porRol = await request(app).get('/api/admin/users').query({ rol: 'turista' }).set(auth(token))
    const inactivos = await request(app).get('/api/admin/users').query({ activo: 'false' }).set(auth(token))
    expect(porRol.body.usuarios).toHaveLength(2)
    expect(inactivos.body.usuarios).toHaveLength(1)
    expect(inactivos.body.usuarios[0].email).toBe('b@correo.com')
  })

  it('rechaza filtros inválidos con 400', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const res = await request(app).get('/api/admin/users').query({ rol: 'superadmin' }).set(auth(token))
    expect(res.status).toBe(400)
  })
})

describe('HU-15 creación de cuentas privilegiadas', () => {
  it('permite al admin crear un gestor que luego inicia sesión', async () => {
    const { user: admin, token } = await crearUsuario('admin', 'admin@correo.com')
    const res = await request(app).post('/api/admin/users').set(auth(token)).send(cuentaNueva)
    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({ email: cuentaNueva.email, rol: 'gestor', activo: true })
    expect(res.body.user.password).toBeUndefined()

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: cuentaNueva.email, password: cuentaNueva.password })
    expect(login.status).toBe(200)
    expect(login.body.user.rol).toBe('gestor')

    const auditoria = await AuditLog.findOne({ accion: 'usuario.crear' })
    expect(String(auditoria.actor)).toBe(String(admin._id))
    expect(String(auditoria.objetivo)).toBe(res.body.user._id)
  })

  it('permite crear otro admin', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const res = await request(app)
      .post('/api/admin/users')
      .set(auth(token))
      .send({ ...cuentaNueva, rol: 'admin' })
    expect(res.status).toBe(201)
    expect(res.body.user.rol).toBe('admin')
  })

  it('rechaza un correo ya registrado con 409', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    await request(app).post('/api/admin/users').set(auth(token)).send(cuentaNueva)
    const res = await request(app).post('/api/admin/users').set(auth(token)).send(cuentaNueva)
    expect(res.status).toBe(409)
  })

  it.each([
    ['rol inexistente', { rol: 'superadmin' }],
    ['contraseña débil', { password: 'corta' }],
    ['campo extra', { activo: false }],
  ])('responde 400 por %s', async (_caso, cambio) => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const res = await request(app)
      .post('/api/admin/users')
      .set(auth(token))
      .send({ ...cuentaNueva, ...cambio })
    expect(res.status).toBe(400)
    expect(await User.countDocuments()).toBe(1)
  })
})

describe('HU-15 cambio de rol', () => {
  it('cambia el rol y deja registro de auditoría', async () => {
    const { user: admin, token } = await crearUsuario('admin', 'admin@correo.com')
    const { user: objetivo } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app)
      .patch(`/api/admin/users/${objetivo._id}/rol`)
      .set(auth(token))
      .send({ rol: 'gestor' })
    expect(res.status).toBe(200)
    expect(res.body.user.rol).toBe('gestor')

    const auditoria = await AuditLog.findOne({ accion: 'usuario.cambiar_rol' })
    expect(String(auditoria.actor)).toBe(String(admin._id))
    expect(String(auditoria.objetivo)).toBe(String(objetivo._id))
    expect(auditoria.detalle).toEqual({ de: 'turista', a: 'gestor' })
  })

  it('el nuevo rol rige de inmediato con el token anterior', async () => {
    const { token: tokenAdmin } = await crearUsuario('admin', 'admin@correo.com')
    const { user, token } = await crearUsuario('turista', 'turista@correo.com')
    const antes = await request(app).get('/api/admin/stats').set(auth(token))
    expect(antes.status).toBe(403)
    await request(app).patch(`/api/admin/users/${user._id}/rol`).set(auth(tokenAdmin)).send({ rol: 'admin' })
    const despues = await request(app).get('/api/admin/stats').set(auth(token))
    expect(despues.status).toBe(200)
  })

  it('el admin no puede cambiar su propio rol', async () => {
    const { user, token } = await crearUsuario('admin', 'admin@correo.com')
    const res = await request(app)
      .patch(`/api/admin/users/${user._id}/rol`)
      .set(auth(token))
      .send({ rol: 'turista' })
    expect(res.status).toBe(403)
    expect((await User.findById(user._id)).rol).toBe('admin')
    expect(await User.countDocuments({ rol: 'admin', activo: true })).toBe(1)
  })

  it.each([
    ['rol inexistente', { rol: 'superadmin' }],
    ['campo extra', { rol: 'gestor', activo: false }],
    ['cuerpo vacío', {}],
  ])('responde 400 por %s', async (_caso, cuerpo) => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const { user } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).patch(`/api/admin/users/${user._id}/rol`).set(auth(token)).send(cuerpo)
    expect(res.status).toBe(400)
    expect((await User.findById(user._id)).rol).toBe('turista')
  })

  it('responde 404 si el usuario no existe y 400 si el id es inválido', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const inexistente = await request(app)
      .patch('/api/admin/users/64b0c0c0c0c0c0c0c0c0c0c0/rol')
      .set(auth(token))
      .send({ rol: 'gestor' })
    const invalido = await request(app).patch('/api/admin/users/no-es-un-id/rol').set(auth(token)).send({ rol: 'gestor' })
    expect(inexistente.status).toBe(404)
    expect(invalido.status).toBe(400)
  })
})

describe('HU-15 activación y desactivación', () => {
  it('desactiva una cuenta y su token deja de servir al instante', async () => {
    const { user: admin, token: tokenAdmin } = await crearUsuario('admin', 'admin@correo.com')
    const { user, token } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app)
      .patch(`/api/admin/users/${user._id}/estado`)
      .set(auth(tokenAdmin))
      .send({ activo: false })
    expect(res.status).toBe(200)
    expect(res.body.user.activo).toBe(false)

    const sesion = await request(app).get('/api/auth/me').set(auth(token))
    expect(sesion.status).toBe(401)

    const auditoria = await AuditLog.findOne({ accion: 'usuario.desactivar' })
    expect(String(auditoria.actor)).toBe(String(admin._id))
  })

  it('reactiva una cuenta y registra la acción', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const { user } = await crearUsuario('turista', 'turista@correo.com', { activo: false })
    const res = await request(app).patch(`/api/admin/users/${user._id}/estado`).set(auth(token)).send({ activo: true })
    expect(res.status).toBe(200)
    expect(res.body.user.activo).toBe(true)
    expect(await AuditLog.countDocuments({ accion: 'usuario.activar' })).toBe(1)
  })

  it('el admin no puede desactivar su propia cuenta', async () => {
    const { user, token } = await crearUsuario('admin', 'admin@correo.com')
    const res = await request(app).patch(`/api/admin/users/${user._id}/estado`).set(auth(token)).send({ activo: false })
    expect(res.status).toBe(403)
    expect((await User.findById(user._id)).activo).toBe(true)
  })

  it('rechaza un valor no booleano con 400', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const { user } = await crearUsuario('turista', 'turista@correo.com')
    const res = await request(app).patch(`/api/admin/users/${user._id}/estado`).set(auth(token)).send({ activo: 'false' })
    expect(res.status).toBe(400)
  })
})

describe('HU-14 estadísticas', () => {
  it('devuelve totales de usuarios por rol y zonas por tipo', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    await crearUsuario('gestor', 'gestor@correo.com')
    await crearUsuario('turista', 'a@correo.com')
    await crearUsuario('turista', 'b@correo.com')
    await Zone.create([
      { nombre: 'Zona A', tipo: 'cultural', coordenadas: poligono },
      { nombre: 'Zona B', tipo: 'segura', coordenadas: poligono },
      { nombre: 'Zona C', tipo: 'segura', coordenadas: poligono, activo: false },
    ])
    const res = await request(app).get('/api/admin/stats').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.stats.usuarios).toEqual({
      total: 4,
      porRol: { turista: 2, gestor: 1, admin: 1 },
    })
    expect(res.body.stats.zonas.activas).toBe(2)
    expect(res.body.stats.zonas.porTipo).toEqual({ turistica: 0, cultural: 1, peligrosa: 0, segura: 1 })
  })

  it('filtra por rango de fechas', async () => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const futuro = await request(app).get('/api/admin/stats').query({ desde: manana }).set(auth(token))
    const pasado = await request(app).get('/api/admin/stats').query({ hasta: ayer }).set(auth(token))
    const incluido = await request(app).get('/api/admin/stats').query({ desde: ayer, hasta: manana }).set(auth(token))
    expect(futuro.body.stats.usuarios.total).toBe(0)
    expect(pasado.body.stats.usuarios.total).toBe(0)
    expect(incluido.body.stats.usuarios.total).toBe(1)
  })

  it.each([
    ['fecha inválida', { desde: 'no-es-fecha' }],
    ['rango invertido', { desde: '2030-01-02T00:00:00Z', hasta: '2030-01-01T00:00:00Z' }],
    ['parámetro desconocido', { limite: '5' }],
  ])('responde 400 por %s', async (_caso, query) => {
    const { token } = await crearUsuario('admin', 'admin@correo.com')
    const res = await request(app).get('/api/admin/stats').query(query).set(auth(token))
    expect(res.status).toBe(400)
  })
})