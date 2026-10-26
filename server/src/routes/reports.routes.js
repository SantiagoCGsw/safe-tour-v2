import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import {
  crearReporteSchema,
  listarReportesSchema,
  resolverDisputaSchema,
} from '../schemas/reports.schema.js'
import {
  crear,
  listar,
  mios,
  mapaCalor,
  disputas,
  resolver,
} from '../controllers/reports.controller.js'

const router = Router()

router.use(protect)

router.get('/', validate(listarReportesSchema), listar)
router.get('/mios', mios)
router.get('/mapa-calor', mapaCalor)
router.get('/disputas', authorize('gestor', 'admin'), disputas)
router.post('/', validate(crearReporteSchema), crear)
router.patch(
  '/:id/resolver',
  authorize('gestor', 'admin'),
  validate(resolverDisputaSchema),
  resolver,
)

export default router