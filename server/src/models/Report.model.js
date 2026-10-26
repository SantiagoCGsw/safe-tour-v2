import mongoose from 'mongoose'

export const TIPOS_REPORTE = Object.freeze(['accidente', 'robo', 'obra', 'peligro', 'turismo'])

export const ESTADOS_REPORTE = Object.freeze([
  'pendiente',
  'confirmado',
  'rechazado',
  'disputa',
  'publicado',
])

export const ESTADOS_MAPA = Object.freeze(['confirmado', 'publicado'])

export const ESTADOS_FEED = Object.freeze(['pendiente', 'disputa', 'confirmado', 'publicado'])

const reportSchema = new mongoose.Schema(
  {
    titulo: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    descripcion: { type: String, default: '', trim: true, maxlength: 1000 },
    tipo: { type: String, enum: TIPOS_REPORTE, required: true },
    ubicacion: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
      direccion: { type: String, default: '', trim: true, maxlength: 200 },
    },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    estado: { type: String, enum: ESTADOS_REPORTE, default: 'pendiente' },
    confirmaciones: { type: Number, default: 0, min: 0 },
    rechazos: { type: Number, default: 0, min: 0 },
    cierreVotacion: { type: Date },
    resueltoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resueltoEn: { type: Date },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true },
)

reportSchema.index({ activo: 1, estado: 1, createdAt: -1 })
reportSchema.index({ autor: 1, createdAt: -1 })

reportSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

export default mongoose.model('Report', reportSchema)