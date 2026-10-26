import { describe, it, expect } from 'vitest'
import { puntoEnPoligono, clasificarRiesgo } from '../../src/services/risk.service.js'

const triangulo = [
  { lat: 4.59, lng: -74.07 },
  { lat: 4.6, lng: -74.07 },
  { lat: 4.6, lng: -74.06 },
]

describe('puntoEnPoligono', () => {
  it('detecta un punto interior', () => {
    expect(puntoEnPoligono({ lat: 4.598, lng: -74.068 }, triangulo)).toBe(true)
  })

  it('descarta un punto exterior', () => {
    expect(puntoEnPoligono({ lat: 4.7, lng: -74.0 }, triangulo)).toBe(false)
  })

  it('descarta un punto del mismo cuadrante fuera del triángulo', () => {
    expect(puntoEnPoligono({ lat: 4.591, lng: -74.061 }, triangulo)).toBe(false)
  })
})

describe('clasificarRiesgo', () => {
  it.each([
    [0, 5, 'bajo'],
    [2, 5, 'bajo'],
    [3, 5, 'medio'],
    [4, 5, 'medio'],
    [5, 5, 'alto'],
    [9, 5, 'alto'],
    [0, 1, 'bajo'],
    [1, 1, 'alto'],
  ])('con %i reportes y umbral %i clasifica como %s', (conteo, umbral, esperado) => {
    expect(clasificarRiesgo(conteo, umbral)).toBe(esperado)
  })
})