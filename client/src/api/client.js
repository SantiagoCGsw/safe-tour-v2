import axios from 'axios'

export const TOKEN_KEY = 'safe-tour-token'
export const SESSION_EXPIRED_EVENT = 'safe-tour:session-expired'

export const leerToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const guardarToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* almacenamiento no disponible */
  }
}

export const borrarToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* almacenamiento no disponible */
  }
}

const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const client = axios.create({
  baseURL: `${base}/api`,
  timeout: 15000,
})

client.interceptors.request.use((config) => {
  const token = leerToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    if (error.response?.status === 401 && leerToken()) {
      borrarToken()
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    return Promise.reject(error)
  },
)

export const mensajeDeError = (error, respaldo = 'Ocurrió un error. Intenta de nuevo.') => {
  if (!error?.response) return 'Sin conexión con el servidor'
  const datos = error.response.data
  if (Array.isArray(datos?.errors) && datos.errors.length > 0) {
    return datos.errors.map((e) => e.mensaje).join('. ')
  }
  return datos?.message ?? respaldo
}

export default client