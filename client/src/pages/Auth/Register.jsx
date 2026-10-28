import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { mensajeDeError } from '../../api/client.js'

const passwordValida = (v) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v)

export default function Register() {
  const { registrarse } = useAuth()
  const [form, setForm] = useState({ nombre: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    if (form.nombre.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres')
      return
    }
    if (!passwordValida(form.password)) {
      setError('La contraseña debe tener mínimo 8 caracteres, con letras y números')
      return
    }

    setEnviando(true)
    try {
      await registrarse({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        password: form.password,
      })
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo crear la cuenta'))
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="card auth__card">
        <h1 className="auth__brand">Crear cuenta</h1>
        <p className="muted">Safe Tour te muestra las zonas de riesgo en Bogotá.</p>

        <form className="stack" onSubmit={enviar} noValidate style={{ marginTop: 'var(--space-4)' }}>
          <div className="field">
            <label className="field__label" htmlFor="nombre">
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              className="input"
              autoComplete="name"
              value={form.nombre}
              onChange={cambiar}
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={cambiar}
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="input"
              autoComplete="new-password"
              aria-describedby="password-ayuda"
              value={form.password}
              onChange={cambiar}
              required
            />
            <span id="password-ayuda" className="field__hint">
              Mínimo 8 caracteres, con letras y números.
            </span>
          </div>

          {error && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={enviando || !form.nombre || !form.email || !form.password}
          >
            {enviando ? 'Creando cuenta…' : 'Registrarme'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 'var(--space-4)' }}>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </>
  )
}