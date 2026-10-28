
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { enviarMensaje } from '../../api/chatbot.js'
import { mensajeDeError } from '../../api/client.js'
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js'
import './ChatPage.css'

const STORAGE_KEY = 'safe-tour-chat-history-v1'
const MAX_MESSAGE = 300

const SUGERENCIAS = [
  {
    icono: '⌖',
    titulo: 'Consultar una zona',
    texto: '¿Qué nivel de riesgo tiene La Candelaria en Bogotá?',
  },
  {
    icono: '↗',
    titulo: 'Planear una ruta segura',
    texto: '¿Cómo puedo planear una ruta segura en Bogotá?',
  },
  {
    icono: '✦',
    titulo: 'Descubrir sitios',
    texto: 'Recomiéndame sitios turísticos y culturales seguros en Bogotá.',
  },
  {
    icono: '!',
    titulo: 'Ayuda de emergencia',
    texto: '¿Qué debo hacer si estoy en peligro?',
  },
]

function leerHistorial() {
  try {
    const datos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

function RespuestaFormateada({ texto }) {
  return (
    <div className="chat-answer">
      {String(texto || '').split('\n').map((linea, i) => {
        const contenido = linea.trim()

        if (!contenido) return <div key={i} className="chat-answer__space" />

        if (/^[-•]\s/.test(contenido)) {
          return (
            <p className="chat-answer__bullet" key={i}>
              <span>•</span>
              {contenido.replace(/^[-•]\s*/, '')}
            </p>
          )
        }

        if (/^\d+[.)]\s/.test(contenido)) {
          return <p className="chat-answer__bullet" key={i}>{contenido}</p>
        }

        return <p key={i}>{contenido}</p>
      })}
    </div>
  )
}

function TarjetaAccion({ mensaje }) {
  if (mensaje.rol !== 'asistente' || mensaje.emergencia) return null

  const acciones = {
    riesgo_zona: {
      icono: '⌖',
      titulo: 'Explora el mapa de seguridad',
      descripcion: 'Consulta zonas y niveles de riesgo.',
      ruta: '/mapa',
      boton: 'Abrir mapa',
    },
    ruta_segura: {
      icono: '↗',
      titulo: 'Planifica tu recorrido',
      descripcion: 'Abre el mapa para consultar las rutas.',
      ruta: '/mapa',
      boton: 'Planear ruta',
    },
    sitios_turisticos: {
      icono: '✦',
      titulo: 'Descubre Bogotá',
      descripcion: 'Explora sitios turísticos y culturales.',
      ruta: '/sitios',
      boton: 'Ver sitios',
    },
    panico_ayuda: {
      icono: '!',
      titulo: 'Herramientas de seguridad',
      descripcion: 'Consulta las herramientas disponibles en Safe Tour.',
      ruta: '/mapa',
      boton: 'Ver herramientas',
    },
  }

  const accion = acciones[mensaje.intencion]
  if (!accion) return null

  return (
    <article className="chat-action-card">
      <span className="chat-action-card__icon">{accion.icono}</span>
      <div className="chat-action-card__copy">
        <strong>{accion.titulo}</strong>
        <p>{accion.descripcion}</p>
      </div>
      <Link to={accion.ruta} className="chat-action-card__link">
        {accion.boton} →
      </Link>
    </article>
  )
}

export default function ChatPage() {
  const { user } = useAuth()
  const location = useLocation()
  const enLinea = useOnlineStatus()
  const inputId = useId()
  const inputRef = useRef(null)
  const finalRef = useRef(null)

  const [conversaciones, setConversaciones] = useState(leerHistorial)
  const [activaId, setActivaId] = useState(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [sidebarAbierta, setSidebarAbierta] = useState(true)
  const [contextoVisible, setContextoVisible] = useState(true)

  const activa = conversaciones.find((c) => c.id === activaId)
  const mensajes = activa?.mensajes || []

  const paginaOrigen = location.state?.from || '/mapa'
  const nombresPagina = {
    '/mapa': 'el mapa de seguridad',
    '/feed': 'el feed de la comunidad',
    '/sitios': 'los sitios turísticos',
    '/perfil': 'tu perfil',
    '/chatbot': 'el asistente',
  }
  const contexto = nombresPagina[paginaOrigen] || 'Safe Tour'

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(conversaciones.slice(0, 30)),
      )
    } catch {
      // El chat sigue funcionando si el navegador no permite guardar datos.
    }
  }, [conversaciones])

  useEffect(() => {
    finalRef.current?.scrollIntoView({
      block: 'end',
      behavior: 'smooth',
    })
  }, [mensajes, enviando])

  function nuevaConversacion() {
    setActivaId(null)
    setTexto('')
    setError('')
    inputRef.current?.focus()
  }

  async function enviar(valor = texto) {
    const pregunta = valor.trim()

    if (!pregunta || enviando || !enLinea) return

    setTexto('')
    setError('')
    setEnviando(true)

    const id = activaId || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const mensajeUsuario = {
      id: `u-${Date.now()}`,
      rol: 'usuario',
      texto: pregunta,
      creado: new Date().toISOString(),
    }

    setConversaciones((actuales) => {
      const existente = actuales.find((c) => c.id === id)

      if (existente) {
        return actuales.map((c) =>
          c.id === id
            ? {
                ...c,
                actualizado: Date.now(),
                mensajes: [...c.mensajes, mensajeUsuario],
              }
            : c,
        )
      }

      return [
        {
          id,
          titulo: pregunta.length > 42
            ? `${pregunta.slice(0, 39)}…`
            : pregunta,
          creado: Date.now(),
          actualizado: Date.now(),
          mensajes: [mensajeUsuario],
        },
        ...actuales,
      ]
    })

    setActivaId(id)

    try {
      const resultado = await enviarMensaje(pregunta)

      const respuesta = {
        id: `a-${Date.now()}`,
        rol: 'asistente',
        texto: resultado.respuesta,
        emergencia: resultado.emergencia,
        aviso: resultado.aviso,
        intencion: resultado.intencion,
        creado: new Date().toISOString(),
      }

      setConversaciones((actuales) =>
        actuales.map((c) =>
          c.id === id
            ? {
                ...c,
                actualizado: Date.now(),
                mensajes: [...c.mensajes, respuesta],
              }
            : c,
        ),
      )
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo obtener una respuesta.'))
    } finally {
      setEnviando(false)
    }
  }

  function enviarFormulario(e) {
    e.preventDefault()
    enviar()
  }

  function eliminarConversacion(e, id) {
    e.preventDefault()
    e.stopPropagation()

    setConversaciones((actuales) => actuales.filter((c) => c.id !== id))

    if (activaId === id) {
      setActivaId(null)
      setTexto('')
    }
  }

  return (
    <section className={`chat-page ${sidebarAbierta ? '' : 'chat-page--collapsed'}`}>
      <aside className="chat-history">
        <div className="chat-history__top">
          <div className="chat-history__brand">
            <span className="chat-brand-mark">✦</span>
            <div>
              <strong>Safe Tour <span>AI</span></strong>
              <small>Asistente de viaje</small>
            </div>
          </div>

          <button
            type="button"
            className="chat-icon-button"
            onClick={() => setSidebarAbierta(false)}
            aria-label="Plegar menú lateral"
            title="Plegar menú"
          >
            «
          </button>
        </div>

        <button
          type="button"
          className="chat-new-button"
          onClick={nuevaConversacion}
        >
          <span>＋</span> Nueva conversación
        </button>

        <p className="chat-history__label">HISTORIAL</p>

        <div className="chat-history__list">
          {conversaciones.map((c) => (
            <div
              key={c.id}
              className={`chat-history__row ${c.id === activaId ? 'is-active' : ''}`}
            >
              <button
                type="button"
                className="chat-history__item"
                onClick={() => {
                  setActivaId(c.id)
                  setError('')
                }}
                title={c.titulo}
              >
                <span aria-hidden="true">◷</span>
                <span className="chat-history__title">{c.titulo}</span>
              </button>

              <button
                type="button"
                className="chat-history__delete"
                onClick={(e) => eliminarConversacion(e, c.id)}
                aria-label={`Eliminar ${c.titulo}`}
                title="Eliminar conversación"
              >
                ×
              </button>
            </div>
          ))}

          {conversaciones.length === 0 && (
            <p className="chat-history__empty">
              Tus conversaciones aparecerán aquí.
            </p>
          )}
        </div>

        <div className="chat-history__bottom">
          <div className="chat-user-chip">
            <span className="chat-user-avatar">
              {(user?.nombre || user?.name || 'V').slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{user?.nombre || user?.name || 'Viajero'}</strong>
              <small>Cuenta Safe Tour</small>
            </span>
          </div>
          <p>Historial guardado en este navegador.</p>
        </div>
      </aside>

      <div className="chat-workspace">
        <header className="chat-topbar">
          <div className="chat-topbar__left">
            {!sidebarAbierta && (
              <button
                type="button"
                className="chat-icon-button"
                onClick={() => setSidebarAbierta(true)}
                aria-label="Expandir menú lateral"
                title="Mostrar historial"
              >
                »
              </button>
            )}

            <span className="chat-status-dot" />

            <div>
              <strong>Asistente Safe Tour</strong>
              <small>Seguridad y turismo en Bogotá</small>
            </div>
          </div>

          <div className="chat-topbar__actions">
            <span className={`chat-online-badge ${enLinea ? '' : 'is-offline'}`}>
              ● {enLinea ? 'En línea' : 'Sin conexión'}
            </span>
            <Link to="/mapa" className="chat-map-link">
              ⌖ <span>Ver mapa</span>
            </Link>
          </div>
        </header>

        {contextoVisible && (
          <div className="chat-context">
            <span className="chat-context__icon">⌖</span>
            <span className="chat-context__copy">
              <strong>Contexto de navegación</strong>
              <small>
                Vienes de {contexto}. Pregunta sobre zonas, rutas y lugares de Bogotá.
              </small>
            </span>
            <button
              type="button"
              onClick={() => setContextoVisible(false)}
              aria-label="Ocultar contexto"
            >
              ×
            </button>
          </div>
        )}

        <main className={`chat-conversation ${mensajes.length === 0 ? 'is-empty' : ''}`}>
          {mensajes.length === 0 ? (
            <div className="chat-welcome">
              <div className="chat-welcome__orb">✦</div>
              <p className="chat-eyebrow">TU COMPAÑERO DE VIAJE</p>
              <h1>
                Hola{user?.nombre ? `, ${user.nombre.split(' ')[0]}` : ''}.
                <br />
                ¿Qué vamos a explorar?
              </h1>
              <p className="chat-welcome__subtitle">
                Consulta la seguridad de una zona, descubre lugares interesantes
                o prepara tu recorrido por Bogotá.
              </p>

              <div className="chat-suggestions">
                {SUGERENCIAS.map((s) => (
                  <button
                    type="button"
                    key={s.titulo}
                    className="chat-suggestion"
                    onClick={() => enviar(s.texto)}
                    disabled={enviando || !enLinea}
                  >
                    <span className="chat-suggestion__icon">{s.icono}</span>
                    <span className="chat-suggestion__copy">
                      <strong>{s.titulo}</strong>
                      <small>{s.texto}</small>
                    </span>
                    <span className="chat-suggestion__arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="chat-messages"
              role="log"
              aria-live="polite"
              aria-label="Mensajes de la conversación"
            >
              {mensajes.map((m) => (
                <article
                  key={m.id}
                  className={`chat-message chat-message--${m.rol}`}
                >
                  {m.rol === 'asistente' && (
                    <span className="chat-message__avatar">✦</span>
                  )}

                  <div className="chat-message__body">
                    {m.rol === 'asistente' && (
                      <div className="chat-message__name">
                        Safe Tour AI <span>· asistente</span>
                      </div>
                    )}

                    <div className={`chat-message__bubble ${m.emergencia ? 'is-emergency' : ''}`}>
                      <RespuestaFormateada texto={m.texto} />
                    </div>

                    {m.aviso && (
                      <p className="chat-disclaimer">{m.aviso}</p>
                    )}

                    <TarjetaAccion mensaje={m} />
                  </div>
                </article>
              ))}

              {enviando && (
                <article className="chat-message chat-message--asistente">
                  <span className="chat-message__avatar">✦</span>
                  <div className="chat-message__body">
                    <div className="chat-message__name">Safe Tour AI</div>
                    <div className="chat-message__bubble chat-typing" role="status">
                      <i /><i /><i />
                      <span>Consultando información…</span>
                    </div>
                  </div>
                </article>
              )}

              <div ref={finalRef} />
            </div>
          )}
        </main>

        <footer className="chat-composer-area">
          {error && <p className="chat-error" role="alert">{error}</p>}

          {!enLinea && (
            <p className="chat-offline-notice" role="status">
              Sin conexión. Necesitas internet para recibir una respuesta.
            </p>
          )}

          <form className="chat-composer" onSubmit={enviarFormulario}>
            <label className="sr-only" htmlFor={inputId}>
              Escribe tu pregunta
            </label>

            <textarea
              id={inputId}
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar()
                }
              }}
              maxLength={MAX_MESSAGE}
              placeholder="Pregunta sobre zonas, rutas o lugares seguros…"
              rows={1}
              disabled={!enLinea || enviando}
            />

            <div className="chat-composer__bottom">
              <span>Verifica la información importante antes de viajar.</span>
              <div className="chat-composer__controls">
                <small>{texto.length}/{MAX_MESSAGE}</small>
                <button
                  type="submit"
                  aria-label="Enviar mensaje"
                  disabled={!texto.trim() || enviando || !enLinea}
                >
                  {enviando ? '…' : '↑'}
                </button>
              </div>
            </div>
          </form>

          <p className="chat-composer-hint">
            Enter para enviar · Shift + Enter para nueva línea
          </p>
        </footer>
      </div>
    </section>
  )
}
