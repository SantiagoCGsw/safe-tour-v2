import mongoose from 'mongoose'

const HORAS_DIA = 24

const configSchema = new mongoose.Schema(
  {
    clave: { type: String, default: 'global', unique: true, immutable: true },
    umbralAltoRiesgo: { type: Number, default: 5, min: 1, max: 1000 },
    vigenciaReporteHoras: { type: Number, default: 72, min: 1, max: HORAS_DIA * 30 },
    quorum: { type: Number, default: 3, min: 1, max: 1000 },
    plazoVotacionHoras: { type: Number, default: 24, min: 1, max: HORAS_DIA * 14 },
  },
  { timestamps: true, strict: true },
)

configSchema.statics.obtener = function obtener() {
  return this.findOneAndUpdate(
    { clave: 'global' },
    { $setOnInsert: { clave: 'global' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
}

configSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

export default mongoose.model('Config', configSchema)