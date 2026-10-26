import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'

const valido = {
  nombre: 'Ana Pérez',
  email: 'ana@correo.com',
  password: 'Clave1234',
}

const registrar = (datos = valido) => request(app).post('/api/auth/register').send(datos)
const entrar = (datos) => request(app).post('/api/auth/login').send(datos)

beforeAll(async () => {
  await User.init()
})

describe('HU-01 registro', () => {
  it('crea un turista y devuelve token sin exponer la contraseña', async () => {
    const res = await registrar()
    expect(res.status).toBe(201)
    expect(typeof res.body.token).toBe('string')
    expect(res.body.user).toMatchObject({ nombre: 'Ana Pérez', email: 'ana@correo.com', rol: 'turista', activo: true })
    expect(res.body.user.password).toBeUndefined()
  })

  it('normaliza el correo a minúsculas', async () => {
    const res = await registrar({ ...valido, email: '  ANA@Correo.COM ' })
    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('ana@correo.com')
  })

  it('guarda la contraseña como hash bcrypt', async () => {
    await registrar()
    const guardado = await User.findOne({ email: valido.email }).select('+password')
    expect(guardado.password).not.toBe(valido.password)
    expect(guardado.password.startsWith('$2')).toBe(true)
  })

  it('rechaza un correo ya registrado con 409', async () => {
    await registrar()
    const res = await registrar()
    expect(res.status).toBe(409)
  })

  it('rechaza el mismo correo con distinta capitalización', async () => {
    await registrar()
    const res = await registrar({ ...valido, email: 'ANA@correo.com' })
    expect(res.status).toBe(409)
  })

  it.each([
    ['contraseña corta', { password: 'Ab1' }],
    ['contraseña sin números', { password: 'soloLetrasAqui' }],
    ['contraseña sin letras', { password: '1234567890' }],
    ['contraseña de más de 72 bytes', { password: 'a1'.repeat(40) }],
    ['correo inválido', { email: 'no-es-correo' }],
    ['nombre de un carácter', { nombre: 'A' }],
  ])('responde 400 por %s', async (_caso, cambio) => {
    const res = await registrar({ ...valido, ...cambio })
    expect(res.status).toBe(400)
    expect(await User.countDocuments()).toBe(0)
  })

  it.each(['nombre', 'email', 'password'])('responde 400 si falta %s', async (campo) => {
    const datos = { ...valido }
    delete datos[campo]
    const res = await registrar(datos)
    expect(res.status).toBe(400)
  })
})

describe('HU-01 inicio de sesión', () => {
  it('entrega token con credenciales correctas', async () => {
    await registrar()
    const res = await entrar({ email: valido.email, password: valido.password })
    expect(res.status).toBe(200)
    expect(typeof res.body.token).toBe('string')
    expect(res.body.user.email).toBe(valido.email)
    expect(res.body.user.password).toBeUndefined()
  })

  it('acepta el correo con otra capitalización', async () => {
    await registrar()
    const res = await entrar({ email: 'ANA@CORREO.COM', password: valido.password })
    expect(res.status).toBe(200)
  })

  it('responde igual con contraseña errónea y con correo inexistente', async () => {
    await registrar()
    const errada = await entrar({ email: valido.email, password: 'Otra12345' })
    const inexistente = await entrar({ email: 'nadie@correo.com', password: 'Otra12345' })
    expect(errada.status).toBe(401)
    expect(inexistente.status).toBe(401)
    expect(errada.body).toEqual({ message: 'Credenciales inválidas' })
    expect(inexistente.body).toEqual(errada.body)
  })

  it('responde 400 si faltan campos', async () => {
    const res = await entrar({ email: valido.email })
    expect(res.status).toBe(400)
  })
})

describe('HU-01 sesión y cierre', () => {
  it('GET /me devuelve el usuario autenticado', async () => {
    const { body } = await registrar()
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`)
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(valido.email)
    expect(res.body.user.password).toBeUndefined()
  })

  it('GET /me sin token responde 401', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('POST /logout responde 200 con token válido', async () => {
    const { body } = await registrar()
    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${body.token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ message: 'Sesión cerrada' })
  })

  it('POST /logout sin token responde 401', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(401)
  })
})