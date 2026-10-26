import { Router } from 'express'
import { validate } from '../middlewares/validate.middleware.js'
import { buscarSitiosSchema } from '../schemas/zones.schema.js'
import { buscar } from '../controllers/places.controller.js'

const router = Router()

router.get('/', validate(buscarSitiosSchema), buscar)

export default router