import { Router } from 'express'
import { protect } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import { votarSchema, reporteVotoSchema } from '../schemas/votes.schema.js'
import { emitirVoto, miVoto, registro } from '../controllers/votes.controller.js'

const router = Router()

router.use(protect)

router.get('/registro/:reporteId', validate(reporteVotoSchema), registro)
router.get('/:reporteId/mio', validate(reporteVotoSchema), miVoto)
router.post('/:reporteId', validate(votarSchema), emitirVoto)

export default router