import { useEffect, useState } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import MapView from '../../components/map/MapView.jsx'
import RoutePanel, { RutaLayer } from '../../components/map/RoutePanel.jsx'
import { buscarSitios } from '../../api/places.js'
import { mensajeDeError } from '../../api/client.js'
import { useGeolocation } from '../../hooks/useGeolocation.js'
import { DESTINOS_TURISTICOS } from '../../data/destinosTuristicos.js'

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
  const [destino, setDestino] = useState(null)
  const [eligiendoDestino, setEligiendoDestino] = useState(false)
  const [rutaResultado, setRutaResultado] = useState(null)
  const [rutaIndice, setRutaIndice] = useState(0)
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

  const alElegirDestino = (punto) => {
    setDestino({
      lat: Number(punto.lat),
      lng: Number(punto.lng),
      nombre: punto.nombre ?? 'Destino seleccionado',
      categoria: punto.categoria ?? '',
    })
    setEligiendoDestino(false)
    setRutaResultado(null)
    setRutaIndice(0)
  }

  const seleccionarSitioTuristico = (id) => {
    const sitio = DESTINOS_TURISTICOS.find((item) => item.id === id)
    if (sitio) alElegirDestino(sitio)
  }

  const alResultadoRuta = (datos) => {
    setRutaResultado(datos)
    setRutaIndice(0)
  }

  const limpiarRuta = () => {
    setDestino(null)
    setEligiendoDestino(false)
    setRutaResultado(null)
    setRutaIndice(0)
  }

  const sitioSeleccionado = DESTINOS_TURISTICOS.find(
    (sitio) => sitio.lat === destino?.lat && sitio.lng === destino?.lng,
  )

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

      <section className="card stack" aria-labelledby="destinos-turisticos-titulo">
        <h2 id="destinos-turisticos-titulo" className="card__title">
          Lugares turísticos
        </h2>

        <label htmlFor="destino-turistico">Selecciona un destino</label>

        <select
          id="destino-turistico"
          className="input"
          value={sitioSeleccionado?.id ?? ''}
          onChange={(event) => seleccionarSitioTuristico(event.target.value)}
        >
          <option value="">Elige un lugar turístico</option>

          {DESTINOS_TURISTICOS.map((sitio) => (
            <option key={sitio.id} value={sitio.id}>
              {sitio.nombre} · {sitio.categoria}
            </option>
          ))}
        </select>

        <p className="muted">También puedes seleccionar un punto tocando el mapa.</p>
      </section>

      <MapView position={position} onMapClick={eligiendoDestino ? alElegirDestino : undefined}>
        <RutaLayer rutas={rutaResultado?.rutas ?? []} indice={rutaIndice} destino={destino} />
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

      <RoutePanel
        position={position}
        destino={destino}
        eligiendoDestino={eligiendoDestino}
        onEligirDestino={setEligiendoDestino}
        resultado={rutaResultado}
        indice={rutaIndice}
        onIndice={setRutaIndice}
        onResultado={alResultadoRuta}
        onLimpiar={limpiarRuta}
      />

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