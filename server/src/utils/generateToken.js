import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

const ALGORITMO = 'HS256'
const DURACION = '24h'

export const signToken = (userId) =>
  jwt.sign({ id: String(userId) }, env.JWT_SECRET, {
    algorithm: ALGORITMO,
    expiresIn: DURACION,
  })

export const verifyToken = (token) =>
  jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITMO] })