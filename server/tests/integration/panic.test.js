// server/tests/integration/panic.test.js
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'
import EmergencyContact from '../../src/models/EmergencyContact.model.js'
import AuditLog from '../../src/models/AuditLog.model.js'
import { registrarCanal } from '../../src/services/notify.service.js'
import { signToken } from '../../src/utils/generateToken.js'

const ID_INEXISTENTE = '64b0c0c0c0c0c0c0c0c0c0c0'
const UBICACION = { lat: 4.598, lng: -74.068 }

const crearUsuario = async (email, nombre = 'Usuario Prueba') => {
  const user = await User.create({ nombre, email, password: 'hash-no-usado', rol: 'turista' })
  return { user, token: signToken(user._id) }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

const agregarContacto = (token, datos) =>
  request(app).post('/api/panic/contactos').set(auth(token)).send(datos)

const activar = (token, cuerpo = { confirmado: true, ubicacion: UBICACION }) =>
  request(app).post('/api/panic/activar').set(auth(token)).send(cuerpo)

beforeAll(async () => {
  await User.init()
  await AuditLog.init()
})

describe('HU-07 contactos de emergencia', () => {
  it('registra un contacto con correo y otro con teléfono', async () => {
    const { token } = await crearUsuario('ana@correo.com')
    const porCorreo = await agregarContacto(token, { nombre: 'Mamá', email: 'Mama@Correo.com' })
    const porTelefono = await agregarContacto(token, { nombre: 'Papá', telefono: '+573001234567' })
    expect(porCorreo.status).toBe(201)
    expect(porCorreo.body.contacto).toMatchObject({ nombre: 'Mamá', email: 'mama@correo.com' })
    expect(porTelefono.status).toBe(201)
    expect(porTelefono.body.contacto.telefono).toBe('+573001234567')

    const lista = await request(app).get('/api/panic/contactos').set(auth(token))
    expect(lista.status).toBe(200)
    expect(lista.body.contactos.map((c) => c.nombre)).toEqual(['Mamá', 'Papá'])
  })

  it.each([
    ['sin correo ni teléfono', { nombre: 'Mamá' }],
    ['nombre muy corto', { nombre: 'M', email: 'mama@correo.com' }],
    ['correo inválido', { nombre: 'Mamá', email: 'no-es-correo' }],
    ['teléfono sin prefijo +57', { nombre: 'Mamá', telefono: '3001234567' }],
    ['teléfono con dígitos de más', { nombre: 'Mamá', telefono: '+5730012345678' }],
    ['campo extra', { nombre: 'Mamá', email: 'mama@correo.com', usuario: ID_INEXISTENTE }],
  ])('responde 400 por %s', async (_caso, cuerpo) => {
    const { token } = await crearUsuario('ana@correo.com')
    const res = await agregarContacto(token, cuerpo)
    expect(res.status).toBe(400)
    expect(await EmergencyContact.countDocuments()).toBe(0)
  })

  it('permite como máximo 5 contactos por usuario', async () => {
    const { token } = await crearUsuario('ana@correo.com')
    for (let i = 1; i <= 5; i += 1) {
      const res = await agregarContacto(token, { nombre: `Contacto ${i}`, email: `c${i}@correo.com` })
      expect(res.status).toBe(201)
    }
    const sexto = await agregarContacto(token, { nombre: 'Contacto 6', email: 'c6@correo.com' })
    expect(sexto.status).toBe(409)
    expect(await EmergencyContact.countDocuments()).toBe(5)
  })

  it('cada usuario ve solo sus propios contactos', async () => {
    const a = await crearUsuario('a@correo.com')
    const b = await crearUsuario('b@correo.com')
    await agregarContacto(a.token, { nombre: 'Contacto de A', email: 'ca@correo.com' })
    await agregarContacto(b.token, { nombre: 'Contacto de B', email: 'cb@correo.com' })
    const deA = await request(app).get('/api/panic/contactos').set(auth(a.token))
    expect(deA.body.contactos.map((c) => c.nombre)).toEqual(['Contacto de A'])
  })

  it('elimina un contacto propio', async () => {
    const { token } = await crearUsuario('ana@correo.com')
    const creado = await agregarContacto(token, { nombre: 'Mamá', email: 'mama@correo.com' })
    const res = await request(app).delete(`/api/panic/contactos/${creado.body.contacto._id}`).set(auth(token))
    expect(res.status).toBe(200)
    expect(await EmergencyContact.countDocuments()).toBe(0)
  })

  it('no permite eliminar el contacto de otro usuario', async () => {
    const a = await crearUsuario('a@correo.com')
    const b = await crearUsuario('b@correo.com')
    const creado = await agregarContacto(a.token, { nombre: 'Mamá', email: 'mama@correo.com' })
    const res = await request(app).delete(`/api/panic/contactos/${creado.body.contacto._id}`).set(auth(b.token))
    expect(res.status).toBe(404)
    expect(await EmergencyContact.countDocuments()).toBe(1)
  })

  it('responde 404 si el contacto no existe y 400 si el id es inválido', async () => {
    const { token } = await crearUsuario('ana@correo.com')
    const inexistente = await request(app).delete(`/api/panic/contactos/${ID_INEXISTENTE}`).set(auth(token))
    const invalido = await request(app).delete('/api/panic/contactos/no-es-un-id').set(auth(token))
    expect(inexistente.status).toBe(404)
    expect(invalido.status).toBe(400)
  })

  it('exige sesión en todas las rutas', async () => {
    const lista = await request(app).get('/api/panic/contactos')
    const crear = await request(app).post('/api/panic/contactos').send({ nombre: 'Mamá', email: 'mama@correo.com' })
    const borrar = await request(app).delete(`/api/panic/contactos/${ID_INEXISTENTE}`)
    const activarSinSesion = await request(app).post('/api/panic/activar').send({ confirmado: true, ubicacion: UBICACION })
    expect([lista.status, crear.status, borrar.status, activarSinSesion.status]).toEqual([401, 401, 401, 401])
  })
})

// Los canales de entrega se registran en memoria y no se pueden quitar.
// Por eso este bloque va antes que el que registra canales.
describe('HU-07 botón de pánico sin canal de entrega configurado', () => {
  it('exige la confirmación explícita (segundo paso)', async () => {
    const { token } = await crearUsuario('ana@correo.com')
    await agregarContacto(token, { nombre: 'Mamá', email: 'mama@correo.com' })
    const sinConfirmar = await activar(token, { confirmado: false, ubicacion: UBICACION })
    const sinCampo = await activar(token, { ubicacion: UBICACION })
    const comoTexto = await activar(token, { confirmado: 'true', ubicacion: UBICACION })
    expect([sinConfirmar.status, sinCampo.status, comoTexto.status]).toEqual([400, 400, 400])
    expect(await AuditLog.countDocuments({ accion: 'panico.activar' })).toBe(0)
  })

  it.each([
    ['sin ubicación', { confirmado: true }],
    ['latitud fuera de rango', { confirmado: true, ubicacion: { lat: 91, lng: -74 } }],
    ['longitud fuera de rango', { confirmado: true, ubicacion: { lat: 4, lng: -181 } }],
    ['ubicación con texto', { confirmado: true, ubicacion: { lat: '4.5', lng: -74 } }],
    ['campo extra', { confirmado: true, ubicacion: UBICACION, contactos: ['x'] }],
  ])('responde 400 por %s', async (_caso, cuerpo) => {
    const { token } = await crearUsuario('ana@correo.com')
    await agregarContacto(token, { nombre: 'Mamá', email: 'mama@correo.com' })
    const res = await activar(token, cuerpo)
    expect(res.status).toBe(400)
    expect(await AuditLog.countDocuments({ accion: 'panico.activar' })).toBe(0)
  })

  it('responde 409 si el usuario no tiene contactos registrados', async () => {
    const { token } = await crearUsuario('ana@correo.com')
    const res = await activar(token)
    expect(res.status).toBe(409)
    expect(await AuditLog.countDocuments({ accion: 'panico.activar' })).toBe(0)
  })

  it('informa que no hay entregas cuando no hay canal configurado', async () => {
    const { token } = await crearUsuario('ana@correo.com')
    await agregarContacto(token, { nombre: 'Mamá', email: 'mama@correo.com' })
    await agregarContacto(token, { nombre: 'Papá', telefono: '+573001234567' })
    const res = await activar(token)
    expect(res.status).toBe(200)
    expect(res.body.resultado).toEqual({ contactos: 2, entregados: 0, canalesConfigurados: 0 })
    expect(await AuditLog.countDocuments({ accion: 'panico.activar' })).toBe(1)
  })
})

describe('HU-07 botón de pánico con canales de entrega', () => {
  const enviados = []

  beforeAll(() => {
    registrarCanal({
      enviar: async (contacto, mensaje) => {
        enviados.push({ contacto, mensaje })
        return true
      },
    })
    registrarCanal({
      enviar: async () => {
        throw new Error('canal caído')
      },
    })
    registrarCanal({ enviar: async () => false })
  })

  beforeEach(() => {
    enviados.length = 0
  })

  it('entrega a cada contacto aunque un canal falle o no entregue', async () => {
    const { token } = await crearUsuario('ana@correo.com')
    await agregarContacto(token, { nombre: 'Mamá', email: 'mama@correo.com' })
    await agregarContacto(token, { nombre: 'Papá', telefono: '+573001234567' })
    const res = await activar(token)
    expect(res.status).toBe(200)
    expect(res.body.resultado).toEqual({ contactos: 2, entregados: 2, canalesConfigurados: 3 })
    expect(enviados).toHaveLength(2)
  })

  it('el mensaje incluye el nombre del usuario y un enlace con su ubicación', async () => {
    const { token } = await crearUsuario('ana@correo.com', 'Ana Torres')
    await agregarContacto(token, { nombre: 'Mamá', email: 'mama@correo.com' })
    await activar(token)
    expect(enviados[0].mensaje).toBe(
      'Alerta de pánico de Ana Torres. Ubicación: https://www.google.com/maps?q=4.598,-74.068',
    )
  })

  it('solo notifica a los contactos del usuario que activa la alerta', async () => {
    const a = await crearUsuario('a@correo.com')
    const b = await crearUsuario('b@correo.com')
    await agregarContacto(a.token, { nombre: 'Contacto de A', email: 'ca@correo.com' })
    await agregarContacto(b.token, { nombre: 'Contacto de B', email: 'cb@correo.com' })
    await activar(a.token)
    expect(enviados).toHaveLength(1)
    expect(enviados[0].contacto.nombre).toBe('Contacto de A')
    expect(String(enviados[0].contacto.usuario)).toBe(String(a.user._id))
  })

  it('audita la activación sin guardar datos personales de los contactos', async () => {
    const { user, token } = await crearUsuario('ana@correo.com')
    await agregarContacto(token, { nombre: 'Mamá', email: 'mama@correo.com' })
    await activar(token)
    const auditoria = await AuditLog.findOne({ accion: 'panico.activar' })
    expect(String(auditoria.actor)).toBe(String(user._id))
    expect(auditoria.detalle).toEqual({ contactos: 1, entregados: 1 })
    expect(JSON.stringify(auditoria)).not.toContain('mama@correo.com')
  })

  it('limita a 3 alertas por hora y no registra la cuarta', async () => {
    const { token } = await crearUsuario('ana@correo.com')
    await agregarContacto(token, { nombre: 'Mamá', email: 'mama@correo.com' })
    for (let i = 0; i < 3; i += 1) {
      const res = await activar(token)
      expect(res.status).toBe(200)
    }
    enviados.length = 0
    const cuarta = await activar(token)
    expect(cuarta.status).toBe(429)
    expect(enviados).toHaveLength(0)
    expect(await AuditLog.countDocuments({ accion: 'panico.activar' })).toBe(3)
  })

  it('el límite es por usuario', async () => {
    const a = await crearUsuario('a@correo.com')
    const b = await crearUsuario('b@correo.com')
    await agregarContacto(a.token, { nombre: 'Contacto de A', email: 'ca@correo.com' })
    await agregarContacto(b.token, { nombre: 'Contacto de B', email: 'cb@correo.com' })
    for (let i = 0; i < 3; i += 1) await activar(a.token)
    const deA = await activar(a.token)
    const deB = await activar(b.token)
    expect(deA.status).toBe(429)
    expect(deB.status).toBe(200)
  })

  it('no cuenta las alertas de hace más de una hora', async () => {
    const { user, token } = await crearUsuario('ana@correo.com')
    await agregarContacto(token, { nombre: 'Mamá', email: 'mama@correo.com' })
    await AuditLog.insertMany(
      Array.from({ length: 3 }, () => ({ actor: user._id, accion: 'panico.activar' })),
    )
    await AuditLog.updateMany({}, { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, { timestamps: false })
    const res = await activar(token)
    expect(res.status).toBe(200)
  })
})