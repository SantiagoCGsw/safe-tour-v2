
import { CircleMarker, Popup } from 'react-leaflet'
import { DESTINOS_TURISTICOS } from '../../data/destinosTuristicos.js'

export default function TouristPlacesLayer({ onSelect }) {
  return (
    <>
      {DESTINOS_TURISTICOS.map((sitio) => (
        <CircleMarker
          key={sitio.id}
          center={[sitio.lat, sitio.lng]}
          radius={7}
          pathOptions={{
            color: '#ffffff',
            weight: 2,
            fillColor: '#0b5cd5',
            fillOpacity: 1,
          }}
        >
          <Popup>
            <div>
              <strong>{sitio.nombre}</strong>
              <p>{sitio.categoria}</p>
              <button
                type="button"
                onClick={() => onSelect?.(sitio)}
              >
                Elegir como destino
              </button>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}
