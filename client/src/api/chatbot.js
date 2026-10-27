// client/src/api/chatbot.js
import client from './client.js'

export const enviarMensaje = (mensaje) =>
  client.post('/chatbot/mensajes', { mensaje }).then((r) => r.data)