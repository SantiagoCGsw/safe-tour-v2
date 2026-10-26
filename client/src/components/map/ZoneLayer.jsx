import { Polygon, Popup } from 'react-leaflet'

const COLORES = {
  1: '#d92d20',
  2: '#f79009',
  3: '#eab308',
  4: '#65a30d',
  5: '#16a34a',
}

const RIESGO = {
  1: 'riesgo muy alto',
  2: 'riesgo alto',
  3: 'riesgo medio',
  4: 'riesgo bajo',
  5: 'riesgo muy bajo',
}

export default function ZoneLayer({ zonas, onSelect }) {
  return (
    <>
      {zonas.map((zona) => {
        const color = COLORES[zona.nivelSeguridad] ?? COLORES[3]
        return (
          <Polygon
            key={zona._id}
            positions={zona.coordenadas.map((p) => [p.lat, p.lng])}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 2 }}
            eventHandlers={{ click: () => onSelect?.(zona) }}
          >
            <Popup>
              <strong>{zona.nombre}</strong>
              <br />
              Nivel {zona.nivelSeguridad} de 5 ({RIESGO[zona.nivelSeguridad]})
            </Popup>
          </Polygon>
        )
      })}
    </>
  )
}