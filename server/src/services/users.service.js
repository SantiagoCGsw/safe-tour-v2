import User from '../models/User.model.js'
import EmergencyContact from '../models/EmergencyContact.model.js'
import { AppError } from '../middlewares/error.middleware.js'

const MAX_CONTACTOS = 5

export const actualizarPerfil = async (userId, cambios) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: cambios },
    { new: true, runValidators: true },
  )
  if (!user) throw new AppError(404, 'Usuario no encontrado')
  return user
}

export const listarContactos = (userId) =>
  EmergencyContact.find({ usuario: userId }).sort({ createdAt: 1 })

export const crearContacto = async (userId, datos) => {
  const total = await EmergencyContact.countDocuments({ usuario: userId })
  if (total >= MAX_CONTACTOS) {
    throw new AppError(409, 'Alcanzaste el máximo de contactos de emergencia')
  }
  return EmergencyContact.create({ ...datos, usuario: userId })
}

export const eliminarContacto = async (userId, id) => {
  const contacto = await EmergencyContact.findOneAndDelete({ _id: id, usuario: userId })
  if (!contacto) throw new AppError(404, 'Contacto no encontrado')
}