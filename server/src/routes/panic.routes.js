import { Router } from 'express'
import { protect } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import {
  crearContactoSchema,
  contactoIdSchema,
  activarPanicoSchema,
} from '../schemas/panic.schema.js'
import {
  contactos,
  agregarContacto,
  quitarContacto,
  activar,
} from '../controllers/panic.controller.js'

const router = Router()

router.use(protect)

router.get('/contactos', contactos)
router.post('/contactos', validate(crearContactoSchema), agregarContacto)
router.delete('/contactos/:id', validate(contactoIdSchema), quitarContacto)
router.post('/activar', validate(activarPanicoSchema), activar)

export default router