
import { useEffect, useMemo, useRef, useState } from 'react'
import MapView from '../../components/map/MapView.jsx'
import ZoneLayer from '../../components/map/ZoneLayer.jsx'
import ZoneList from '../../components/map/ZoneList.jsx'
import HeatLayer from '../../components/map/HeatLayer.jsx'
import ReportMarker from '../../components/map/ReportMarker.jsx'
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

const SIN_ZONAS = []

const ESTADOS_EN_MAPA = ['confirmado', 'publicado']

const TIPO_REPORTE = {
  accidente: 'accidentes',
  robo: 'robos',
  obra: 'obras o cierres',
  peligro: 'zonas peligrosas',
  turismo: 'información turística',
}

const CLAVE_SENSIBILIDAD = 'safe-tour-alertas'

const leerSensibilidad = () => {
  try {
    return localStorage.getItem(CLAVE_SENSIBILIDAD) === 'medio'
      ? 'medio'
      : 'alto'
  } catch {
    return 'alto'
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
  const [elegidasIds, setElegidasIds] = useState([])

  const [resultado, setResultado] = useState({
    clave: null,
    zonas: [],
    mapa: null,
    reportes: null,
    error: '',
  })

  const [formAbierto, setFormAbierto] = useState(false)
  const [aviso, setAviso] = useState('')

  const notificadas = useRef(new Set())
  const mapaRef = useRef(null)
  const { position, status } = useGeolocation()

  const sensibilidad = leerSensibilidad()
  const permiso = leerPermiso()

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
  const zonas = cargando ? SIN_ZONAS : resultado.zonas
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

  // Zonas elegidas en la lista (solo las que siguen existiendo con el filtro actual).
  // Sin ninguna elegida, el mapa muestra todas.
  const elegidas = useMemo(
    () => elegidasIds.filter((id) => zonas.some((z) => String(z._id) === id)),
    [elegidasIds, zonas],
  )
  const zonasEnMapa = useMemo(
    () => (elegidas.length === 0 ? zonas : zonas.filter((z) => elegidas.includes(String(z._id)))),
    [elegidas, zonas],
  )

  const alternarZona = (id) => {
    setElegidasIds((actuales) =>
      actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id],
    )
    mapaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

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

  const alCrearReporte = (reporte) => {
    setFormAbierto(false)

    setAviso(
      reporte.estado === 'pendiente'
        ? 'Reporte enviado. Queda pendiente de validación y aún no cuenta en el mapa.'
        : 'Reporte publicado.',
    )

    setRecarga((n) => n + 1)
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

      <div ref={mapaRef}>
        <MapView
          position={position}
          centrarEnUsuario={!cargando && zonas.length === 0}
        >
          <ZoneLayer zonas={zonasEnMapa} ajustar />

          {mapa && <HeatLayer puntos={mapa.puntos ?? []} />}

          <ReportMarker reportes={reportesMapa} />
        </MapView>
      </div>

      {!cargando && !error && zonas.length > 0 && (
        <ZoneList
          zonas={zonas}
          elegidas={elegidas}
          onAlternar={alternarZona}
          onLimpiar={() => setElegidasIds([])}
        />
      )}

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
