
import { useEffect, useMemo, useRef, useState } from 'react'
import MapView from '../../components/map/MapView.jsx'
import ZoneLayer from '../../components/map/ZoneLayer.jsx'
import HeatLayer from '../../components/map/HeatLayer.jsx'
import ReportMarker from '../../components/map/ReportMarker.jsx'
import TouristPlacesLayer from '../../components/map/TouristPlacesLayer.jsx'
import RoutePanel, { RutaLayer } from '../../components/map/RoutePanel.jsx'
import ReportForm from '../../components/reports/ReportForm.jsx'
import Modal from '../../components/common/Modal.jsx'
import { listarZonas } from '../../api/zones.js'
import { listarReportes, mapaDeCalor } from '../../api/reports.js'
import { mensajeDeError } from '../../api/client.js'
import { useGeolocation } from '../../hooks/useGeolocation.js'
import { dentroDelPoligono, useGeofence } from '../../hooks/useGeofence.js'

const TIPOS = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'turistica', etiqueta: 'Turísticas' },
  { valor: 'cultural', etiqueta: 'Culturales' },
  { valor: 'peligrosa', etiqueta: 'Peligrosas' },
  { valor: 'segura', etiqueta: 'Seguras' },
]

const AVISO_UBICACION = {
  pendiente: 'Buscando tu ubicación...',
  denegada: 'No diste permiso de ubicación. Puedes ver las zonas, pero no tu posición.',
  error: 'No se pudo obtener tu ubicación.',
  'no-soportado': 'Este dispositivo no permite obtener la ubicación.',
}

const ESTADOS_EN_MAPA = ['confirmado', 'publicado']

const RIESGO = {
  alto: { etiqueta: 'Riesgo alto', clase: 'badge--danger' },
  medio: { etiqueta: 'Riesgo medio', clase: 'badge--warn' },
  bajo: { etiqueta: 'Riesgo bajo', clase: 'badge--ok' },
}

const ORDEN_RIESGO = { alto: 0, medio: 1, bajo: 2 }

const TIPO_REPORTE = {
  accidente: 'accidentes',
  robo: 'robos',
  obra: 'obras o cierres',
  peligro: 'zonas peligrosas',
  turismo: 'información turística',
}

const CLAVE_SENSIBILIDAD = 'safe-tour-alertas'

const SENSIBILIDADES = [
  { valor: 'alto', etiqueta: 'Solo riesgo alto' },
  { valor: 'medio', etiqueta: 'Riesgo medio y alto' },
]

const leerSensibilidad = () => {
  try {
    return localStorage.getItem(CLAVE_SENSIBILIDAD) === 'medio'
      ? 'medio'
      : 'alto'
  } catch {
    return 'alto'
  }
}

const guardarSensibilidad = (valor) => {
  try {
    localStorage.setItem(CLAVE_SENSIBILIDAD, valor)
  } catch {
    // El almacenamiento local puede estar deshabilitado.
  }
}

const leerPermiso = () =>
  typeof Notification === 'undefined'
    ? 'no-soportado'
    : Notification.permission

const riesgoDeZona = (zona, resumen) => {
  if (zona.nivelSeguridad <= 1) return 'alto'

  const fila = resumen.find(
    (r) => String(r.zonaId) === String(zona._id),
  )

  return fila?.riesgo ?? 'bajo'
}

const tipoPredominante = (zona, reportes) => {
  const conteo = {}

  for (const reporte of reportes) {
    if (
      reporte.ubicacion &&
      dentroDelPoligono(reporte.ubicacion, zona.coordenadas)
    ) {
      conteo[reporte.tipo] = (conteo[reporte.tipo] ?? 0) + 1
    }
  }

  const orden = Object.entries(conteo).sort(
    (a, b) => b[1] - a[1],
  )

  return orden[0]?.[0] ?? null
}

export default function MapPage() {
  const [tipo, setTipo] = useState('')
  const [recarga, setRecarga] = useState(0)

  const [resultado, setResultado] = useState({
    clave: null,
    zonas: [],
    mapa: null,
    reportes: null,
    error: '',
  })

  const [seleccionada, setSeleccionada] = useState(null)
  const [formAbierto, setFormAbierto] = useState(false)
  const [aviso, setAviso] = useState('')
  const [destino, setDestino] = useState(null)
  const [eligiendoDestino, setEligiendoDestino] = useState(false)
  const [rutaResultado, setRutaResultado] = useState(null)
  const [rutaIndice, setRutaIndice] = useState(0)
  const [sensibilidad, setSensibilidad] = useState(leerSensibilidad)
  const [permiso, setPermiso] = useState(leerPermiso)

  const notificadas = useRef(new Set())
  const { position, status } = useGeolocation()

  const clave = `${tipo}:${recarga}`

  useEffect(() => {
    let activo = true

    Promise.all([
      listarZonas(tipo ? { tipo } : {}),
      mapaDeCalor().catch(() => null),
      listarReportes({ limite: 100 }).catch(() => null),
    ])
      .then(([zonas, mapa, reportes]) => {
        if (activo) {
          setResultado({
            clave,
            zonas,
            mapa,
            reportes,
            error: '',
          })
        }
      })
      .catch((err) => {
        if (activo) {
          setResultado({
            clave,
            zonas: [],
            mapa: null,
            reportes: null,
            error: mensajeDeError(err),
          })
        }
      })

    return () => {
      activo = false
    }
  }, [clave, tipo])

  const cargando = resultado.clave !== clave
  const zonas = cargando ? [] : resultado.zonas
  const error = cargando ? '' : resultado.error
  const mapa = cargando ? null : resultado.mapa

  const reportesMapa = useMemo(
    () =>
      cargando
        ? []
        : (resultado.reportes ?? []).filter((r) =>
            ESTADOS_EN_MAPA.includes(r.estado),
          ),
    [cargando, resultado.reportes],
  )

  const cargaParcial =
    !cargando &&
    !error &&
    (resultado.mapa === null || resultado.reportes === null)

  const zonasActuales = useGeofence(position, zonas)

  const alertas = useMemo(() => {
    const resumen = mapa?.zonas ?? []

    return zonasActuales
      .map((zona) => ({
        zona,
        riesgo: riesgoDeZona(zona, resumen),
      }))
      .filter(
        ({ riesgo }) =>
          riesgo === 'alto' ||
          (sensibilidad === 'medio' && riesgo === 'medio'),
      )
      .map(({ zona, riesgo }) => {
        const predominante = tipoPredominante(zona, reportesMapa)

        const detalle = predominante
          ? `Predominan reportes de ${TIPO_REPORTE[predominante] ?? predominante}.`
          : 'No hay reportes vigentes para esta zona.'

        return {
          id: String(zona._id),
          riesgo,
          mensaje: `Estás en ${zona.nombre}: riesgo ${riesgo}. ${detalle}`,
        }
      })
  }, [zonasActuales, mapa, reportesMapa, sensibilidad])

  useEffect(() => {
    const vigentes = new Set(alertas.map((a) => a.id))

    for (const id of [...notificadas.current]) {
      if (!vigentes.has(id)) notificadas.current.delete(id)
    }

    if (
      permiso !== 'granted' ||
      typeof Notification === 'undefined'
    ) {
      return
    }

    for (const alerta of alertas) {
      if (notificadas.current.has(alerta.id)) continue

      notificadas.current.add(alerta.id)

      try {
        new Notification(`Zona de riesgo ${alerta.riesgo}`, {
          body: alerta.mensaje,
          tag: `safe-tour-${alerta.id}`,
        })
      } catch {
        // El navegador puede bloquear notificaciones.
      }
    }
  }, [alertas, permiso])

  const riesgoPorZona = mapa
    ? [...(mapa.zonas ?? [])].sort(
        (a, b) =>
          (ORDEN_RIESGO[a.riesgo] ?? 3) -
            (ORDEN_RIESGO[b.riesgo] ?? 3) ||
          (b.reportes ?? 0) - (a.reportes ?? 0),
      )
    : []

  const alCrearReporte = (reporte) => {
    setFormAbierto(false)

    setAviso(
      reporte.estado === 'pendiente'
        ? 'Reporte enviado. Queda pendiente de validación y aún no cuenta en el mapa.'
        : 'Reporte publicado.',
    )

    setRecarga((n) => n + 1)
  }

  const cambiarSensibilidad = (valor) => {
    setSensibilidad(valor)
    guardarSensibilidad(valor)
  }

  const activarAvisos = async () => {
    if (typeof Notification === 'undefined') {
      setPermiso('no-soportado')
      return
    }

    try {
      const nuevoPermiso = await Notification.requestPermission()
      setPermiso(nuevoPermiso)
    } catch {
      setPermiso('denied')
    }
  }

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
    setAviso('')
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

  return (
    <div className="page">
      <div className="row row--between">
        <div>
          <h1 className="page__title">Mapa de zonas</h1>
          <p className="page__subtitle">
            Nivel 1 indica mayor riesgo; nivel 5, menor riesgo.
          </p>
        </div>

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setFormAbierto(true)}
        >
          Reportar incidente
        </button>
      </div>

      <div className="chips" role="group" aria-label="Filtrar por tipo de zona">
        {TIPOS.map((item) => (
          <button
            key={item.valor}
            type="button"
            className="chip"
            aria-pressed={tipo === item.valor}
            onClick={() => setTipo(item.valor)}
          >
            {item.etiqueta}
          </button>
        ))}
      </div>

      {aviso && (
        <p className="alert alert--success" role="status">
          {aviso}
        </p>
      )}

      {AVISO_UBICACION[status] && (
        <p className="alert alert--info" role="status">
          {AVISO_UBICACION[status]}
        </p>
      )}

      {cargaParcial && (
        <p className="alert alert--info" role="status">
          No se pudo cargar parte de la información de reportes o del mapa de calor.
        </p>
      )}

      {alertas.map((alerta) => (
        <p
          key={alerta.id}
          className={`alert ${
            alerta.riesgo === 'alto'
              ? 'alert--error'
              : 'alert--info'
          }`}
          role="alert"
        >
          {alerta.mensaje}
        </p>
      ))}

      {alertas.length === 0 && zonasActuales.length > 0 && (
        <p className="alert alert--info" role="status">
          Estás en:{' '}
          {zonasActuales
            .map(
              (zona) =>
                `${zona.nombre} (nivel ${zona.nivelSeguridad})`,
            )
            .join(', ')}
        </p>
      )}

      <MapView
        position={position}
        onMapClick={
          eligiendoDestino ? alElegirDestino : undefined
        }
      >
        <ZoneLayer
          zonas={zonas}
          onSelect={setSeleccionada}
        />

        <TouristPlacesLayer
          onSelect={alElegirDestino}
        />

        {mapa && <HeatLayer puntos={mapa.puntos ?? []} />}

        <ReportMarker reportes={reportesMapa} />

        <RutaLayer
          rutas={rutaResultado?.rutas ?? []}
          indice={rutaIndice}
          destino={destino}
        />
      </MapView>

      {cargando && (
        <div className="state" role="status">
          <div className="spinner" aria-hidden="true" />
          <p>Cargando mapa...</p>
        </div>
      )}

      {error && (
        <div className="card state" role="alert">
          <p className="state__title">
            No se pudieron cargar las zonas
          </p>
          <p>{error}</p>

          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setRecarga((n) => n + 1)}
          >
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && zonas.length === 0 && (
        <div className="card state">
          <p className="state__title">Sin zonas para mostrar</p>
          <p>Aún no hay zonas registradas con este filtro.</p>
        </div>
      )}

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

      <section className="card stack" aria-labelledby="alertas-titulo">
        <h2 id="alertas-titulo" className="card__title">
          Alertas de zona
        </h2>

        <div className="chips" role="group" aria-label="Sensibilidad de las alertas">
          {SENSIBILIDADES.map((item) => (
            <button
              key={item.valor}
              type="button"
              className="chip"
              aria-pressed={sensibilidad === item.valor}
              onClick={() => cambiarSensibilidad(item.valor)}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>

        {permiso === 'default' && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={activarAvisos}
          >
            Activar avisos en el dispositivo
          </button>
        )}

        {permiso === 'granted' && (
          <p className="muted">
            Avisos del dispositivo activos mientras la aplicación esté abierta.
          </p>
        )}

        {permiso === 'denied' && (
          <p className="muted">
            Los avisos del dispositivo están bloqueados en el navegador.
            Las alertas seguirán apareciendo en esta pantalla.
          </p>
        )}

        {permiso === 'no-soportado' && (
          <p className="muted">
            Este navegador no permite notificaciones del dispositivo.
          </p>
        )}
      </section>

      {riesgoPorZona.length > 0 && (
        <section className="card" aria-labelledby="riesgo-titulo">
          <h2 id="riesgo-titulo" className="card__title">
            Riesgo actual por zona
          </h2>

          <ul className="list">
            {riesgoPorZona.map((zona) => {
              const riesgo = RIESGO[zona.riesgo] ?? RIESGO.bajo

              return (
                <li key={zona.zonaId} className="list__item">
                  <div>
                    <strong>{zona.nombre}</strong>
                    <p className="muted">
                      {zona.reportes ?? 0}{' '}
                      {(zona.reportes ?? 0) === 1
                        ? 'reporte vigente'
                        : 'reportes vigentes'}
                    </p>
                  </div>

                  <span className={`badge ${riesgo.clase}`}>
                    {riesgo.etiqueta}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {seleccionada && (
        <section className="card stack" aria-live="polite">
          <h2 className="card__title">
            {seleccionada.nombre}
          </h2>

          <p className="muted">
            Nivel {seleccionada.nivelSeguridad} de 5 · {seleccionada.tipo}
          </p>

          {seleccionada.descripcion && (
            <p>{seleccionada.descripcion}</p>
          )}
        </section>
      )}

      <Modal
        open={formAbierto}
        title="Reportar incidente"
        onClose={() => setFormAbierto(false)}
      >
        <ReportForm
          position={position}
          onCreado={alCrearReporte}
          onCancelar={() => setFormAbierto(false)}
        />
      </Modal>
    </div>
  )
}
