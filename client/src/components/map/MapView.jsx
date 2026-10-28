// client/src/components/map/MapView.jsx
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../../context/ThemeContext.jsx'

const CENTRO_BOGOTA = [4.711, -74.0721]

const ATRIBUCION = 'Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors'

const BASE_ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'

const TEJAS = {
  dark: {
    base: `${BASE_ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    etiquetas: `${BASE_ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  },
  light: {
    base: `${BASE_ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    etiquetas: `${BASE_ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  },
}

const ZOOM_NATIVO_MAXIMO = 16
const ZOOM_MAXIMO = 19

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
  const tejas = TEJAS[theme] ?? TEJAS.dark

  return (
    <div className="map-box">
      <MapContainer
        center={CENTRO_BOGOTA}
        zoom={13}
        maxZoom={ZOOM_MAXIMO}
        scrollWheelZoom
        className="map-box__map"
      >
        <TileLayer
          key={`base-${theme}`}
          url={tejas.base}
          attribution={ATRIBUCION}
          maxNativeZoom={ZOOM_NATIVO_MAXIMO}
          maxZoom={ZOOM_MAXIMO}
        />
        <TileLayer
          key={`etiquetas-${theme}`}
          url={tejas.etiquetas}
          maxNativeZoom={ZOOM_NATIVO_MAXIMO}
          maxZoom={ZOOM_MAXIMO}
        />
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