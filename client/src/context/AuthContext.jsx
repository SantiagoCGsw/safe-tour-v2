import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth.js'
import {
  SESSION_EXPIRED_EVENT,
  borrarToken,
  guardarToken,
  leerToken,
} from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [cargando, setCargando] = useState(() => Boolean(leerToken()))

  useEffect(() => {
    let activo = true

    if (leerToken()) {
      authApi
        .me()
        .then(({ user: actual }) => {
          if (activo) setUser(actual)
        })
        .catch(() => {})
        .finally(() => {
          if (activo) setCargando(false)
        })
    }

    const alExpirar = () => setUser(null)
    window.addEventListener(SESSION_EXPIRED_EVENT, alExpirar)

    return () => {
      activo = false
      window.removeEventListener(SESSION_EXPIRED_EVENT, alExpirar)
    }
  }, [])

  const iniciarSesion = useCallback(async (credenciales) => {
    const { user: actual, token } = await authApi.login(credenciales)
    guardarToken(token)
    setUser(actual)
    return actual
  }, [])

  const registrarse = useCallback(async (datos) => {
    const { user: actual, token } = await authApi.register(datos)
    guardarToken(token)
    setUser(actual)
    return actual
  }, [])

  const cerrarSesion = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* el cierre es local aunque el servidor no responda */
    }
    borrarToken()
    setUser(null)
  }, [])

  const actualizarUsuario = useCallback((actual) => setUser(actual), [])

  const valor = useMemo(
    () => ({ user, cargando, iniciarSesion, registrarse, cerrarSesion, actualizarUsuario }),
    [user, cargando, iniciarSesion, registrarse, cerrarSesion, actualizarUsuario],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return contexto
}