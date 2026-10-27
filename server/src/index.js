// server/src/index.js
import { randomBytes, randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import app from './app.js'
import { env } from './config/env.js'
import { connectDB, disconnectDB, esModoMemoria } from './config/db.js'
import User from './models/User.model.js'
import { crearZona } from './services/zones.service.js'
import { iniciarScheduler } from './services/scheduler.service.js'

const rectangulo = (sur, oeste, norte, este) => [
  { lat: sur, lng: oeste },
  { lat: sur, lng: este },
  { lat: norte, lng: este },
  { lat: norte, lng: oeste },
]

const AVISO_DEMO = 'Zona de demostración con límites aproximados. No refleja datos reales.'

const ZONAS_DEMO = [
  {
    nombre: 'La Candelaria',
    descripcion: `Centro histórico y cultural. ${AVISO_DEMO}`,
    tipo: 'cultural',
    nivelSeguridad: 3,
    coordenadas: rectangulo(4.5955, -74.0795, 4.6035, -74.0685),
  },
  {
    nombre: 'Monserrate',
    descripcion: `Cerro y santuario. ${AVISO_DEMO}`,
    tipo: 'turistica',
    nivelSeguridad: 4,
    coordenadas: rectangulo(4.6, -74.062, 4.611, -74.052),
  },
  {
    nombre: 'Chapinero',
    descripcion: `Zona comercial y de servicios. ${AVISO_DEMO}`,
    tipo: 'segura',
    nivelSeguridad: 4,
    coordenadas: rectangulo(4.638, -74.07, 4.658, -74.055),
  },
  {
    nombre: 'Usaquén',
    descripcion: `Plaza y mercado de pulgas. ${AVISO_DEMO}`,
    tipo: 'turistica',
    nivelSeguridad: 4,
    coordenadas: rectangulo(4.685, -74.045, 4.705, -74.025),
  },
]

const sembrarDemo = async () => {
  const clave = `Demo${randomInt(100000, 999999)}${randomBytes(4).toString('hex')}`
  const hash = await bcrypt.hash(clave, env.BCRYPT_COST)
  const admin = await User.create({
    nombre: 'Admin Demo',
    email: 'admin@safetour.demo',
    password: hash,
    rol: 'admin',
  })
  await User.create({
    nombre: 'Turista Demo',
    email: 'turista@safetour.demo',
    password: hash,
    rol: 'turista',
  })
  for (const zona of ZONAS_DEMO) await crearZona(zona, admin._id)

  console.log('Modo demostración: base de datos en memoria con datos de ejemplo. Se borra al detener el servidor.')
  console.log(`Usuarios de ejemplo: admin@safetour.demo y turista@safetour.demo | contraseña: ${clave}`)
}

try {
  await connectDB()
  if (esModoMemoria()) await sembrarDemo()
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