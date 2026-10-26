import { Router } from 'express'
import { validate } from '../middlewares/validate.middleware.js'
import { limitadorAuth } from '../middlewares/rateLimit.middleware.js'
import { protect } from '../middlewares/auth.middleware.js'
import { registerSchema, loginSchema } from '../schemas/auth.schema.js'
import { register, login, me, logout } from '../controllers/auth.controller.js'

const router = Router()

router.post('/register', limitadorAuth, validate(registerSchema), register)
router.post('/login', limitadorAuth, validate(loginSchema), login)
router.get('/me', protect, me)
router.post('/logout', protect, logout)

export default router