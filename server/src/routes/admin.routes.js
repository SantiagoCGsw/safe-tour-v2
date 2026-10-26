import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import { crearCuentaSchema } from '../schemas/auth.schema.js'
import {
  listarUsuariosSchema,
  cambiarRolSchema,
  cambiarEstadoSchema,
  estadisticasSchema,
  actualizarConfigSchema,
} from '../schemas/admin.schema.js'
import {
  estadisticas,
  listar,
  crear,
  actualizarRol,
  actualizarEstado,
  verConfig,
  editarConfig,
} from '../controllers/admin.controller.js'

const router = Router()

router.use(protect, authorize('admin'))

router.get('/stats', validate(estadisticasSchema), estadisticas)
router.get('/users', validate(listarUsuariosSchema), listar)
router.post('/users', validate(crearCuentaSchema), crear)
router.patch('/users/:id/rol', validate(cambiarRolSchema), actualizarRol)
router.patch('/users/:id/estado', validate(cambiarEstadoSchema), actualizarEstado)
router.get('/config', verConfig)
router.put('/config', validate(actualizarConfigSchema), editarConfig)

export default router