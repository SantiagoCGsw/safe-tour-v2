import { Router } from 'express'
import { protect } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import { calcularRutaSchema } from '../schemas/zones.schema.js'
import { calcular } from '../controllers/routing.controller.js'

const router = Router()

router.post('/rutas', protect, validate(calcularRutaSchema), calcular)

export default router