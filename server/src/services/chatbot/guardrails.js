// server/src/services/chatbot/guardrails.js
export const LONGITUD_MAXIMA = 300

export const LINEA_EMERGENCIAS = '123'

export const AVISO =
  'Recomendación automatizada basada en reportes ciudadanos validados. No sustituye a las autoridades.'

const PATRON_EMERGENCIA =
  /\b(socorro|auxilio|ayuda urgente|estoy en peligro|me estan (robando|atacando|siguiendo|persiguiendo)|me (atacan|persiguen|siguen|secuestran)|me van a (robar|matar)|tengo un arma|me robaron)\b/

export const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const evaluarMensaje = (mensaje) => {
  const original = String(mensaje ?? '').trim()
  if (!original) return { valido: false, motivo: 'vacio', texto: '', emergencia: false }
  if (original.length > LONGITUD_MAXIMA) {
    return { valido: false, motivo: 'largo', texto: '', emergencia: false }
  }
  const texto = normalizar(original)
  return { valido: true, motivo: null, texto, emergencia: PATRON_EMERGENCIA.test(texto) }
}