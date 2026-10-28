import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { mensajeDeError } from '../../api/client.js'

export default function Login() {
  const { iniciarSesion } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await iniciarSesion({ email: form.email.trim(), password: form.password })
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo iniciar sesión'))
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="card auth__card">
        <h1 className="auth__brand">Safe Tour</h1>
        <p className="muted">Inicia sesión para ver las zonas de Bogotá.</p>

        <form className="stack" onSubmit={enviar} noValidate style={{ marginTop: 'var(--space-4)' }}>
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
              autoComplete="current-password"
              value={form.password}
              onChange={cambiar}
              required
            />
          </div>

          {error && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={enviando || !form.email || !form.password}
          >
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 'var(--space-4)' }}>
          ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
        </p>
      </div>
    </>
  )
}