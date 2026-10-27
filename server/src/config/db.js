// server/src/config/db.js
import mongoose from 'mongoose'
import { env } from './env.js'

mongoose.set('sanitizeFilter', true)
mongoose.set('strictQuery', true)

export const URI_MEMORIA = 'memory'

let servidorMemoria = null

export const esModoMemoria = (uri = env.MONGODB_URI) => uri === URI_MEMORIA

const iniciarMemoria = async () => {
  if (env.NODE_ENV === 'production') {
    throw new Error('El modo en memoria no está permitido en producción')
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server')
  servidorMemoria = await MongoMemoryServer.create()
  return servidorMemoria.getUri()
}

export async function connectDB(uri = env.MONGODB_URI) {
  const destino = esModoMemoria(uri) ? await iniciarMemoria() : uri
  await mongoose.connect(destino, { serverSelectionTimeoutMS: 10000 })
  return mongoose.connection
}

export async function disconnectDB() {
  await mongoose.disconnect()
  if (servidorMemoria) {
    await servidorMemoria.stop()
    servidorMemoria = null
  }
}