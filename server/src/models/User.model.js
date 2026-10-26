import mongoose from 'mongoose'

export const ROLES = Object.freeze(['turista', 'gestor', 'admin'])

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const userSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: EMAIL_REGEX,
    },
    password: { type: String, required: true, select: false },
    rol: { type: String, enum: ROLES, default: 'turista' },
    fotoPerfil: { type: String, default: '', maxlength: 500 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true },
)

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password
    delete ret.__v
    return ret
  },
})

export default mongoose.model('User', userSchema)