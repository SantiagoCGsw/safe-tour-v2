// client/src/components/map/DestinoPicker.jsx
import { useEffect, useMemo, useState } from 'react'
import { buscarSitios } from '../../api/places.js'
import { buscarDirecciones } from '../../api/routing.js'
import { mensajeDeError } from '../../api/client.js'
import { DESTINOS_TURISTICOS } from '../../data/destinosTuristicos.js'

const MODOS = [
  { valor: 'sitios', etiqueta: 'Sitios' },
  { valor: 'mapa', etiqueta: 'En el mapa' },
  { valor: 'direccion', etiqueta: 'Dirección' },
]

const ETIQUETA_TIPO = { turistica: 'Turístico', cultural: 'Cultural' }

const normalizar = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// Sitios subidos a la plataforma (zonas turísticas y culturales) más los destinos fijos de la
// lista, sin repetir los que ya existen con el mismo nombre.
const armarCatalogo = (sitiosApi) => {
  const delServidor = sitiosApi.map((s) => ({
    id: `zona-${s._id}`,
    nombre: s.nombre,
    categoria: ETIQUETA_TIPO[s.tipo] ?? s.tipo,
    lat: s.centro.lat,
    lng: s.centro.lng,
  }))
  const nombres = new Set(delServidor.map((s) => normalizar(s.nombre)))
  const fijos = DESTINOS_TURISTICOS.filter((s) => !nombres.has(normalizar(s.nombre)))

  return [...delServidor, ...fijos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

const BUSQUEDA_INICIAL = { estado: 'inicial', resultados: [], error: '' }

export default function DestinoPicker({ eligiendoEnMapa, onEligirEnMapa, onElegir }) {
  const [modo, setModo] = useState('sitios')
  const [sitiosApi, setSitiosApi] = useState([])
  const [texto, setTexto] = useState('')
  const [direccion, setDireccion] = useState('')
  const [busqueda, setBusqueda] = useState(BUSQUEDA_INICIAL)

  useEffect(() => {
    let activo = true

    buscarSitios()
      .then((sitios) => {
        if (activo) setSitiosApi(sitios)
      })
      .catch(() => {
        // Sin conexión con el servidor se siguen ofreciendo los destinos fijos de la lista.
      })

    return () => {
      activo = false
    }
  }, [])

  const catalogo = useMemo(() => armarCatalogo(sitiosApi), [sitiosApi])

  const coincidencias = useMemo(() => {
    const aguja = normalizar(texto.trim())
    if (!aguja) return catalogo
    return catalogo.filter((s) => normalizar(`${s.nombre} ${s.categoria}`).includes(aguja))
  }, [catalogo, texto])

  const cambiarModo = (valor) => {
    setModo(valor)
    if (valor !== 'mapa') onEligirEnMapa(false)
  }

  const buscarDireccion = async (evento) => {
    evento.preventDefault()
    const consulta = direccion.trim()
    if (consulta.length < 3) return

    setBusqueda({ estado: 'cargando', resultados: [], error: '' })

    try {
      const resultados = await buscarDirecciones(consulta)
      setBusqueda({ estado: 'listo', resultados, error: '' })
    } catch (err) {
      setBusqueda({
        estado: 'error',
        resultados: [],
        error: mensajeDeError(err, 'No se pudo buscar la dirección'),
      })
    }
  }

  return (
    <div className="stack">
      <div className="chips" role="group" aria-label="Cómo elegir el destino">
        {MODOS.map((m) => (
          <button
            key={m.valor}
            type="button"
            className="chip"
            aria-pressed={modo === m.valor}
            onClick={() => cambiarModo(m.valor)}
          >
            {m.etiqueta}
          </button>
        ))}
      </div>

      {modo === 'sitios' && (
        <>
          <div className="field">
            <label className="sr-only" htmlFor="buscar-destino">
              Buscar un sitio
            </label>
            <input
              id="buscar-destino"
              type="search"
              className="input"
              placeholder="Buscar un sitio por nombre"
              value={texto}
              maxLength={60}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>

          {coincidencias.length === 0 ? (
            <p className="muted">No hay sitios con ese nombre.</p>
          ) : (
            <ul className="list" style={{ maxHeight: '14rem', overflowY: 'auto' }}>
              {coincidencias.map((s) => (
                <li key={s.id} className="list__item">
                  <div>
                    <strong>{s.nombre}</strong>
                    <p className="muted">{s.categoria}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => onElegir(s)}
                  >
                    Elegir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {modo === 'mapa' && (
        <>
          {eligiendoEnMapa && (
            <p className="alert alert--info" role="status">
              Toca el mapa para fijar el destino.
            </p>
          )}

          <button
            type="button"
            className="btn btn--secondary"
            aria-pressed={eligiendoEnMapa}
            onClick={() => onEligirEnMapa(!eligiendoEnMapa)}
          >
            {eligiendoEnMapa ? 'Cancelar selección' : 'Elegir destino en el mapa'}
          </button>
        </>
      )}

      {modo === 'direccion' && (
        <>
          <form className="row" onSubmit={buscarDireccion} role="search">
            <div className="field" style={{ flex: 1, minWidth: '12rem' }}>
              <label className="sr-only" htmlFor="buscar-direccion">
                Dirección
              </label>
              <input
                id="buscar-direccion"
                type="search"
                className="input"
                placeholder="Ej: Carrera 7 # 32-16, Bogotá"
                value={direccion}
                maxLength={100}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={direccion.trim().length < 3 || busqueda.estado === 'cargando'}
            >
              {busqueda.estado === 'cargando' ? 'Buscando…' : 'Buscar'}
            </button>
          </form>

          {busqueda.estado === 'error' && (
            <p className="alert alert--error" role="alert">
              {busqueda.error}
            </p>
          )}

          {busqueda.estado === 'listo' && busqueda.resultados.length === 0 && (
            <p className="muted">
              No se encontró esa dirección. Prueba agregando el barrio o la ciudad.
            </p>
          )}

          {busqueda.resultados.length > 0 && (
            <ul className="list">
              {busqueda.resultados.map((r) => (
                <li key={`${r.lat},${r.lng},${r.nombre}`} className="list__item">
                  <strong>{r.nombre}</strong>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => onElegir({ nombre: r.nombre, lat: r.lat, lng: r.lng })}
                  >
                    Elegir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
