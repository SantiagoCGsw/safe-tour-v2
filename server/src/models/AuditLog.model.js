import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    accion: { type: String, required: true, maxlength: 60 },
    objetivo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    detalle: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
)

auditLogSchema.index({ actor: 1, createdAt: -1 })
auditLogSchema.index({ objetivo: 1, createdAt: -1 })

export default mongoose.model('AuditLog', auditLogSchema)