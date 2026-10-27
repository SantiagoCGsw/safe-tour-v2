// server/src/app.js
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.js'
import { limitadorGlobal } from './middlewares/rateLimit.middleware.js'
import { notFound, errorHandler } from './middlewares/error.middleware.js'
import authRoutes from './routes/auth.routes.js'
import zonesRoutes from './routes/zones.routes.js'
import usersRoutes from './routes/users.routes.js'
import adminRoutes from './routes/admin.routes.js'
import reportsRoutes from './routes/reports.routes.js'
import placesRoutes from './routes/places.routes.js'
import votesRoutes from './routes/votes.routes.js'
import panicRoutes from './routes/panic.routes.js'
import routingRoutes from './routes/routing.routes.js'
import postsRoutes from './routes/posts.routes.js'
import chatbotRoutes from './routes/chatbot.routes.js'

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(helmet())
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || env.CORS_ORIGINS.includes(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
)

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use(limitadorGlobal)
app.use(express.json({ limit: '10kb' }))

app.use('/api/auth', authRoutes)
app.use('/api/zones', zonesRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/places', placesRoutes)
app.use('/api/votes', votesRoutes)
app.use('/api/panic', panicRoutes)
app.use('/api/routing', routingRoutes)
app.use('/api/posts', postsRoutes)
app.use('/api/chatbot', chatbotRoutes)

app.use(notFound)
app.use(errorHandler)

export default app