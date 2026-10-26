import { listarContactos, crearContacto, eliminarContacto } from '../services/users.service.js'
import { activarPanico } from '../services/notify.service.js'

export const contactos = async (req, res) => {
  const lista = await listarContactos(req.user._id)
  res.json({ contactos: lista })
}

export const agregarContacto = async (req, res) => {
  const contacto = await crearContacto(req.user._id, req.body)
  res.status(201).json({ contacto })
}

export const quitarContacto = async (req, res) => {
  await eliminarContacto(req.user._id, req.valid.params.id)
  res.json({ message: 'Contacto eliminado' })
}

export const activar = async (req, res) => {
  const resultado = await activarPanico(req.user, req.body.ubicacion)
  res.json({ resultado })
}