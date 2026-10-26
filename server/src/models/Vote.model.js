import mongoose from 'mongoose'

export const VOTOS = Object.freeze(['confirmar', 'rechazar'])

const voteSchema = new mongoose.Schema(
  {
    reporte: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    voto: { type: String, enum: VOTOS, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
)

voteSchema.index({ reporte: 1, usuario: 1 }, { unique: true })

voteSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

export default mongoose.model('Vote', voteSchema)