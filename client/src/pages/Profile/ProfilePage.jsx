
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { actualizarPerfil } from '../../api/auth.js'
import { misReportes } from '../../api/reports.js'
import { mensajeDeError } from '../../api/client.js'

const ETIQUETA_ROL = {
  turista: 'Turista',
  gestor: 'Gestor',
  admin: 'Administrador',
}

const ETIQUETA_TIPO = {
  robo: 'Robo',
  accidente: 'Accidente',
  peligro: 'Peligro',
  obra: 'Obra',
  turismo: 'Turismo',
}

const ESTADO = {
  pendiente: { etiqueta: 'En votación', clase: 'badge--warn' },
  disputa: { etiqueta: 'En revisión', clase: 'badge--warn' },
  confirmado: { etiqueta: 'Confirmado', clase: 'badge--ok' },
  publicado: { etiqueta: 'Publicado', clase: 'badge--ok' },
  rechazado: { etiqueta: 'Rechazado', clase: 'badge--danger' },
}

const INTERESES = [
  { valor: 'naturaleza', etiqueta: 'Naturaleza y paisajes' },
  { valor: 'historia', etiqueta: 'Historia y patrimonio' },
  { valor: 'cultura', etiqueta: 'Cultura y museos' },
  { valor: 'gastronomia', etiqueta: 'Gastronomía local' },
  { valor: 'aventura', etiqueta: 'Aventura y actividades al aire libre' },
  { valor: 'arquitectura', etiqueta: 'Arquitectura' },
  { valor: 'compras', etiqueta: 'Compras y mercados' },
  { valor: 'familia', etiqueta: 'Actividades familiares' },
  { valor: 'vida-nocturna', etiqueta: 'Vida nocturna' },
]

const PREFERENCIAS_INICIALES = {
  intereses: [],
  ritmo: 'equilibrado',
  presupuesto: 'moderado',
  compania: 'indistinto',
  accesibilidad: false,
  evitarZonasRiesgosas: true,
  lugaresTranquilos: false,
  recomendacionesPersonalizadas: true,
  notas: '',
}

function normalizarPreferencias(preferencias) {
  const recibidas =
    preferencias && typeof preferencias === 'object'
      ? preferencias
      : {}

  return {
    ...PREFERENCIAS_INICIALES,
    ...recibidas,
    intereses: Array.isArray(recibidas.intereses)
      ? recibidas.intereses.filter((interes) =>
          INTERESES.some((opcion) => opcion.valor === interes),
        )
      : [],
    notas:
      typeof recibidas.notas === 'string'
        ? recibidas.notas
        : '',
  }
}

export default function ProfilePage() {
  const { user, actualizarUsuario } = useAuth()

  const [form, setForm] = useState({
    nombre: user?.nombre ?? '',
    fotoPerfil: user?.fotoPerfil ?? '',
  })

  const [aviso, setAviso] = useState({ tipo: '', texto: '' })
  const [enviando, setEnviando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  const [historial, setHistorial] = useState({
    clave: null,
    reportes: [],
    error: '',
  })

  const [preferencias, setPreferencias] = useState(() =>
    normalizarPreferencias(user?.preferenciasAsistente),
  )

  const [avisoPreferencias, setAvisoPreferencias] = useState({
    tipo: '',
    texto: '',
  })

  const [guardandoPreferencias, setGuardandoPreferencias] = useState(false)

  useEffect(() => {
    setForm({
      nombre: user?.nombre ?? '',
      fotoPerfil: user?.fotoPerfil ?? '',
    })
  }, [user?.nombre, user?.fotoPerfil])

  useEffect(() => {
    setPreferencias(
      normalizarPreferencias(user?.preferenciasAsistente),
    )
  }, [user?.preferenciasAsistente])

  useEffect(() => {
    let activo = true

    misReportes()
      .then((reportes) => {
        if (activo) {
          setHistorial({ clave: recarga, reportes, error: '' })
        }
      })
      .catch((err) => {
        if (activo) {
          setHistorial({
            clave: recarga,
            reportes: [],
            error: mensajeDeError(err),
          })
        }
      })

    return () => {
      activo = false
    }
  }, [recarga])

  const cargandoHistorial = historial.clave !== recarga
  const reportes = cargandoHistorial ? [] : historial.reportes
  const errorHistorial = cargandoHistorial ? '' : historial.error

  const cambiar = (e) => {
    const { name, value } = e.target

    setForm((actual) => ({
      ...actual,
      [name]: value,
    }))
  }

  const guardar = async (e) => {
    e.preventDefault()
    setAviso({ tipo: '', texto: '' })

    const cambios = {}

    if (form.nombre.trim() !== (user?.nombre ?? '')) {
      cambios.nombre = form.nombre.trim()
    }

    if (form.fotoPerfil.trim() !== (user?.fotoPerfil ?? '')) {
      cambios.fotoPerfil = form.fotoPerfil.trim()
    }

    if (!form.nombre.trim()) {
      setAviso({
        tipo: 'error',
        texto: 'El nombre no puede estar vacío.',
      })
      return
    }

    if (Object.keys(cambios).length === 0) {
      setAviso({
        tipo: 'info',
        texto: 'No hay cambios por guardar.',
      })
      return
    }

    setEnviando(true)

    try {
      const { user: actualizado } = await actualizarPerfil(cambios)

      actualizarUsuario(actualizado)

      setForm({
        nombre: actualizado.nombre,
        fotoPerfil: actualizado.fotoPerfil ?? '',
      })

      setAviso({
        tipo: 'success',
        texto: 'Perfil actualizado correctamente.',
      })
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto: mensajeDeError(err, 'No se pudo actualizar el perfil.'),
      })
    } finally {
      setEnviando(false)
    }
  }

  const cambiarPreferencia = (e) => {
    const { name, value, type, checked } = e.target

    setPreferencias((actuales) => ({
      ...actuales,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const cambiarInteres = (interes) => {
    setPreferencias((actuales) => {
      const seleccionados = actuales.intereses.includes(interes)

      return {
        ...actuales,
        intereses: seleccionados
          ? actuales.intereses.filter((item) => item !== interes)
          : [...actuales.intereses, interes],
      }
    })
  }

  const guardarPreferencias = async (e) => {
    e.preventDefault()
    setAvisoPreferencias({ tipo: '', texto: '' })

    if (!user?._id && !user?.id) {
      setAvisoPreferencias({
        tipo: 'error',
        texto: 'No se pudo identificar tu cuenta. Vuelve a iniciar sesión e inténtalo de nuevo.',
      })
      return
    }

    if (
      preferencias.notas.length > 600 ||
      preferencias.intereses.length > INTERESES.length
    ) {
      setAvisoPreferencias({
        tipo: 'error',
        texto: 'Revisa los campos: las notas admiten hasta 600 caracteres.',
      })
      return
    }

    setGuardandoPreferencias(true)

    try {
      const preferenciasLimpias = normalizarPreferencias(preferencias)

      const { user: actualizado } = await actualizarPerfil({
        preferenciasAsistente: preferenciasLimpias,
      })

      actualizarUsuario(actualizado)

      setPreferencias(
        normalizarPreferencias(actualizado.preferenciasAsistente),
      )

      setAvisoPreferencias({
        tipo: 'success',
        texto: 'Preferencias guardadas correctamente en tu cuenta.',
      })
    } catch (err) {
      setAvisoPreferencias({
        tipo: 'error',
        texto: mensajeDeError(
          err,
          'No se pudieron guardar las preferencias en el servidor.',
        ),
      })
    } finally {
      setGuardandoPreferencias(false)
    }
  }

  const restablecerPreferencias = () => {
    setPreferencias({
      ...PREFERENCIAS_INICIALES,
      intereses: [],
    })

    setAvisoPreferencias({
      tipo: 'info',
      texto: 'Valores predeterminados cargados. Pulsa «Guardar preferencias» para guardarlos en tu cuenta.',
    })
  }

  return (
    <div className="page profile-page">
      <header className="profile-page__header">
        <h1 className="page__title">Mi perfil</h1>
        <p className="muted">
          Administra tus datos personales y personaliza tu experiencia de viaje.
        </p>
      </header>

      <section className="card stack" aria-labelledby="datos-titulo">
        <div className="row">
          {user?.fotoPerfil ? (
            <img
              className="avatar"
              src={user.fotoPerfil}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="avatar avatar--vacio" aria-hidden="true">
              {(user?.nombre ?? '?').charAt(0).toUpperCase()}
            </span>
          )}

          <div>
            <h2 id="datos-titulo" className="card__title">
              {user?.nombre}
            </h2>
            <p className="muted">{user?.email}</p>
            <span className="badge">
              {ETIQUETA_ROL[user?.rol] ?? user?.rol}
            </span>
          </div>
        </div>

        <form className="stack" onSubmit={guardar} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="nombre">
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              className="input"
              value={form.nombre}
              onChange={cambiar}
              maxLength={80}
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="fotoPerfil">
              Foto de perfil (URL HTTPS)
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
            <span className="field__hint">
              Déjalo vacío para quitar la foto.
            </span>
          </div>

          {aviso.texto && (
            <p
              className={`alert alert--${aviso.tipo}`}
              role={aviso.tipo === 'error' ? 'alert' : 'status'}
            >
              {aviso.texto}
            </p>
          )}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={enviando}
          >
            {enviando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      </section>

      <section
        className="card stack profile-preferences"
        aria-labelledby="preferencias-titulo"
      >
        <div>
          <h2 id="preferencias-titulo" className="card__title">
            Preferencias del asistente IA
          </h2>
          <p className="muted">
            Cuéntanos qué tipo de experiencias te gustan para personalizar
            tus recomendaciones de viaje.
          </p>
        </div>

        <form className="stack" onSubmit={guardarPreferencias}>
          <fieldset className="profile-preferences__fieldset">
            <legend className="field__label">
              ¿Qué te interesa explorar?
            </legend>
            <p className="field__hint">
              Puedes seleccionar varias opciones.
            </p>

            <div className="profile-preferences__interests">
              {INTERESES.map((interes) => (
                <label
                  key={interes.valor}
                  className={`profile-preferences__interest${
                    preferencias.intereses.includes(interes.valor)
                      ? ' is-selected'
                      : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={preferencias.intereses.includes(interes.valor)}
                    onChange={() => cambiarInteres(interes.valor)}
                  />
                  <span>{interes.etiqueta}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label className="field__label" htmlFor="ritmo">
              Ritmo de viaje
            </label>
            <select
              id="ritmo"
              name="ritmo"
              className="input"
              value={preferencias.ritmo}
              onChange={cambiarPreferencia}
            >
              <option value="tranquilo">
                Tranquilo: pocas actividades y descansos
              </option>
              <option value="equilibrado">
                Equilibrado: combinar visitas y descanso
              </option>
              <option value="intenso">
                Intenso: aprovechar el día al máximo
              </option>
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="presupuesto">
              Presupuesto aproximado
            </label>
            <select
              id="presupuesto"
              name="presupuesto"
              className="input"
              value={preferencias.presupuesto}
              onChange={cambiarPreferencia}
            >
              <option value="economico">
                Económico: priorizar opciones gratuitas o baratas
              </option>
              <option value="moderado">
                Moderado: equilibrar precio y experiencia
              </option>
              <option value="flexible">
                Flexible: considerar distintas alternativas
              </option>
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="compania">
              ¿Con quién sueles viajar?
            </label>
            <select
              id="compania"
              name="compania"
              className="input"
              value={preferencias.compania}
              onChange={cambiarPreferencia}
            >
              <option value="indistinto">Depende del viaje</option>
              <option value="solo">Solo/a</option>
              <option value="pareja">En pareja</option>
              <option value="familia">Con familia o niños</option>
              <option value="amigos">Con amigos</option>
            </select>
          </div>

          <fieldset className="profile-preferences__fieldset">
            <legend className="field__label">
              Seguridad y comodidad
            </legend>

            <label className="profile-preferences__toggle">
              <input
                type="checkbox"
                name="evitarZonasRiesgosas"
                checked={preferencias.evitarZonasRiesgosas}
                onChange={cambiarPreferencia}
              />
              <span>
                <strong>Priorizar rutas seguras</strong>
                <small>
                  Tener en cuenta las alertas disponibles al recomendar recorridos.
                </small>
              </span>
            </label>

            <label className="profile-preferences__toggle">
              <input
                type="checkbox"
                name="accesibilidad"
                checked={preferencias.accesibilidad}
                onChange={cambiarPreferencia}
              />
              <span>
                <strong>Considerar accesibilidad</strong>
                <small>
                  Priorizar opciones accesibles cuando haya información disponible.
                </small>
              </span>
            </label>

            <label className="profile-preferences__toggle">
              <input
                type="checkbox"
                name="lugaresTranquilos"
                checked={preferencias.lugaresTranquilos}
                onChange={cambiarPreferencia}
              />
              <span>
                <strong>Preferir lugares tranquilos</strong>
                <small>
                  Favorecer ambientes relajados frente a sitios muy concurridos.
                </small>
              </span>
            </label>

            <label className="profile-preferences__toggle">
              <input
                type="checkbox"
                name="recomendacionesPersonalizadas"
                checked={preferencias.recomendacionesPersonalizadas}
                onChange={cambiarPreferencia}
              />
              <span>
                <strong>Personalizar recomendaciones</strong>
                <small>
                  Usar mis intereses y preferencias para orientar sugerencias.
                </small>
              </span>
            </label>
          </fieldset>

          <div className="field">
            <label className="field__label" htmlFor="notasPreferencias">
              Algo más que debería tener en cuenta
            </label>
            <textarea
              id="notasPreferencias"
              name="notas"
              className="input"
              rows={4}
              maxLength={600}
              placeholder="Ej.: prefiero recorridos a pie, miradores y actividades culturales..."
              value={preferencias.notas}
              onChange={cambiarPreferencia}
            />
            <span className="field__hint">
              Máximo 600 caracteres. Evita incluir información personal sensible.
            </span>
          </div>

          {avisoPreferencias.texto && (
            <p
              className={`alert alert--${avisoPreferencias.tipo}`}
              role={avisoPreferencias.tipo === 'error' ? 'alert' : 'status'}
            >
              {avisoPreferencias.texto}
            </p>
          )}

          <div className="profile-preferences__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={guardandoPreferencias}
            >
              {guardandoPreferencias
                ? 'Guardando…'
                : 'Guardar preferencias'}
            </button>

            <button
              type="button"
              className="btn btn--secondary"
              onClick={restablecerPreferencias}
              disabled={guardandoPreferencias}
            >
              Restablecer
            </button>
          </div>

          <p className="field__hint">
            Tus preferencias se guardan en tu cuenta y pueden utilizarse
            para personalizar las respuestas del asistente cuando el servidor
            las incluya en la conversación.
          </p>
        </form>
      </section>

      <section className="card stack" aria-labelledby="historial-titulo">
        <h2 id="historial-titulo" className="card__title">
          Historial de reportes
        </h2>

        {cargandoHistorial && (
          <div className="state" role="status">
            <div className="spinner" aria-hidden="true" />
            <p>Cargando historial…</p>
          </div>
        )}

        {errorHistorial && (
          <div className="state" role="alert">
            <p className="state__title">
              No se pudo cargar el historial
            </p>
            <p>{errorHistorial}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setRecarga((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargandoHistorial &&
          !errorHistorial &&
          reportes.length === 0 && (
            <div className="state">
              <p className="state__title">Sin reportes</p>
              <p>
                Aún no has reportado incidentes. Tus reportes aparecerán aquí.
              </p>
            </div>
          )}

        {!cargandoHistorial &&
          !errorHistorial &&
          reportes.length > 0 && (
            <ul className="list">
              {reportes.map((r) => (
                <li key={r._id} className="list__item">
                  <div>
                    <strong>{r.titulo}</strong>
                    <p className="muted">
                      {ETIQUETA_TIPO[r.tipo] ?? r.tipo} ·{' '}
                      {new Date(r.createdAt).toLocaleString('es-CO')}
                    </p>
                    <p className="muted">
                      {r.confirmaciones} confirman · {r.rechazos} rechazan
                    </p>
                  </div>

                  <span className={`badge ${ESTADO[r.estado]?.clase ?? ''}`}>
                    {ESTADO[r.estado]?.etiqueta ?? r.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  )
}
