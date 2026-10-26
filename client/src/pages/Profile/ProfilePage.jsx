import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { actualizarPerfil } from '../../api/auth.js'
import { mensajeDeError } from '../../api/client.js'

const ETIQUETA_ROL = { turista: 'Turista', gestor: 'Gestor', admin: 'Administrador' }

export default function ProfilePage() {
  const { user, actualizarUsuario } = useAuth()
  const [form, setForm] = useState({ nombre: user.nombre, fotoPerfil: user.fotoPerfil ?? '' })
  const [aviso, setAviso] = useState({ tipo: '', texto: '' })
  const [enviando, setEnviando] = useState(false)

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    setAviso({ tipo: '', texto: '' })

    const cambios = {}
    if (form.nombre.trim() !== user.nombre) cambios.nombre = form.nombre.trim()
    if (form.fotoPerfil.trim() !== (user.fotoPerfil ?? '')) cambios.fotoPerfil = form.fotoPerfil.trim()

    if (Object.keys(cambios).length === 0) {
      setAviso({ tipo: 'info', texto: 'No hay cambios por guardar' })
      return
    }

    setEnviando(true)
    try {
      const { user: actualizado } = await actualizarPerfil(cambios)
      actualizarUsuario(actualizado)
      setForm({ nombre: actualizado.nombre, fotoPerfil: actualizado.fotoPerfil ?? '' })
      setAviso({ tipo: 'success', texto: 'Perfil actualizado' })
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDeError(err, 'No se pudo actualizar el perfil') })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page__title">Mi perfil</h1>

      <section className="card stack" aria-labelledby="datos-titulo">
        <div className="row">
          {user.fotoPerfil ? (
            <img className="avatar" src={user.fotoPerfil} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="avatar avatar--vacio" aria-hidden="true">
              {user.nombre.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <h2 id="datos-titulo" className="card__title" style={{ marginBottom: 0 }}>
              {user.nombre}
            </h2>
            <p className="muted">{user.email}</p>
            <span className="badge">{ETIQUETA_ROL[user.rol]}</span>
          </div>
        </div>

        <form className="stack" onSubmit={guardar} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="nombre">
              Nombre
            </label>
            <input id="nombre" name="nombre" className="input" value={form.nombre} onChange={cambiar} maxLength={80} required />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="fotoPerfil">
              Foto de perfil (URL https)
            </label>
            <input
              id="fotoPerfil"
              name="fotoPerfil"
              type="url"
              className="input"
              inputMode="url"
              placeholder="https://"
              value={form.fotoPerfil}
              onChange={cambiar}
              maxLength={500}
            />
            <span className="field__hint">Déjalo vacío para quitar la foto.</span>
          </div>

          {aviso.texto && (
            <p
              className={`alert alert--${aviso.tipo}`}
              role={aviso.tipo === 'error' ? 'alert' : 'status'}
            >
              {aviso.texto}
            </p>
          )}

          <button type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </section>

      <section className="card" aria-labelledby="historial-titulo">
        <h2 id="historial-titulo" className="card__title">
          Historial de reportes
        </h2>
        <div className="state">
          <p className="state__title">Aún no disponible</p>
          <p>Tus reportes aparecerán aquí cuando el módulo de reportes esté implementado.</p>
        </div>
      </section>
    </div>
  )
}