// server/src/routes/chatbot.routes.js
import { Router } from 'express'
import { z } from 'zod'
import { protect } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import { crearLimitador } from '../middlewares/rateLimit.middleware.js'
import { LONGITUD_MAXIMA } from '../services/chatbot/guardrails.js'
import { conversar } from '../controllers/chatbot.controller.js'

const mensajeSchema = {
  body: z.strictObject({
    mensaje: z.string().trim().min(1).max(LONGITUD_MAXIMA),
  }),
}

const limitadorChatbot = crearLimitador({ windowMs: 60 * 1000, limit: 20 })

const router = Router()

router.post('/mensajes', protect, limitadorChatbot, validate(mensajeSchema), conversar)

export default router