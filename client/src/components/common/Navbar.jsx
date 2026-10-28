
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js'
import PanicButton from '../panic/PanicButton.jsx'

const ICONOS = {
  mapa: (
    <>
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15M15 6v15" />
    </>
  ),
  actividad: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10M7 12h10M7 16h6" />
    </>
  ),
  sitios: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  gestion: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </>
  ),
  luna: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
  salir: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
    </>
  ),
}

function Icono({ nombre, className = '' }) {
  return (
    <svg
      className={`sidebar__icon-svg ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONOS[nombre]}
    </svg>
  )
}

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
    { to: '/mapa', label: 'Mapa', icon: 'mapa' },
    { to: '/feed', label: 'Actividad', icon: 'actividad' },
    { to: '/sitios', label: 'Sitios turísticos', icon: 'sitios' },
    ...(esGestor
      ? [{ to: '/gestor', label: 'Gestión', icon: 'gestion' }]
      : []),
    ...(esAdmin
      ? [{ to: '/admin', label: 'Administración', icon: 'admin' }]
      : []),
    { to: '/perfil', label: 'Mi perfil', icon: 'perfil' },
    { to: '/chatbot', label: 'Asistente IA', icon: null },
  ]

  return (
    <aside className={`sidebar${colapsado ? ' sidebar--collapsed' : ''}`}>
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

      {!colapsado && (
        <div className="sidebar__section-label">NAVEGACIÓN</div>
      )}

      <nav className="sidebar__links" aria-label="Navegación principal">
        {enlaces.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={claseEnlace}
            title={colapsado ? label : undefined}
          >
            {icon ? (
              <Icono nombre={icon} />
            ) : (
              <span className="sidebar__chat-icon" aria-hidden="true">
                <svg
                  className="sidebar__icon-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2 1-5A8.5 8.5 0 1 1 21 11.5Z" />
                  <path d="M8 11h.01M12 11h.01M16 11h.01" />
                </svg>
              </span>
            )}
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
            <Icono nombre={theme === 'dark' ? 'sol' : 'luna'} />
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
            <Icono nombre="salir" />
            {!colapsado && <span>Cerrar sesión</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}
