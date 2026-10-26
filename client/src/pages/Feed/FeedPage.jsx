import { useEffect, useState } from 'react'
import VotePanel from '../../components/reports/VotePanel.jsx'
import { listarReportes } from '../../api/reports.js'
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

export default function FeedPage() {
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
    <div className="page">
      <div>
        <h1 className="page__title">Feed comunitario</h1>
        <p className="page__subtitle">
          Los reportes en votación se ven aquí, pero aún no cuentan en el mapa.
        </p>
      </div>

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
            <h2 id={`rep-${r._id}`} className="card__title" style={{ marginBottom: 0 }}>
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
    </div>
  )
}