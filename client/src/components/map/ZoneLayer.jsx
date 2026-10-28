import { useEffect, useRef } from 'react'
import { Polygon, Popup, useMap } from 'react-leaflet'
import { COLORES, ETIQUETA_TIPO, RIESGO } from './zonaEstilos.js'


// Lleva el mapa a las zonas cuando cambia el conjunto mostrado, para que los polígonos queden a
// la vista aunque estén lejos de la ubicación del usuario.
function AjustarAZonas({ zonas }) {
  const map = useMap()
  const ultimaClave = useRef('')
  const clave = zonas.map((zona) => zona._id).join(',')

  useEffect(() => {
    if (!clave || clave === ultimaClave.current) return
    ultimaClave.current = clave

    const puntos = zonas.flatMap((zona) => zona.coordenadas.map((p) => [p.lat, p.lng]))
    map.fitBounds(puntos, { padding: [32, 32], maxZoom: 16 })
  }, [clave, zonas, map])

  return null
}

export default function ZoneLayer({ zonas, onSelect, ajustar = false }) {
  return (
    <>
      {ajustar && <AjustarAZonas zonas={zonas} />}
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
              {ETIQUETA_TIPO[zona.tipo] ?? zona.tipo} · Nivel {zona.nivelSeguridad} de 5 (
              {RIESGO[zona.nivelSeguridad]})
              {zona.descripcion && (
                <>
                  <br />
                  {zona.descripcion}
                </>
              )}
            </Popup>
          </Polygon>
        )
      })}
    </>
  )
}
