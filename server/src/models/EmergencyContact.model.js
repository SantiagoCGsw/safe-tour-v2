import mongoose from 'mongoose'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TELEFONO_CO_REGEX = /^\+57\d{10}$/

const emergencyContactSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nombre: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254, match: EMAIL_REGEX },
    telefono: { type: String, trim: true, match: TELEFONO_CO_REGEX },
  },
  { timestamps: true, strict: true },
)

emergencyContactSchema.pre('validate', function exigirCanal() {
  if (!this.email && !this.telefono) {
    this.invalidate('email', 'Se requiere correo o teléfono')
  }
})

emergencyContactSchema.index({ usuario: 1, createdAt: 1 })

emergencyContactSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

export default mongoose.model('EmergencyContact', emergencyContactSchema)