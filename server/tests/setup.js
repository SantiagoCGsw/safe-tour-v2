import { beforeAll, afterEach, afterAll } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'secreto-de-prueba-'.repeat(3)
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/safe-tour-test'
process.env.CORS_ORIGINS = 'http://localhost:5173'
process.env.BCRYPT_COST = '4'
process.env.RATE_LIMIT_GLOBAL_MAX = '100000'
process.env.RATE_LIMIT_AUTH_MAX = '100000'

let mongod

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  const { connectDB } = await import('../src/config/db.js')
  await connectDB(mongod.getUri())
})

afterEach(async () => {
  const { collections } = mongoose.connection
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})))
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod?.stop()
})