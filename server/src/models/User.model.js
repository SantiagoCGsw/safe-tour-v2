
import mongoose from 'mongoose'

export const ROLES = Object.freeze(['turista', 'gestor', 'admin'])

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const preferenciasAsistenteSchema = new mongoose.Schema(
  {
    intereses: {
      type: [
        {
          type: String,
          enum: [
            'naturaleza',
            'historia',
            'cultura',
            'gastronomia',
            'aventura',
            'arquitectura',
            'compras',
            'familia',
            'vida-nocturna',
          ],
        },
      ],
      default: [],
    },
    ritmo: {
      type: String,
      enum: ['tranquilo', 'equilibrado', 'intenso'],
      default: 'equilibrado',
    },
    presupuesto: {
      type: String,
      enum: ['economico', 'moderado', 'flexible'],
      default: 'moderado',
    },
    compania: {
      type: String,
      enum: ['indistinto', 'solo', 'pareja', 'familia', 'amigos'],
      default: 'indistinto',
    },
    accesibilidad: {
      type: Boolean,
      default: false,
    },
    evitarZonasRiesgosas: {
      type: Boolean,
      default: true,
    },
    lugaresTranquilos: {
      type: Boolean,
      default: false,
    },
    recomendacionesPersonalizadas: {
      type: Boolean,
      default: true,
    },
    notas: {
      type: String,
      trim: true,
      maxlength: 600,
      default: '',
    },
  },
  {
    _id: false,
  },
)

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: EMAIL_REGEX,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    rol: {
      type: String,
      enum: ROLES,
      default: 'turista',
    },
    fotoPerfil: {
      type: String,
      default: '',
      maxlength: 500,
    },
    preferenciasAsistente: {
      type: preferenciasAsistenteSchema,
      default: () => ({}),
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  },
)

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password
    delete ret.__v
    return ret
  },
})

export default mongoose.model('User', userSchema)
