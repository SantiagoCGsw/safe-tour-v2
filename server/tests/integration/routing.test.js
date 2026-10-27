// server/tests/integration/routing.test.js
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'
import User from '../../src/models/User.model.js'
import Zone from '../../src/models/Zone.model.js'
import Report from '../../src/models/Report.model.js'
import { signToken } from '../../src/utils/generateToken.js'

const CLAVE_ORS = 'clave-de-prueba-ors'

const origen = { lat: 4.6, lng: -74.08 }
const destino = { lat: 4.65, lng: -74.05 }

const poligono = [
  { lat: 4.59, lng: -74.07 },
  { lat: 4.6, lng: -74.07 },
  { lat: 4.6, lng: -74.06 },
]

const DENTRO = [4.597, -74.067]
const FUERA = [4.7, -74.0]

const solicitud = { origen, destino, modo: 'a-pie' }

const crearUsuario = async (email = 'ana@correo.com') => {
  const user = await User.create({ nombre: 'Usuario Prueba', email, password: 'hash-no-usado', rol: 'turista' })
  return { user, token: signToken(user._id) }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

const calcular = (token, cuerpo = solicitud) =>
  request(app).post('/api/routing/rutas').set(auth(token)).send(cuerpo)

const respuestaRuta = ({ distancia = 1234.6, duracion = 987.4, puntos = [FUERA, FUERA] } = {}) => ({
  ok: true,
  json: async () => ({
    features: [
      {
        properties: { summary: { distance: distancia, duration: duracion } },
        geometry: { coordinates: puntos.map(([lat, lng]) => [lng, lat]) },
      },
    ],
  }),
})

const respuestaFallida = { ok: false, json: async () => ({}) }

const cuerpoDeLlamada = (fetchMock, indice) => JSON.parse(fetchMock.mock.calls[indice][1].body)

let fetchMock

beforeAll(async () => {
  await User.init()
})

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('ORS_API_KEY', CLAVE_ORS)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('HU-06 rutas sin zonas de riesgo', () => {
  it('devuelve la ruta directa con el formato esperado', async () => {
    const { token } = await crearUsuario()
    fetchMock.mockResolvedValueOnce(respuestaRuta({ puntos: [[4.6, -74.08], [4.65, -74.05]] }))

    const res = await calcular(token)
    expect(res.status).toBe(200)
    expect(res.body.modo).toBe('a-pie')
    expect(res.body.aproximado).toBe(false)
    expect(res.body.rutas).toHaveLength(1)
    expect(res.body.rutas[0]).toEqual({
      nombre: 'Ruta directa',
      distanciaM: 1235,
      duracionS: 987,
      coordenadas: [
        { lat: 4.6, lng: -74.08 },
        { lat: 4.65, lng: -74.05 },
      ],
      puntosEnZonaDeRiesgo: 0,
      riesgo: 'bajo',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('envía a OpenRouteService las coordenadas como [lng, lat] y la clave en la cabecera', async () => {
    const { token } = await crearUsuario()
    fetchMock.mockResolvedValueOnce(respuestaRuta())
    await calcular(token)

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toContain('/foot-walking/geojson')
    expect(opciones.method).toBe('POST')
    expect(opciones.headers.Authorization).toBe(CLAVE_ORS)
    const cuerpo = cuerpoDeLlamada(fetchMock, 0)
    expect(cuerpo.coordinates).toEqual([
      [origen.lng, origen.lat],
      [destino.lng, destino.lat],
    ])
    expect(cuerpo.options).toBeUndefined()
  })

  it.each([
    ['a-pie', 'foot-walking', false],
    ['bicicleta', 'cycling-regular', false],
    ['vehiculo', 'driving-car', false],
    ['transporte-publico', 'driving-car', true],
  ])('usa el perfil correcto para %s', async (modo, perfil, aproximado) => {
    const { token } = await crearUsuario()
    fetchMock.mockResolvedValueOnce(respuestaRuta())
    const res = await calcular(token, { ...solicitud, modo })
    expect(res.status).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toContain(`/${perfil}/geojson`)
    expect(res.body.aproximado).toBe(aproximado)
  })

  it('no filtra la clave de la API en la respuesta', async () => {
    const { token } = await crearUsuario()
    fetchMock.mockResolvedValueOnce(respuestaRuta())
    const res = await calcular(token)
    expect(JSON.stringify(res.body)).not.toContain(CLAVE_ORS)
  })
})

describe('HU-06 rutas con zonas de riesgo', () => {
  it('pide una ruta alterna que evita la zona de nivel 1 de seguridad', async () => {
    const { token } = await crearUsuario()
    await Zone.create({ nombre: 'Zona crítica', tipo: 'peligrosa', nivelSeguridad: 1, coordenadas: poligono })
    fetchMock
      .mockResolvedValueOnce(respuestaRuta({ puntos: [DENTRO, DENTRO, DENTRO] }))
      .mockResolvedValueOnce(respuestaRuta({ distancia: 2000, puntos: [FUERA, FUERA] }))

    const res = await calcular(token)
    expect(res.status).toBe(200)
    expect(res.body.rutas.map((r) => r.nombre)).toEqual(['Ruta directa', 'Ruta evitando zonas de riesgo'])
    expect(res.body.rutas[0]).toMatchObject({ riesgo: 'alto', puntosEnZonaDeRiesgo: 3 })
    expect(res.body.rutas[1]).toMatchObject({ riesgo: 'bajo', puntosEnZonaDeRiesgo: 0, distanciaM: 2000 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(cuerpoDeLlamada(fetchMock, 0).options).toBeUndefined()
    const evitar = cuerpoDeLlamada(fetchMock, 1).options.avoid_polygons
    expect(evitar.type).toBe('MultiPolygon')
    expect(evitar.coordinates).toHaveLength(1)
    const anillo = evitar.coordinates[0][0]
    expect(anillo).toHaveLength(poligono.length + 1)
    expect(anillo[0]).toEqual(anillo[anillo.length - 1])
    expect(anillo[0]).toEqual([poligono[0].lng, poligono[0].lat])
  })

  it('clasifica como riesgo medio una ruta con menos del 15 % de puntos en la zona', async () => {
    const { token } = await crearUsuario()
    await Zone.create({ nombre: 'Zona crítica', tipo: 'peligrosa', nivelSeguridad: 1, coordenadas: poligono })
    const mayoriaFuera = [DENTRO, ...Array.from({ length: 9 }, () => FUERA)]
    fetchMock
      .mockResolvedValueOnce(respuestaRuta({ puntos: mayoriaFuera }))
      .mockResolvedValueOnce(respuestaRuta({ puntos: [FUERA, FUERA] }))

    const res = await calcular(token)
    expect(res.body.rutas[0]).toMatchObject({ riesgo: 'medio', puntosEnZonaDeRiesgo: 1 })
  })

  it('una zona pasa a alto riesgo cuando los reportes confirmados alcanzan el umbral', async () => {
    const { user, token } = await crearUsuario()
    await Zone.create({ nombre: 'Zona A', tipo: 'cultural', nivelSeguridad: 3, coordenadas: poligono })
    await Report.insertMany(
      Array.from({ length: 5 }, () => ({
        titulo: 'Hurto de celular',
        tipo: 'robo',
        ubicacion: { lat: 4.598, lng: -74.068 },
        autor: user._id,
        estado: 'publicado',
      })),
    )
    fetchMock
      .mockResolvedValueOnce(respuestaRuta({ puntos: [DENTRO, DENTRO] }))
      .mockResolvedValueOnce(respuestaRuta({ puntos: [FUERA, FUERA] }))

    const res = await calcular(token)
    expect(res.body.rutas).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('los reportes pendientes no cuentan como riesgo', async () => {
    const { user, token } = await crearUsuario()
    await Zone.create({ nombre: 'Zona A', tipo: 'cultural', nivelSeguridad: 3, coordenadas: poligono })
    await Report.insertMany(
      Array.from({ length: 5 }, () => ({
        titulo: 'Hurto de celular',
        tipo: 'robo',
        ubicacion: { lat: 4.598, lng: -74.068 },
        autor: user._id,
        estado: 'pendiente',
      })),
    )
    fetchMock.mockResolvedValueOnce(respuestaRuta({ puntos: [DENTRO, DENTRO] }))

    const res = await calcular(token)
    expect(res.body.rutas).toHaveLength(1)
    expect(res.body.rutas[0].riesgo).toBe('bajo')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('las zonas desactivadas no se evitan', async () => {
    const { token } = await crearUsuario()
    await Zone.create({
      nombre: 'Zona vieja',
      tipo: 'peligrosa',
      nivelSeguridad: 1,
      coordenadas: poligono,
      activo: false,
    })
    fetchMock.mockResolvedValueOnce(respuestaRuta())
    const res = await calcular(token)
    expect(res.body.rutas).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('devuelve solo la ruta directa si falla el cálculo de la alterna', async () => {
    const { token } = await crearUsuario()
    await Zone.create({ nombre: 'Zona crítica', tipo: 'peligrosa', nivelSeguridad: 1, coordenadas: poligono })
    fetchMock
      .mockResolvedValueOnce(respuestaRuta({ puntos: [DENTRO, DENTRO] }))
      .mockResolvedValueOnce(respuestaFallida)

    const res = await calcular(token)
    expect(res.status).toBe(200)
    expect(res.body.rutas).toHaveLength(1)
    expect(res.body.rutas[0].nombre).toBe('Ruta directa')
  })
})

describe('HU-06 fallos del servicio de rutas', () => {
  it('responde 503 si no hay clave configurada y no llama al proveedor', async () => {
    const { token } = await crearUsuario()
    vi.stubEnv('ORS_API_KEY', '')
    const res = await calcular(token)
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ message: 'Servicio de rutas no configurado' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['el proveedor responde con error', () => fetchMock.mockResolvedValueOnce(respuestaFallida)],
    ['falla la red', () => fetchMock.mockRejectedValueOnce(new Error('sin red'))],
    [
      'la respuesta no trae rutas',
      () => fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ features: [] }) }),
    ],
  ])('responde 502 genérico cuando %s', async (_caso, preparar) => {
    const { token } = await crearUsuario()
    preparar()
    const res = await calcular(token)
    expect(res.status).toBe(502)
    expect(res.body).toEqual({ message: 'No se pudo calcular la ruta' })
  })
})

describe('HU-06 validación y acceso', () => {
  it('exige sesión', async () => {
    const res = await request(app).post('/api/routing/rutas').send(solicitud)
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['modo inexistente', { ...solicitud, modo: 'cohete' }],
    ['sin destino', { origen, modo: 'a-pie' }],
    ['sin origen', { destino, modo: 'a-pie' }],
    ['sin modo', { origen, destino }],
    ['latitud fuera de rango', { ...solicitud, origen: { lat: 120, lng: -74 } }],
    ['longitud fuera de rango', { ...solicitud, destino: { lat: 4, lng: -200 } }],
    ['coordenadas como texto', { ...solicitud, origen: { lat: '4.6', lng: '-74.08' } }],
    ['campo extra', { ...solicitud, evitar: 'todo' }],
    ['punto con campo extra', { ...solicitud, origen: { ...origen, alt: 2600 } }],
  ])('responde 400 por %s y no llama al proveedor', async (_caso, cuerpo) => {
    const { token } = await crearUsuario()
    const res = await calcular(token, cuerpo)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})