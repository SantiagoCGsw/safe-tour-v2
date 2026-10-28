
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js'
import PanicButton from '../panic/PanicButton.jsx'

const claseEnlace = ({ isActive }) =>
  `sidebar__link${isActive ? ' is-active' : ''}`

export default function Navbar() {
  const { user, cerrarSesion } = useAuth()
  const { theme, alternar } = useTheme()
  const enLinea = useOnlineStatus()
  const [colapsado, setColapsado] = useState(false)

  const esGestor = user?.rol === 'gestor' || user?.rol === 'admin'
  const esAdmin = user?.rol === 'admin'

  const enlaces = [
    { to: '/mapa', label: 'Mapa', icon: '🗺️' },
    { to: '/feed', label: 'Actividad', icon: '📰' },
    { to: '/sitios', label: 'Sitios turísticos', icon: '📍' },
    ...(esGestor
      ? [{ to: '/gestor', label: 'Gestión', icon: '🧭' }]
      : []),
    ...(esAdmin
      ? [{ to: '/admin', label: 'Administración', icon: '⚙️' }]
      : []),
    { to: '/perfil', label: 'Mi perfil', icon: '👤' },
    { to: '/chatbot', label: 'Asistente IA', icon: '💬' },
  ]

  return (
    <aside
      className={`sidebar${colapsado ? ' sidebar--collapsed' : ''}`}
    >
      <div className="sidebar__header">
        <NavLink
          to="/mapa"
          className="sidebar__brand"
          title="Safe Tour - Inicio"
        >
          <span className="sidebar__logo">S</span>
          {!colapsado && (
            <span className="sidebar__brand-copy">
              <strong>Safe Tour</strong>
              <small>Explora con confianza</small>
            </span>
          )}
        </NavLink>

        <button
          type="button"
          className="sidebar__collapse"
          onClick={() => setColapsado((actual) => !actual)}
          aria-label={colapsado ? 'Expandir menú' : 'Contraer menú'}
          title={colapsado ? 'Expandir menú' : 'Contraer menú'}
        >
          {colapsado ? '»' : '«'}
        </button>
      </div>

      <div className="sidebar__section-label">
        {!colapsado && 'EXPLORAR'}
      </div>

      <nav className="sidebar__links" aria-label="Navegación principal">
        {enlaces.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={claseEnlace}
            title={colapsado ? label : undefined}
          >
            <span className="sidebar__icon" aria-hidden="true">
              {icon}
            </span>
            {!colapsado && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <div className="sidebar__status">
          <span
            className={`sidebar__status-dot${enLinea ? ' is-online' : ''}`}
          />
          {!colapsado && (
            <span>{enLinea ? 'Conectado' : 'Sin conexión'}</span>
          )}
        </div>

        <div className="sidebar__actions">
          <div className="sidebar__action">
            <PanicButton />
          </div>

          <button
            type="button"
            className="sidebar__utility"
            onClick={alternar}
            aria-label={
              theme === 'dark'
                ? 'Activar tema claro'
                : 'Activar tema oscuro'
            }
            title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          >
            <span aria-hidden="true">
              {theme === 'dark' ? '☀️' : '🌙'}
            </span>
            {!colapsado && (
              <span>{theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}</span>
            )}
          </button>

          <button
            type="button"
            className="sidebar__utility sidebar__logout"
            onClick={cerrarSesion}
            title="Cerrar sesión"
          >
            <span aria-hidden="true">↪</span>
            {!colapsado && <span>Cerrar sesión</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}
