// client/src/components/map/RoutePanel.jsx
import { useState } from 'react'
import { CircleMarker, Polyline } from 'react-leaflet'
import { calcularRutas } from '../../api/routing.js'
import { mensajeDeError } from '../../api/client.js'

const MODOS = [
  { valor: 'a-pie', etiqueta: 'A pie' },
  { valor: 'transporte-publico', etiqueta: 'Transporte público' },
  { valor: 'vehiculo', etiqueta: 'Vehículo' },
  { valor: 'bicicleta', etiqueta: 'Bicicleta' },
]

const RIESGO = {
  alto: { etiqueta: 'Riesgo alto', clase: 'badge--danger' },
  medio: { etiqueta: 'Riesgo medio', clase: 'badge--warn' },
  bajo: { etiqueta: 'Riesgo bajo', clase: 'badge--ok' },
}

const COLORES_RUTA = ['#0b5cd5', '#16a34a', '#f79009']

const formatearDuracion = (segundos) => {
  const minutos = Math.max(1, Math.round(segundos / 60))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto > 0 ? `${horas} h ${resto} min` : `${horas} h`
}

const formatearDistancia = (metros) =>
  metros < 1000 ? `${metros} m` : `${(metros / 1000).toFixed(1)} km`

export function RutaLayer({ rutas, indice, destino }) {
  return (
    <>
      {rutas.map((ruta, i) => {
        const activa = i === indice
        return (
          <Polyline
            key={ruta.nombre}
            positions={ruta.coordenadas.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: COLORES_RUTA[i] ?? COLORES_RUTA[0],
              weight: activa ? 6 : 3,
              opacity: activa ? 0.9 : 0.5,
              dashArray: activa ? undefined : '8 8',
            }}
          />
        )
      })}
      {destino && (
        <CircleMarker
          center={[destino.lat, destino.lng]}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#d92d20', fillOpacity: 1 }}
        />
      )}
    </>
  )
}

export default function RoutePanel({
  position,
  destino,
  eligiendoDestino,
  onEligirDestino,
  resultado,
  indice,
  onIndice,
  onResultado,
  onLimpiar,
}) {
  const [modo, setModo] = useState('a-pie')
  const [calculando, setCalculando] = useState(false)
  const [error, setError] = useState('')

  const puedeCalcular = Boolean(position && destino) && !calculando

  const cambiarModo = (valor) => {
    setModo(valor)
    setError('')
    if (resultado) onResultado(null)
  }

  const calcular = async () => {
    setError('')
    setCalculando(true)
    try {
      const datos = await calcularRutas({
        origen: { lat: position.lat, lng: position.lng },
        destino: { lat: destino.lat, lng: destino.lng },
        modo,
      })
      onResultado(datos)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo calcular la ruta'))
    } finally {
      setCalculando(false)
    }
  }

  const limpiar = () => {
    setError('')
    onLimpiar()
  }

  return (
    <section className="card stack" aria-labelledby="ruta-titulo">
      <h2 id="ruta-titulo" className="card__title">
        Ruta segura
      </h2>

      <div className="chips" role="group" aria-label="Modo de transporte">
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

      {position ? (
        <p className="muted">Origen: tu ubicación actual.</p>
      ) : (
        <p className="alert alert--error" role="status">
          Necesitamos tu ubicación para calcular la ruta.
        </p>
      )}

      <p className="muted">
        {destino
          ? `Destino: ${destino.lat.toFixed(5)}, ${destino.lng.toFixed(5)}`
          : 'Aún no elegiste un destino.'}
      </p>

      {eligiendoDestino && (
        <p className="alert alert--info" role="status">
          Toca el mapa para fijar el destino.
        </p>
      )}

      <div className="row">
        <button
          type="button"
          className="btn btn--secondary"
          aria-pressed={eligiendoDestino}
          onClick={() => onEligirDestino(!eligiendoDestino)}
        >
          {eligiendoDestino ? 'Cancelar selección' : 'Elegir destino en el mapa'}
        </button>
        <button type="button" className="btn btn--primary" onClick={calcular} disabled={!puedeCalcular}>
          {calculando ? 'Calculando…' : 'Calcular ruta'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={limpiar}
          disabled={calculando || (!destino && !resultado)}
        >
          Limpiar
        </button>
      </div>

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      {resultado && (
        <>
          {resultado.aproximado && (
            <p className="alert alert--info" role="status">
              En transporte público la ruta se calcula sobre la red vial, por lo que el recorrido y
              el tiempo son aproximados.
            </p>
          )}

          <ul className="list">
            {resultado.rutas.map((ruta, i) => (
              <li key={ruta.nombre} className="list__item">
                <div>
                  <strong>{ruta.nombre}</strong>
                  <p className="muted">
                    {formatearDuracion(ruta.duracionS)} · {formatearDistancia(ruta.distanciaM)}
                  </p>
                </div>
                <span className={`badge ${RIESGO[ruta.riesgo].clase}`}>
                  {RIESGO[ruta.riesgo].etiqueta}
                </span>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  aria-pressed={i === indice}
                  onClick={() => onIndice(i)}
                >
                  {i === indice ? 'En el mapa' : 'Ver en el mapa'}
                </button>
              </li>
            ))}
          </ul>

          {resultado.rutas.length === 1 && (
            <p className="muted">
              No se generó una ruta alterna: no hay zonas de riesgo alto activas o no fue posible
              evitarlas.
            </p>
          )}
        </>
      )}
    </section>
  )
}