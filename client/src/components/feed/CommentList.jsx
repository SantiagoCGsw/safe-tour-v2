// client/src/components/feed/CommentList.jsx
import { useId, useState } from 'react'
import { mensajeDeError } from '../../api/client.js'

const MAX_TEXTO = 300

export default function CommentList({ comentarios, onComentar }) {
  const idCampo = useId()
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (e) => {
    e.preventDefault()
    const limpio = texto.trim()
    if (!limpio) return
    setError('')
    setEnviando(true)
    try {
      await onComentar(limpio)
      setTexto('')
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo publicar el comentario'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="stack">
      {comentarios.length === 0 ? (
        <p className="muted">Aún no hay comentarios.</p>
      ) : (
        <ul className="list">
          {comentarios.map((c) => (
            <li key={c._id} className="list__item">
              <div className="stack">
                <p className="muted">
                  {c.autor?.nombre ?? 'Usuario'} · {new Date(c.createdAt).toLocaleString('es-CO')}
                </p>
                <p>{c.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="stack" onSubmit={enviar}>
        <div className="field">
          <label className="field__label" htmlFor={idCampo}>
            Escribe un comentario
          </label>
          <textarea
            id={idCampo}
            className="input"
            value={texto}
            maxLength={MAX_TEXTO}
            onChange={(e) => setTexto(e.target.value)}
            disabled={enviando}
          />
          <span className="field__hint">
            {texto.length}/{MAX_TEXTO}
          </span>
        </div>

        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn--primary btn--sm"
          disabled={enviando || texto.trim().length === 0}
        >
          {enviando ? 'Enviando…' : 'Comentar'}
        </button>
      </form>
    </div>
  )
}