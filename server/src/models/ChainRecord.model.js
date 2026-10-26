import mongoose from 'mongoose'

export const DECISIONES_REGISTRO = Object.freeze(['confirmado', 'rechazado', 'disputa'])
export const ESTADOS_ANCLAJE = Object.freeze(['pendiente', 'anclado', 'error'])

const chainRecordSchema = new mongoose.Schema(
  {
    reporte: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true, unique: true },
    decision: { type: String, enum: DECISIONES_REGISTRO, required: true },
    confirmaciones: { type: Number, required: true, min: 0 },
    rechazos: { type: Number, required: true, min: 0 },
    fecha: { type: Date, required: true },
    hashVotos: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    hashRegistro: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    estado: { type: String, enum: ESTADOS_ANCLAJE, default: 'pendiente' },
    red: { type: String, default: '' },
    txHash: { type: String, default: '' },
    ancladoEn: { type: Date },
  },
  { timestamps: true, strict: true },
)

chainRecordSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

export default mongoose.model('ChainRecord', chainRecordSchema)