// server/src/routes/posts.routes.js
import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import {
  listarPostsSchema,
  moderacionPostsSchema,
  crearPostSchema,
  postIdSchema,
  comentarSchema,
  denunciarSchema,
} from '../schemas/posts.schema.js'
import {
  listar,
  moderacion,
  crear,
  reaccionar,
  quitarMiReaccion,
  comentar,
  denunciar,
  retirar,
} from '../controllers/posts.controller.js'

const router = Router()

router.use(protect)

router.get('/', validate(listarPostsSchema), listar)
router.get('/moderacion', authorize('gestor', 'admin'), validate(moderacionPostsSchema), moderacion)
router.post('/', validate(crearPostSchema), crear)
router.post('/:id/reacciones', validate(postIdSchema), reaccionar)
router.delete('/:id/reacciones', validate(postIdSchema), quitarMiReaccion)
router.post('/:id/comentarios', validate(comentarSchema), comentar)
router.post('/:id/denuncias', validate(denunciarSchema), denunciar)
router.delete('/:id', validate(postIdSchema), retirar)

export default router