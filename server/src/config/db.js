import mongoose from 'mongoose'
import { env } from './env.js'

mongoose.set('sanitizeFilter', true)
mongoose.set('strictQuery', true)

export async function connectDB(uri = env.MONGODB_URI) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  return mongoose.connection
}

export async function disconnectDB() {
  await mongoose.disconnect()
}