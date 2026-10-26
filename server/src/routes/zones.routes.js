import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import {
  crearZonaSchema,
  actualizarZonaSchema,
  zonaIdSchema,
  listarZonasSchema,
} from '../schemas/zones.schema.js'
import {
  listar,
  obtener,
  crear,
  actualizar,
  desactivar,
} from '../controllers/zones.controller.js'

const router = Router()

router.get('/', validate(listarZonasSchema), listar)
router.get('/:id', validate(zonaIdSchema), obtener)

router.post('/', protect, authorize('gestor', 'admin'), validate(crearZonaSchema), crear)
router.put('/:id', protect, authorize('gestor', 'admin'), validate(actualizarZonaSchema), actualizar)
router.delete('/:id', protect, authorize('gestor', 'admin'), validate(zonaIdSchema), desactivar)

export default router