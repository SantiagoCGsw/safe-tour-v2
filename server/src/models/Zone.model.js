import mongoose from 'mongoose'

export const TIPOS_ZONA = Object.freeze(['turistica', 'cultural', 'peligrosa', 'segura'])

const puntoSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
)

const zoneSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    descripcion: { type: String, default: '', trim: true, maxlength: 500 },
    tipo: { type: String, enum: TIPOS_ZONA, required: true },
    nivelSeguridad: { type: Number, min: 1, max: 5, default: 3 },
    coordenadas: {
      type: [puntoSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 3,
        message: 'El polígono requiere mínimo tres puntos',
      },
    },
    activo: { type: Boolean, default: true },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, strict: true },
)

zoneSchema.index({ activo: 1, tipo: 1 })

zoneSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

export default mongoose.model('Zone', zoneSchema)