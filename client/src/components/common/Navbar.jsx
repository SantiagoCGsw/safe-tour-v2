import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js'
import PanicButton from '../panic/PanicButton.jsx'

const claseEnlace = ({ isActive }) => `navbar__link${isActive ? ' is-active' : ''}`

export default function Navbar() {
  const { user, cerrarSesion } = useAuth()
  const { theme, alternar } = useTheme()
  const enLinea = useOnlineStatus()

  const esGestor = user?.rol === 'gestor' || user?.rol === 'admin'
  const esAdmin = user?.rol === 'admin'

  return (
    <>
      <header className="navbar">
        <NavLink to="/mapa" className="navbar__brand">
          Safe Tour
        </NavLink>

        <div className="navbar__actions">
          {!enLinea && <span className="badge badge--warn">Sin conexión</span>}
          <PanicButton />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={alternar}
            aria-label={theme === 'dark' ? 'Activar modo día' : 'Activar modo noche'}
          >
            {theme === 'dark' ? 'Modo día' : 'Modo noche'}
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={cerrarSesion}>
            Salir
          </button>
        </div>
      </header>

      <nav className="navbar__links" aria-label="Principal">
        <NavLink to="/mapa" className={claseEnlace}>
          Mapa
        </NavLink>
        <NavLink to="/feed" className={claseEnlace}>
          Feed
        </NavLink>
        <NavLink to="/sitios" className={claseEnlace}>
          Sitios
        </NavLink>
        {esGestor && (
          <NavLink to="/gestor" className={claseEnlace}>
            Gestión
          </NavLink>
        )}
        {esAdmin && (
          <NavLink to="/admin" className={claseEnlace}>
            Admin
          </NavLink>
        )}
        <NavLink to="/perfil" className={claseEnlace}>
          Perfil
        </NavLink>
      </nav>
    </>
  )
}