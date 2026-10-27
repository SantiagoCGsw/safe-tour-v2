// client/src/pages/Gestor/GestorPage.jsx
import { useEffect, useState } from 'react'
import { Polygon, Polyline, CircleMarker } from 'react-leaflet'
import MapView from '../../components/map/MapView.jsx'
import ZoneLayer from '../../components/map/ZoneLayer.jsx'
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx'
import PostCard from '../../components/feed/PostCard.jsx'
import { listarZonas, crearZona, actualizarZona, desactivarZona } from '../../api/zones.js'
import { listarDisputas, resolverDisputa } from '../../api/reports.js'
import { listarModeracion } from '../../api/posts.js'
import { mensajeDeError } from '../../api/client.js'

const TIPOS = [
  { valor: 'turistica', etiqueta: 'Turística' },
  { valor: 'cultural', etiqueta: 'Cultural' },
  { valor: 'peligrosa', etiqueta: 'Peligrosa' },
  { valor: 'segura', etiqueta: 'Segura' },
]

const NIVELES = [
  { valor: 1, etiqueta: '1 · Riesgo muy alto' },
  { valor: 2, etiqueta: '2 · Riesgo alto' },
  { valor: 3, etiqueta: '3 · Riesgo medio' },
  { valor: 4, etiqueta: '4 · Riesgo bajo' },
  { valor: 5, etiqueta: '5 · Riesgo muy bajo' },
]

const ETIQUETA_TIPO_REPORTE = {
  robo: 'Robo',
  accidente: 'Accidente',
  peligro: 'Peligro',
  obra: 'Obra',
  turismo: 'Turismo',
}

const VISTAS = [
  { valor: 'zonas', etiqueta: 'Zonas' },
  { valor: 'disputas', etiqueta: 'Disputas' },
  { valor: 'moderacion', etiqueta: 'Moderación' },
]

const BORRADOR_NUEVO = {
  id: null,
  nombre: '',
  descripcion: '',
  tipo: 'turistica',
  nivelSeguridad: 3,
  puntos: [],
}

const FILTROS_VACIOS = { zona: '', desde: '', hasta: '' }

const ESTILO_BORRADOR = { color: '#5aa2ff', weight: 3, dashArray: '6 6', fillOpacity: 0.15 }

const aParametros = ({ zona, desde, hasta }) => {
  const params = {}
  if (zona) params.zona = zona
  if (desde) params.desde = new Date(`${desde}T00:00:00`).toISOString()
  if (hasta) params.hasta = new Date(`${hasta}T23:59:59.999`).toISOString()
  return params
}

function Aviso({ aviso }) {
  if (!aviso.texto) return null
  return (
    <p
      className={`alert ${aviso.tipo === 'error' ? 'alert--error' : 'alert--success'}`}
      role={aviso.tipo === 'error' ? 'alert' : 'status'}
    >
      {aviso.texto}
    </p>
  )
}

function SeccionZonas() {
  const [version, setVersion] = useState(0)
  const [resultado, setResultado] = useState({ version: null, zonas: [], error: '' })
  const [editor, setEditor] = useState(null)
  const [aDesactivar, setADesactivar] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState({ tipo: '', texto: '' })

  useEffect(() => {
    let activo = true
    listarZonas()
      .then((zonas) => activo && setResultado({ version, zonas, error: '' }))
      .catch((err) => activo && setResultado({ version, zonas: [], error: mensajeDeError(err) }))
    return () => {
      activo = false
    }
  }, [version])

  const cargando = resultado.version !== version
  const zonas = cargando ? [] : resultado.zonas
  const errorCarga = cargando ? '' : resultado.error
  const recargar = () => setVersion((v) => v + 1)

  const abrirNueva = () => {
    setAviso({ tipo: '', texto: '' })
    setEditor({ ...BORRADOR_NUEVO })
  }

  const abrirEdicion = (zona) => {
    setAviso({ tipo: '', texto: '' })
    setEditor({
      id: zona._id,
      nombre: zona.nombre,
      descripcion: zona.descripcion ?? '',
      tipo: zona.tipo,
      nivelSeguridad: zona.nivelSeguridad,
      puntos: zona.coordenadas.map((p) => ({ lat: p.lat, lng: p.lng })),
    })
  }

  const cambiarCampo = (e) => {
    const { name, value } = e.target
    setEditor((ed) => ({ ...ed, [name]: name === 'nivelSeguridad' ? Number(value) : value }))
  }

  const agregarPunto = (punto) => setEditor((ed) => ({ ...ed, puntos: [...ed.puntos, punto] }))
  const deshacerPunto = () => setEditor((ed) => ({ ...ed, puntos: ed.puntos.slice(0, -1) }))
  const limpiarPuntos = () => setEditor((ed) => ({ ...ed, puntos: [] }))

  const guardar = async (e) => {
    e.preventDefault()
    setAviso({ tipo: '', texto: '' })

    if (editor.nombre.trim().length < 2) {
      setAviso({ tipo: 'error', texto: 'El nombre debe tener al menos 2 caracteres' })
      return
    }
    if (editor.puntos.length < 3) {
      setAviso({ tipo: 'error', texto: 'Marca mínimo 3 puntos en el mapa para definir la zona' })
      return
    }

    const datos = {
      nombre: editor.nombre.trim(),
      descripcion: editor.descripcion.trim(),
      tipo: editor.tipo,
      nivelSeguridad: editor.nivelSeguridad,
      coordenadas: editor.puntos,
    }

    setEnviando(true)
    try {
      if (editor.id) await actualizarZona(editor.id, datos)
      else await crearZona(datos)
      setEditor(null)
      setAviso({ tipo: 'success', texto: 'Zona guardada' })
      recargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDeError(err, 'No se pudo guardar la zona') })
    } finally {
      setEnviando(false)
    }
  }

  const confirmarDesactivacion = async () => {
    setEnviando(true)
    try {
      await desactivarZona(aDesactivar._id)
      setAviso({ tipo: 'success', texto: 'Zona desactivada' })
      recargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDeError(err, 'No se pudo desactivar la zona') })
    } finally {
      setEnviando(false)
      setADesactivar(null)
    }
  }

  const otrasZonas = editor?.id ? zonas.filter((z) => z._id !== editor.id) : zonas
  const posiciones = editor ? editor.puntos.map((p) => [p.lat, p.lng]) : []

  return (
    <>
      <div className="row row--between">
        <p className="muted">Crea, edita y desactiva zonas del mapa.</p>
        {!editor && (
          <button type="button" className="btn btn--primary" onClick={abrirNueva}>
            Nueva zona
          </button>
        )}
      </div>

      <Aviso aviso={aviso} />

      {editor && (
        <section className="card stack" aria-labelledby="editor-titulo">
          <h2 id="editor-titulo" className="card__title">
            {editor.id ? 'Editar zona' : 'Nueva zona'}
          </h2>

          <p className="muted">
            Toca el mapa para marcar los vértices del polígono. Puntos marcados: {editor.puntos.length}{' '}
            (mínimo 3).
          </p>

          <MapView onMapClick={agregarPunto} centrarEnUsuario={false}>
            <ZoneLayer zonas={otrasZonas} />
            {posiciones.length >= 3 && <Polygon positions={posiciones} pathOptions={ESTILO_BORRADOR} />}
            {posiciones.length === 2 && <Polyline positions={posiciones} pathOptions={ESTILO_BORRADOR} />}
            {posiciones.map((p, i) => (
              <CircleMarker
                key={`${p[0]}-${p[1]}-${i}`}
                center={p}
                radius={5}
                pathOptions={{ color: '#5aa2ff', fillColor: '#ffffff', fillOpacity: 1 }}
              />
            ))}
          </MapView>

          <div className="row">
            <button type="button" className="btn btn--secondary btn--sm" onClick={deshacerPunto} disabled={editor.puntos.length === 0}>
              Deshacer punto
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={limpiarPuntos} disabled={editor.puntos.length === 0}>
              Limpiar puntos
            </button>
          </div>

          <form className="stack" onSubmit={guardar} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="nombre">
                Nombre
              </label>
              <input id="nombre" name="nombre" className="input" value={editor.nombre} onChange={cambiarCampo} maxLength={100} required />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="descripcion">
                Descripción
              </label>
              <textarea id="descripcion" name="descripcion" className="input" value={editor.descripcion} onChange={cambiarCampo} maxLength={500} />
            </div>

            <div className="grid">
              <div className="field">
                <label className="field__label" htmlFor="tipo">
                  Tipo
                </label>
                <select id="tipo" name="tipo" className="input" value={editor.tipo} onChange={cambiarCampo}>
                  {TIPOS.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="nivelSeguridad">
                  Nivel de seguridad
                </label>
                <select id="nivelSeguridad" name="nivelSeguridad" className="input" value={editor.nivelSeguridad} onChange={cambiarCampo}>
                  {NIVELES.map((n) => (
                    <option key={n.valor} value={n.valor}>
                      {n.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row">
              <button type="submit" className="btn btn--primary" disabled={enviando}>
                {enviando ? 'Guardando…' : 'Guardar zona'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setEditor(null)} disabled={enviando}>
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card" aria-labelledby="lista-titulo">
        <h2 id="lista-titulo" className="card__title">
          Zonas activas
        </h2>

        {cargando && (
          <div className="state" role="status">
            <div className="spinner" aria-hidden="true" />
            <p>Cargando zonas…</p>
          </div>
        )}

        {errorCarga && (
          <div className="state" role="alert">
            <p className="state__title">No se pudieron cargar las zonas</p>
            <p>{errorCarga}</p>
            <button type="button" className="btn btn--primary" onClick={recargar}>
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !errorCarga && zonas.length === 0 && (
          <div className="state">
            <p className="state__title">Sin zonas activas</p>
            <p>Crea la primera con el botón «Nueva zona».</p>
          </div>
        )}

        {!cargando && zonas.length > 0 && (
          <ul className="list">
            {zonas.map((zona) => (
              <li key={zona._id} className="list__item">
                <div>
                  <strong>{zona.nombre}</strong>
                  <p className="muted">
                    {zona.tipo} · nivel {zona.nivelSeguridad} de 5
                  </p>
                </div>
                <div className="row">
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => abrirEdicion(zona)}>
                    Editar
                  </button>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => setADesactivar(zona)}>
                    Desactivar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(aDesactivar)}
        title="Desactivar zona"
        message={`La zona «${aDesactivar?.nombre ?? ''}» dejará de mostrarse a los usuarios. No se borra de la base de datos.`}
        confirmLabel="Desactivar"
        danger
        loading={enviando}
        onConfirm={confirmarDesactivacion}
        onCancel={() => setADesactivar(null)}
      />
    </>
  )
}

function SeccionDisputas() {
  const [version, setVersion] = useState(0)
  const [resultado, setResultado] = useState({ version: null, reportes: [], error: '' })
  const [pendiente, setPendiente] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState({ tipo: '', texto: '' })

  useEffect(() => {
    let activo = true
    listarDisputas()
      .then((reportes) => activo && setResultado({ version, reportes, error: '' }))
      .catch((err) => activo && setResultado({ version, reportes: [], error: mensajeDeError(err) }))
    return () => {
      activo = false
    }
  }, [version])

  const cargando = resultado.version !== version
  const reportes = cargando ? [] : resultado.reportes
  const error = cargando ? '' : resultado.error
  const recargar = () => setVersion((v) => v + 1)

  const resolver = async () => {
    setEnviando(true)
    try {
      await resolverDisputa(pendiente.reporte._id, pendiente.decision)
      setAviso({
        tipo: 'success',
        texto: pendiente.decision === 'confirmado' ? 'Reporte confirmado' : 'Reporte rechazado',
      })
      recargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDeError(err, 'No se pudo resolver la disputa') })
    } finally {
      setEnviando(false)
      setPendiente(null)
    }
  }

  return (
    <>
      <p className="muted">
        Reportes cuya votación no fue concluyente. Tu decisión queda registrada y, si confirmas, el
        reporte empieza a contar en el mapa de calor.
      </p>

      <Aviso aviso={aviso} />

      {cargando && (
        <div className="state" role="status">
          <div className="spinner" aria-hidden="true" />
          <p>Cargando disputas…</p>
        </div>
      )}

      {error && (
        <div className="card state" role="alert">
          <p className="state__title">No se pudieron cargar las disputas</p>
          <p>{error}</p>
          <button type="button" className="btn btn--primary" onClick={recargar}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && reportes.length === 0 && (
        <div className="card state">
          <p className="state__title">Sin disputas</p>
          <p>No hay reportes esperando una decisión.</p>
        </div>
      )}

      {reportes.map((r) => (
        <article key={r._id} className="card stack" aria-labelledby={`disp-${r._id}`}>
          <div className="row row--between">
            <h2 id={`disp-${r._id}`} className="card__title">
              {r.titulo}
            </h2>
            <span className="badge badge--warn">En disputa</span>
          </div>

          <p className="muted">
            {ETIQUETA_TIPO_REPORTE[r.tipo] ?? r.tipo} · {r.autor?.nombre ?? 'Usuario'} ·{' '}
            {new Date(r.createdAt).toLocaleString('es-CO')}
          </p>

          {r.descripcion && <p>{r.descripcion}</p>}

          <p className="muted">
            {r.confirmaciones} confirman · {r.rechazos} rechazan
          </p>

          <div className="row">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setPendiente({ reporte: r, decision: 'confirmado' })}
            >
              Confirmar reporte
            </button>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => setPendiente({ reporte: r, decision: 'rechazado' })}
            >
              Rechazar reporte
            </button>
          </div>
        </article>
      ))}

      <ConfirmDialog
        open={Boolean(pendiente)}
        title={pendiente?.decision === 'confirmado' ? 'Confirmar reporte' : 'Rechazar reporte'}
        message={
          pendiente?.decision === 'confirmado'
            ? `El reporte «${pendiente?.reporte.titulo}» pasará a confirmado y contará en el mapa de calor.`
            : `El reporte «${pendiente?.reporte.titulo}» pasará a rechazado y no contará en el mapa de calor.`
        }
        confirmLabel={pendiente?.decision === 'confirmado' ? 'Confirmar' : 'Rechazar'}
        danger={pendiente?.decision === 'rechazado'}
        loading={enviando}
        onConfirm={resolver}
        onCancel={() => setPendiente(null)}
      />
    </>
  )
}

function SeccionModeracion() {
  const [version, setVersion] = useState(0)
  const [zonas, setZonas] = useState([])
  const [borrador, setBorrador] = useState(FILTROS_VACIOS)
  const [aplicados, setAplicados] = useState(FILTROS_VACIOS)
  const [errorFiltro, setErrorFiltro] = useState('')
  const [resultado, setResultado] = useState({ clave: null, publicaciones: [], error: '' })

  const clave = `${JSON.stringify(aplicados)}:${version}`

  useEffect(() => {
    let activo = true
    listarZonas()
      .then((lista) => activo && setZonas(lista))
      .catch(() => activo && setZonas([]))
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    let activo = true
    listarModeracion(aParametros(aplicados))
      .then((publicaciones) => activo && setResultado({ clave, publicaciones, error: '' }))
      .catch(
        (err) =>
          activo && setResultado({ clave, publicaciones: [], error: mensajeDeError(err) }),
      )
    return () => {
      activo = false
    }
  }, [aplicados, clave])

  const cargando = resultado.clave !== clave
  const publicaciones = cargando ? [] : resultado.publicaciones
  const error = cargando ? '' : resultado.error
  const recargar = () => setVersion((v) => v + 1)

  const cambiarFiltro = (e) => setBorrador((f) => ({ ...f, [e.target.name]: e.target.value }))

  const aplicar = (e) => {
    e.preventDefault()
    if (borrador.desde && borrador.hasta && borrador.desde > borrador.hasta) {
      setErrorFiltro('La fecha inicial no puede ser posterior a la final')
      return
    }
    setErrorFiltro('')
    setAplicados(borrador)
  }

  const limpiar = () => {
    setErrorFiltro('')
    setBorrador(FILTROS_VACIOS)
    setAplicados(FILTROS_VACIOS)
  }

  const reemplazar = (actualizada) =>
    setResultado((prev) => ({
      ...prev,
      publicaciones: prev.publicaciones.map((p) =>
        p._id === actualizada._id ? { ...actualizada, denuncias: p.denuncias } : p,
      ),
    }))

  const quitar = (id) =>
    setResultado((prev) => ({
      ...prev,
      publicaciones: prev.publicaciones.filter((p) => p._id !== id),
    }))

  return (
    <>
      <p className="muted">
        Publicaciones activas, con las más denunciadas primero. Puedes retirar las que incumplan las
        normas; la acción queda auditada.
      </p>

      <form className="card stack" onSubmit={aplicar}>
        <div className="grid">
          <div className="field">
            <label className="field__label" htmlFor="mod-zona">
              Zona
            </label>
            <select id="mod-zona" name="zona" className="input" value={borrador.zona} onChange={cambiarFiltro}>
              <option value="">Todas las zonas</option>
              {zonas.map((z) => (
                <option key={z._id} value={z._id}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="mod-desde">
              Desde
            </label>
            <input id="mod-desde" name="desde" type="date" className="input" value={borrador.desde} onChange={cambiarFiltro} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="mod-hasta">
              Hasta
            </label>
            <input id="mod-hasta" name="hasta" type="date" className="input" value={borrador.hasta} onChange={cambiarFiltro} />
          </div>
        </div>

        {errorFiltro && (
          <p className="alert alert--error" role="alert">
            {errorFiltro}
          </p>
        )}

        <div className="row">
          <button type="submit" className="btn btn--secondary">
            Aplicar filtros
          </button>
          <button type="button" className="btn btn--ghost" onClick={limpiar}>
            Limpiar
          </button>
        </div>
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
          <button type="button" className="btn btn--primary" onClick={recargar}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && publicaciones.length === 0 && (
        <div className="card state">
          <p className="state__title">Sin publicaciones</p>
          <p>No hay publicaciones activas con estos filtros.</p>
        </div>
      )}

      {publicaciones.map((p) => (
        <PostCard key={p._id} post={p} moderacion onActualizada={reemplazar} onRetirada={quitar} />
      ))}
    </>
  )
}

export default function GestorPage() {
  const [vista, setVista] = useState('zonas')

  return (
    <div className="page">
      <div>
        <h1 className="page__title">Panel del gestor</h1>
        <p className="page__subtitle">Zonas, disputas de reportes y moderación del feed.</p>
      </div>

      <div className="chips" role="group" aria-label="Secciones del panel">
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

      {vista === 'zonas' && <SeccionZonas />}
      {vista === 'disputas' && <SeccionDisputas />}
      {vista === 'moderacion' && <SeccionModeracion />}
    </div>
  )
}