import { useEffect, useState } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import MapView from '../../components/map/MapView.jsx'
import { buscarSitios } from '../../api/places.js'
import { mensajeDeError } from '../../api/client.js'
import { useGeolocation } from '../../hooks/useGeolocation.js'

const CATEGORIAS = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'turistica', etiqueta: 'Turísticos' },
  { valor: 'cultural', etiqueta: 'Culturales' },
]

const ETIQUETA_TIPO = { turistica: 'Turístico', cultural: 'Cultural' }

const ESTILO_MARCADOR = { color: '#ffffff', weight: 2, fillColor: '#0b5cd5', fillOpacity: 1 }

export default function PlacesPage() {
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState({ q: '', categoria: '', intento: 0 })
  const [resultado, setResultado] = useState({ clave: null, sitios: [], error: '' })
  const { position } = useGeolocation()

  const clave = JSON.stringify(busqueda)

  useEffect(() => {
    let activo = true
    const params = {}
    if (busqueda.q) params.q = busqueda.q
    if (busqueda.categoria) params.categoria = busqueda.categoria

    buscarSitios(params)
      .then((sitios) => activo && setResultado({ clave, sitios, error: '' }))
      .catch((err) => activo && setResultado({ clave, sitios: [], error: mensajeDeError(err) }))
    return () => {
      activo = false
    }
  }, [clave, busqueda.q, busqueda.categoria])

  const cargando = resultado.clave !== clave
  const sitios = cargando ? [] : resultado.sitios
  const error = cargando ? '' : resultado.error

  const buscar = (e) => {
    e.preventDefault()
    setBusqueda((b) => ({ ...b, q: texto.trim() }))
  }

  const elegirCategoria = (categoria) => setBusqueda((b) => ({ ...b, categoria }))

  return (
    <div className="page">
      <div>
        <h1 className="page__title">Sitios turísticos y culturales</h1>
        <p className="page__subtitle">Cada sitio muestra el nivel de seguridad de su zona.</p>
      </div>

      <form className="row" onSubmit={buscar} role="search">
        <div className="field" style={{ flex: 1, minWidth: '12rem' }}>
          <label className="sr-only" htmlFor="busqueda">
            Buscar por nombre
          </label>
          <input
            id="busqueda"
            type="search"
            className="input"
            placeholder="Buscar por nombre"
            value={texto}
            maxLength={60}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn--primary">
          Buscar
        </button>
      </form>

      <div className="chips" role="group" aria-label="Filtrar por categoría">
        {CATEGORIAS.map((c) => (
          <button
            key={c.valor}
            type="button"
            className="chip"
            aria-pressed={busqueda.categoria === c.valor}
            onClick={() => elegirCategoria(c.valor)}
          >
            {c.etiqueta}
          </button>
        ))}
      </div>

      <MapView position={position}>
        {sitios.map((s) => (
          <CircleMarker
            key={s._id}
            center={[s.centro.lat, s.centro.lng]}
            radius={9}
            pathOptions={ESTILO_MARCADOR}
          >
            <Popup>
              <strong>{s.nombre}</strong>
              <br />
              {ETIQUETA_TIPO[s.tipo] ?? s.tipo} · seguridad {s.nivelSeguridad} de 5
            </Popup>
          </CircleMarker>
        ))}
      </MapView>

      {cargando && (
        <div className="state" role="status">
          <div className="spinner" aria-hidden="true" />
          <p>Buscando sitios…</p>
        </div>
      )}

      {error && (
        <div className="card state" role="alert">
          <p className="state__title">No se pudo completar la búsqueda</p>
          <p>{error}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setBusqueda((b) => ({ ...b, intento: b.intento + 1 }))}
          >
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && sitios.length === 0 && (
        <div className="card state">
          <p className="state__title">Sin resultados</p>
          <p>Prueba con otro nombre o cambia la categoría.</p>
        </div>
      )}

      {sitios.length > 0 && (
        <ul className="list">
          {sitios.map((s) => (
            <li key={s._id} className="list__item">
              <div>
                <strong>{s.nombre}</strong>
                <p className="muted">{ETIQUETA_TIPO[s.tipo] ?? s.tipo}</p>
                {s.descripcion && <p>{s.descripcion}</p>}
              </div>
              <span className="badge">Seguridad {s.nivelSeguridad} de 5</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}