import { useEffect, useState } from 'react'
import { Polygon, Polyline, CircleMarker } from 'react-leaflet'
import MapView from '../../components/map/MapView.jsx'
import ZoneLayer from '../../components/map/ZoneLayer.jsx'
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx'
import { listarZonas, crearZona, actualizarZona, desactivarZona } from '../../api/zones.js'
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

const BORRADOR_NUEVO = {
  id: null,
  nombre: '',
  descripcion: '',
  tipo: 'turistica',
  nivelSeguridad: 3,
  puntos: [],
}

const ESTILO_BORRADOR = { color: '#5aa2ff', weight: 3, dashArray: '6 6', fillOpacity: 0.15 }

export default function GestorPage() {
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
    <div className="page">
      <div className="row row--between">
        <div>
          <h1 className="page__title">Gestión de zonas</h1>
          <p className="page__subtitle">Crea, edita y desactiva zonas del mapa.</p>
        </div>
        {!editor && (
          <button type="button" className="btn btn--primary" onClick={abrirNueva}>
            Nueva zona
          </button>
        )}
      </div>

      {aviso.texto && (
        <p
          className={`alert ${aviso.tipo === 'error' ? 'alert--error' : 'alert--success'}`}
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
        >
          {aviso.texto}
        </p>
      )}

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
    </div>
  )
}