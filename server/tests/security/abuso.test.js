import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../src/app.js'

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