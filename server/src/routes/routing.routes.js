import { Router } from 'express'
import { protect } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import { limitadorDirecciones } from '../middlewares/rateLimit.middleware.js'
import { calcularRutaSchema, buscarDireccionSchema } from '../schemas/zones.schema.js'
import { calcular, direcciones } from '../controllers/routing.controller.js'

const router = Router()

router.post('/rutas', protect, validate(calcularRutaSchema), calcular)
router.get('/direcciones', protect, limitadorDirecciones, validate(buscarDireccionSchema), direcciones)

export default router
