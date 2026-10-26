import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const CLAVE = 'safe-tour-theme'
const ThemeContext = createContext(null)

const leerTema = () => {
  try {
    const guardado = localStorage.getItem(CLAVE)
    return guardado === 'light' || guardado === 'dark' ? guardado : 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(leerTema)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(CLAVE, theme)
    } catch {
      /* almacenamiento no disponible */
    }
  }, [theme])

  const alternar = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  const valor = useMemo(() => ({ theme, alternar }), [theme, alternar])

  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const contexto = useContext(ThemeContext)
  if (!contexto) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return contexto
}