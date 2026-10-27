// server/src/controllers/chatbot.controller.js
import { responderMensaje } from '../services/chatbot/responder.js'

export const conversar = async (req, res) => {
  const resultado = await responderMensaje(req.body.mensaje)
  res.json(resultado)
}