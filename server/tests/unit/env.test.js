import { describe, it, expect, afterEach, vi } from 'vitest'

const cargar = async (cambios = {}) => {
  vi.resetModules()
  for (const [clave, valor] of Object.entries(cambios)) vi.stubEnv(clave, valor)
  return import('../../src/config/env.js')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('validación de configuración al arrancar', () => {
  it('acepta una configuración válida', async () => {
    const { env } = await cargar()
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173'])
  })

  it('rechaza un JWT_SECRET corto', async () => {
    await expect(cargar({ JWT_SECRET: 'corta' })).rejects.toThrow('JWT_SECRET')
  })

  it('rechaza MONGODB_URI vacía', async () => {
    await expect(cargar({ MONGODB_URI: '' })).rejects.toThrow('MONGODB_URI')
  })

  it('rechaza comodines en CORS_ORIGINS', async () => {
    await expect(cargar({ CORS_ORIGINS: '*' })).rejects.toThrow('CORS_ORIGINS')
  })

  it('exige costo bcrypt de 12 o más fuera de pruebas', async () => {
    await expect(cargar({ NODE_ENV: 'production', BCRYPT_COST: '10' })).rejects.toThrow('BCRYPT_COST')
  })
})