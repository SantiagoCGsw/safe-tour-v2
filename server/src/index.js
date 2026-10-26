import app from './app.js'
import { env } from './config/env.js'
import { connectDB, disconnectDB } from './config/db.js'
import { iniciarScheduler } from './services/scheduler.service.js'

try {
  await connectDB()
} catch (err) {
  console.error(`No se pudo conectar a MongoDB (${err.name})`)
  process.exit(1)
}

const detenerScheduler = iniciarScheduler()

const servidor = app.listen(env.PORT, () => {
  console.log(`API escuchando en el puerto ${env.PORT}`)
})

const cerrar = () => {
  detenerScheduler()
  servidor.close(async () => {
    await disconnectDB()
    process.exit(0)
  })
}

process.on('SIGTERM', cerrar)
process.on('SIGINT', cerrar)