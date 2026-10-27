// client/src/pages/Feed/FeedPage.jsx
import { useEffect, useId, useState } from 'react'
import VotePanel from '../../components/reports/VotePanel.jsx'
import PostCard from '../../components/feed/PostCard.jsx'
import { listarReportes } from '../../api/reports.js'
import { listarPublicaciones, crearPublicacion } from '../../api/posts.js'
import { mensajeDeError } from '../../api/client.js'

const TIPOS = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'robo', etiqueta: 'Robo' },
  { valor: 'accidente', etiqueta: 'Accidente' },
  { valor: 'peligro', etiqueta: 'Peligro' },
  { valor: 'obra', etiqueta: 'Obra' },
  { valor: 'turismo', etiqueta: 'Turismo' },
]

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
}

const VISTAS = [
  { valor: 'reportes', etiqueta: 'Reportes' },
  { valor: 'publicaciones', etiqueta: 'Publicaciones' },
]

const MAX_PUBLICACION = 500

function SeccionReportes() {
  const [tipo, setTipo] = useState('')
  const [recarga, setRecarga] = useState(0)
  const [resultado, setResultado] = useState({ clave: null, reportes: [], error: '' })

  const clave = `${tipo}:${recarga}`

  useEffect(() => {
    let activo = true
    listarReportes(tipo ? { tipo } : {})
      .then((reportes) => activo && setResultado({ clave, reportes, error: '' }))
      .catch((err) => activo && setResultado({ clave, reportes: [], error: mensajeDeError(err) }))
    return () => {
      activo = false
    }
  }, [clave, tipo])

  const cargando = resultado.clave !== clave
  const reportes = cargando ? [] : resultado.reportes
  const error = cargando ? '' : resultado.error

  return (
    <>
      <p className="muted">Los reportes en votación se ven aquí, pero aún no cuentan en el mapa.</p>

      <div className="chips" role="group" aria-label="Filtrar por tipo de incidente">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            type="button"
            className="chip"
            aria-pressed={tipo === t.valor}
            onClick={() => setTipo(t.valor)}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      {cargando && (
        <div className="state" role="status">
          <div className="spinner" aria-hidden="true" />
          <p>Cargando reportes…</p>
        </div>
      )}

      {error && (
        <div className="card state" role="alert">
          <p className="state__title">No se pudo cargar el feed</p>
          <p>{error}</p>
          <button type="button" className="btn btn--primary" onClick={() => setRecarga((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && reportes.length === 0 && (
        <div className="card state">
          <p className="state__title">Sin reportes</p>
          <p>No hay reportes vigentes con este filtro.</p>
        </div>
      )}

      {reportes.map((r) => (
        <article key={r._id} className="card stack" aria-labelledby={`rep-${r._id}`}>
          <div className="row row--between">
            <h2 id={`rep-${r._id}`} className="card__title">
              {r.titulo}
            </h2>
            <span className={`badge ${ESTADO[r.estado]?.clase ?? ''}`}>
              {ESTADO[r.estado]?.etiqueta ?? r.estado}
            </span>
          </div>

          <p className="muted">
            {ETIQUETA_TIPO[r.tipo] ?? r.tipo} · {r.autor?.nombre ?? 'Usuario'} ·{' '}
            {new Date(r.createdAt).toLocaleString('es-CO')}
          </p>

          {r.descripcion && <p>{r.descripcion}</p>}

          {r.estado === 'pendiente' && (
            <VotePanel reporte={r} onVotado={() => setRecarga((n) => n + 1)} />
          )}

          {r.estado === 'disputa' && (
            <p className="muted">Un gestor revisará este reporte porque la votación no fue concluyente.</p>
          )}
        </article>
      ))}
    </>
  )
}

function SeccionPublicaciones() {
  const idCampo = useId()
  const [recarga, setRecarga] = useState(0)
  const [resultado, setResultado] = useState({ clave: null, publicaciones: [], error: '' })
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState('')

  useEffect(() => {
    let activo = true
    listarPublicaciones()
      .then(
        (publicaciones) =>
          activo && setResultado({ clave: recarga, publicaciones, error: '' }),
      )
      .catch(
        (err) =>
          activo && setResultado({ clave: recarga, publicaciones: [], error: mensajeDeError(err) }),
      )
    return () => {
      activo = false
    }
  }, [recarga])

  const cargando = resultado.clave !== recarga
  const publicaciones = cargando ? [] : resultado.publicaciones
  const error = cargando ? '' : resultado.error

  const reemplazar = (actualizada) =>
    setResultado((prev) => ({
      ...prev,
      publicaciones: prev.publicaciones.map((p) => (p._id === actualizada._id ? actualizada : p)),
    }))

  const quitar = (id) =>
    setResultado((prev) => ({
      ...prev,
      publicaciones: prev.publicaciones.filter((p) => p._id !== id),
    }))

  const publicar = async (e) => {
    e.preventDefault()
    const contenido = texto.trim()
    if (!contenido) return
    setErrorEnvio('')
    setEnviando(true)
    try {
      const nueva = await crearPublicacion({ contenido })
      setResultado((prev) => ({ ...prev, publicaciones: [nueva, ...prev.publicaciones] }))
      setTexto('')
    } catch (err) {
      setErrorEnvio(mensajeDeError(err, 'No se pudo publicar'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <form className="card stack" onSubmit={publicar}>
        <div className="field">
          <label className="field__label" htmlFor={idCampo}>
            Comparte algo con la comunidad
          </label>
          <textarea
            id={idCampo}
            className="input"
            value={texto}
            maxLength={MAX_PUBLICACION}
            onChange={(e) => setTexto(e.target.value)}
            disabled={enviando}
          />
          <span className="field__hint">
            {texto.length}/{MAX_PUBLICACION}
          </span>
        </div>

        {errorEnvio && (
          <p className="alert alert--error" role="alert">
            {errorEnvio}
          </p>
        )}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={enviando || texto.trim().length === 0}
        >
          {enviando ? 'Publicando…' : 'Publicar'}
        </button>
      </form>

      {cargando && (
        <div className="state" role="status">
          <div className="spinner" aria-hidden="true" />
          <p>Cargando publicaciones…</p>
        </div>
      )}

      {error && (
        <div className="card state" role="alert">
          <p className="state__title">No se pudieron cargar las publicaciones</p>
          <p>{error}</p>
          <button type="button" className="btn btn--primary" onClick={() => setRecarga((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && publicaciones.length === 0 && (
        <div className="card state">
          <p className="state__title">Sin publicaciones</p>
          <p>Sé la primera persona en publicar.</p>
        </div>
      )}

      {publicaciones.map((p) => (
        <PostCard key={p._id} post={p} onActualizada={reemplazar} onRetirada={quitar} />
      ))}
    </>
  )
}

export default function FeedPage() {
  const [vista, setVista] = useState('reportes')

  return (
    <div className="page">
      <div>
        <h1 className="page__title">Feed comunitario</h1>
        <p className="page__subtitle">Reportes de incidentes y publicaciones de la comunidad.</p>
      </div>

      <div className="chips" role="group" aria-label="Contenido del feed">
        {VISTAS.map((v) => (
          <button
            key={v.valor}
            type="button"
            className="chip"
            aria-pressed={vista === v.valor}
            onClick={() => setVista(v.valor)}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>

      {vista === 'reportes' ? <SeccionReportes /> : <SeccionPublicaciones />}
    </div>
  )
}