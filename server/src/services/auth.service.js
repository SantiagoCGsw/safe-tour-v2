import bcrypt from 'bcryptjs'
import User from '../models/User.model.js'
import { env } from '../config/env.js'
import { AppError } from '../middlewares/error.middleware.js'
import { signToken } from '../utils/generateToken.js'

const CREDENCIALES_INVALIDAS = 'Credenciales inválidas'

let hashFalso
const obtenerHashFalso = async () => {
  hashFalso ??= await bcrypt.hash('contrasena-inexistente', env.BCRYPT_COST)
  return hashFalso
}

export const registrarTurista = async ({ nombre, email, password }) => {
  const hash = await bcrypt.hash(password, env.BCRYPT_COST)
  const user = await User.create({ nombre, email, password: hash, rol: 'turista' })
  return { user, token: signToken(user._id) }
}

export const iniciarSesion = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password')
  const hash = user ? user.password : await obtenerHashFalso()
  const coincide = await bcrypt.compare(password, hash)

  if (!user || !coincide || !user.activo) {
    throw new AppError(401, CREDENCIALES_INVALIDAS)
  }
  return { user, token: signToken(user._id) }
}