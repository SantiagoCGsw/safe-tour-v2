// server/src/models/Post.model.js
import mongoose from 'mongoose'

const comentarioSchema = new mongoose.Schema(
  {
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    texto: { type: String, required: true, trim: true, minlength: 1, maxlength: 300 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

const denunciaSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    motivo: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: false },
)

const postSchema = new mongoose.Schema(
  {
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contenido: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    zona: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
    reacciones: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    comentarios: { type: [comentarioSchema], default: [] },
    denuncias: { type: [denunciaSchema], default: [] },
    activo: { type: Boolean, default: true },
    moderadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderadoEn: { type: Date },
  },
  { timestamps: true, strict: true },
)

postSchema.index({ activo: 1, createdAt: -1 })
postSchema.index({ zona: 1, activo: 1, createdAt: -1 })
postSchema.index({ autor: 1, createdAt: -1 })

postSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

export default mongoose.model('Post', postSchema)