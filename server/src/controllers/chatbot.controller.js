
import { responderMensaje } from '../services/chatbot/responder.js'

export const conversar = async (req, res) => {
  const preferencias = req.user?.preferenciasAsistente ?? {}

  const resultado = await responderMensaje(
    req.body.mensaje,
    preferencias,
  )

  res.json(resultado)
}
