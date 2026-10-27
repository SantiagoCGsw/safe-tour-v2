// client/src/components/feed/PostCard.jsx
import { useId, useState } from 'react'
import CommentList from './CommentList.jsx'
import ConfirmDialog from '../common/ConfirmDialog.jsx'
import Modal from '../common/Modal.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { mensajeDeError } from '../../api/client.js'
import {
  reaccionar,
  quitarReaccion,
  comentarPublicacion,
  denunciarPublicacion,
  retirarPublicacion,
} from '../../api/posts.js'

const ROLES_MODERADORES = ['gestor', 'admin']

export default function PostCard({ post, onActualizada, onRetirada, moderacion = false }) {
  const { user } = useAuth()
  const idMotivo = useId()
  const idTitulo = useId()

  const [verComentarios, setVerComentarios] = useState(false)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const [denunciaAbierta, setDenunciaAbierta] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [errorDenuncia, setErrorDenuncia] = useState('')
  const [denunciada, setDenunciada] = useState(false)

  const [retiroAbierto, setRetiroAbierto] = useState(false)

  const esAutor = String(post.autor?._id) === String(user._id)
  const puedeRetirar = esAutor || ROLES_MODERADORES.includes(user.rol)

  const alternarReaccion = async () => {
    setError('')
    setOcupado(true)
    try {
      const actualizada = post.reaccionado
        ? await quitarReaccion(post._id)
        : await reaccionar(post._id)
      onActualizada(actualizada)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo registrar tu reacción'))
    } finally {
      setOcupado(false)
    }
  }

  const comentar = async (texto) => {
    const actualizada = await comentarPublicacion(post._id, texto)
    onActualizada(actualizada)
  }

  const cerrarDenuncia = () => {
    if (ocupado) return
    setDenunciaAbierta(false)
    setMotivo('')
    setErrorDenuncia('')
  }

  const enviarDenuncia = async () => {
    setErrorDenuncia('')
    setOcupado(true)
    try {
      await denunciarPublicacion(post._id, motivo.trim())
      setDenunciada(true)
      setDenunciaAbierta(false)
      setMotivo('')
    } catch (err) {
      setErrorDenuncia(mensajeDeError(err, 'No se pudo enviar la denuncia'))
    } finally {
      setOcupado(false)
    }
  }

  const confirmarRetiro = async () => {
    setError('')
    setOcupado(true)
    try {
      await retirarPublicacion(post._id)
      setRetiroAbierto(false)
      onRetirada(post._id)
    } catch (err) {
      setRetiroAbierto(false)
      setError(mensajeDeError(err, 'No se pudo retirar la publicación'))
    } finally {
      setOcupado(false)
    }
  }

  const motivoValido = motivo.trim().length >= 3

  return (
    <article className="card stack" aria-labelledby={`${idTitulo}-autor`}>
      <div className="row row--between">
        <h2 id={`${idTitulo}-autor`} className="card__title">
          {post.autor?.nombre ?? 'Usuario'}
        </h2>
        {moderacion && (
          <span className={`badge ${post.denuncias > 0 ? 'badge--danger' : ''}`}>
            {post.denuncias} {post.denuncias === 1 ? 'denuncia' : 'denuncias'}
          </span>
        )}
      </div>

      <p className="muted">
        {post.zona?.nombre ? `${post.zona.nombre} · ` : ''}
        {new Date(post.createdAt).toLocaleString('es-CO')}
      </p>

      <p>{post.contenido}</p>

      <div className="row">
        <button
          type="button"
          className="chip"
          aria-pressed={post.reaccionado}
          onClick={alternarReaccion}
          disabled={ocupado}
        >
          Útil ({post.reacciones})
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          aria-expanded={verComentarios}
          onClick={() => setVerComentarios((v) => !v)}
        >
          Comentarios ({post.comentarios.length})
        </button>
        {!esAutor && !denunciada && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setDenunciaAbierta(true)}
          >
            Denunciar
          </button>
        )}
        {puedeRetirar && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setRetiroAbierto(true)}
          >
            Retirar
          </button>
        )}
      </div>

      {denunciada && (
        <p className="alert alert--info" role="status">
          Denuncia enviada. Un gestor la revisará.
        </p>
      )}

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      {verComentarios && <CommentList comentarios={post.comentarios} onComentar={comentar} />}

      <Modal
        open={denunciaAbierta}
        title="Denunciar publicación"
        onClose={cerrarDenuncia}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={cerrarDenuncia} disabled={ocupado}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={enviarDenuncia}
              disabled={ocupado || !motivoValido}
            >
              {ocupado ? 'Enviando…' : 'Enviar denuncia'}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field__label" htmlFor={idMotivo}>
            Motivo de la denuncia
          </label>
          <textarea
            id={idMotivo}
            className="input"
            value={motivo}
            maxLength={200}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={ocupado}
          />
          <span className="field__hint">Entre 3 y 200 caracteres.</span>
        </div>
        {errorDenuncia && (
          <p className="alert alert--error" role="alert">
            {errorDenuncia}
          </p>
        )}
      </Modal>

      <ConfirmDialog
        open={retiroAbierto}
        title="Retirar publicación"
        message={
          esAutor
            ? 'Tu publicación dejará de mostrarse en el feed.'
            : 'La publicación dejará de mostrarse y la acción quedará registrada en la auditoría.'
        }
        confirmLabel="Retirar"
        danger
        loading={ocupado}
        onConfirm={confirmarRetiro}
        onCancel={() => setRetiroAbierto(false)}
      />
    </article>
  )
}