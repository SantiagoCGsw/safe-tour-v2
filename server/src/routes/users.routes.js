import { Router } from 'express'
import { protect } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import { actualizarPerfilSchema } from '../schemas/users.schema.js'
import { verPerfil, editarPerfil } from '../controllers/users.controller.js'

const router = Router()

router.use(protect)

router.get('/perfil', verPerfil)
router.put('/perfil', validate(actualizarPerfilSchema), editarPerfil)

export default router