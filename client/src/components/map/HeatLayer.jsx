import { CircleMarker } from 'react-leaflet'

const ESTILO = {
  stroke: false,
  fillColor: '#f04438',
  fillOpacity: 0.16,
}

export default function HeatLayer({ puntos }) {
  return (
    <>
      {puntos.map((p, i) => (
        <CircleMarker
          key={`${p.lat}-${p.lng}-${i}`}
          center={[p.lat, p.lng]}
          radius={26}
          pathOptions={ESTILO}
          interactive={false}
        />
      ))}
    </>
  )
}