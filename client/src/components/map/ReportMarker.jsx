import { CircleMarker, Popup } from 'react-leaflet'

const COLOR_TIPO = {
  accidente: '#f79009',
  robo: '#d92d20',
  obra: '#eab308',
  peligro: '#c11574',
  turismo: '#0b5cd5',
}

const ETIQUETA_TIPO = {
  accidente: 'Accidente',
  robo: 'Robo',
  obra: 'Obra',
  peligro: 'Peligro',
  turismo: 'Turismo',
}

export default function ReportMarker({ reportes }) {
  return (
    <>
      {reportes.map((r) => (
        <CircleMarker
          key={r._id}
          center={[r.ubicacion.lat, r.ubicacion.lng]}
          radius={7}
          pathOptions={{
            color: '#ffffff',
            weight: 2,
            fillColor: COLOR_TIPO[r.tipo] ?? '#667085',
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>{r.titulo}</strong>
            <br />
            {ETIQUETA_TIPO[r.tipo] ?? r.tipo} · {new Date(r.createdAt).toLocaleString('es-CO')}
            {r.descripcion && (
              <>
                <br />
                {r.descripcion}
              </>
            )}
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}