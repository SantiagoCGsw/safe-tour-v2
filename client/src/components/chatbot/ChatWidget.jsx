// client/src/components/chatbot/ChatWidget.jsx
import { useEffect, useId, useRef, useState } from 'react'
import Modal from '../common/Modal.jsx'
import { enviarMensaje } from '../../api/chatbot.js'
import { mensajeDeError } from '../../api/client.js'
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js'

const LIMITE_MENSAJE = 300

export default function ChatWidget() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const enLinea = useOnlineStatus()
  const inputId = useId()
  const siguienteId = useRef(1)
  const final = useRef(null)

  useEffect(() => {
    if (abierto) final.current?.scrollIntoView({ block: 'end' })
  }, [abierto, mensajes, enviando])

  const agregar = (mensaje) => setMensajes((actuales) => [...actuales, { id: siguienteId.current++, ...mensaje }])

  const enviar = async (e) => {
    e.preventDefault()
    const mensaje = texto.trim()
    if (!mensaje || enviando || !enLinea) return

    setError('')
    setTexto('')
    setEnviando(true)
    agregar({ rol: 'usuario', texto: mensaje })

    try {
      const r = await enviarMensaje(mensaje)
      agregar({ rol: 'asistente', texto: r.respuesta, emergencia: r.emergencia, aviso: r.aviso })
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo obtener una respuesta'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAbierto(true)}>
        Asistente
      </button>

      <Modal
        open={abierto}
        title="Asistente de seguridad y turismo"
        onClose={() => setAbierto(false)}
        footer={
          <button type="button" className="btn btn--ghost" onClick={() => setAbierto(false)}>
            Cerrar
          </button>
        }
      >
        <div className="stack">
          <p className="muted">
            Asistente automatizado para Bogotá. Responde con base en reportes ciudadanos validados y no sustituye a las autoridades.
          </p>

          {mensajes.length === 0 && !enviando && (
            <p className="muted">Pregunta, por ejemplo: «¿Es seguro La Candelaria ahora?»</p>
          )}

          {mensajes.length > 0 && (
            <ul className="list" role="log" aria-live="polite" aria-label="Conversación">
              {mensajes.map((m) => (
                <li key={m.id} className="list__item">
                  <div>
                    <strong>{m.rol === 'usuario' ? 'Tú' : 'Asistente'}</strong>
                    {m.emergencia ? (
                      <p className="alert alert--error" role="alert">
                        {m.texto}
                      </p>
                    ) : (
                      <p>{m.texto}</p>
                    )}
                    {m.aviso && <p className="muted">{m.aviso}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {enviando && (
            <div className="state" role="status">
              <div className="spinner" aria-hidden="true" />
              <p>Consultando…</p>
            </div>
          )}

          {error && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}

          {!enLinea && (
            <p className="alert alert--info" role="status">
              Sin conexión. El asistente necesita internet para responder.
            </p>
          )}

          <div ref={final} />

          <form className="stack" onSubmit={enviar} noValidate>
            <div className="field">
              <label className="field__label" htmlFor={inputId}>
                Tu pregunta
              </label>
              <input
                id={inputId}
                className="input"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={LIMITE_MENSAJE}
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={enviando || !enLinea || !texto.trim()}
            >
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </form>
        </div>
      </Modal>
    </>
  )
}