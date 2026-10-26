import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../../context/ThemeContext.jsx'

const CENTRO_BOGOTA = [4.711, -74.0721]

const ATRIBUCION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

const TEJAS = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
}

function CapturaClics({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  return null
}

function CentrarEnPosicion({ position }) {
  const map = useMap()
  const centrado = useRef(false)

  useEffect(() => {
    if (position && !centrado.current) {
      centrado.current = true
      map.setView([position.lat, position.lng], 15)
    }
  }, [position, map])

  return null
}

export default function MapView({ position, onMapClick, centrarEnUsuario = true, children }) {
  const { theme } = useTheme()

  return (
    <div className="map-box">
      <MapContainer center={CENTRO_BOGOTA} zoom={13} scrollWheelZoom className="map-box__map">
        <TileLayer key={theme} url={TEJAS[theme] ?? TEJAS.dark} attribution={ATRIBUCION} />
        {onMapClick && <CapturaClics onMapClick={onMapClick} />}
        {centrarEnUsuario && <CentrarEnPosicion position={position} />}
        {position && (
          <CircleMarker
            center={[position.lat, position.lng]}
            radius={8}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#0b5cd5', fillOpacity: 1 }}
          />
        )}
        {children}
      </MapContainer>
    </div>
  )
}