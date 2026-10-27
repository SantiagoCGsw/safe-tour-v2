// client/src/pages/Admin/AdminDashboard.jsx
import { useEffect, useState } from 'react'
import Modal from '../../components/common/Modal.jsx'
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { mensajeDeError } from '../../api/client.js'
import {
  estadisticas,
  listarUsuarios,
  crearCuenta,
  cambiarRol,
  cambiarEstado,
  obtenerConfig,
  actualizarConfig,
} from '../../api/admin.js'

const ROLES = ['turista', 'gestor', 'admin']
const ETIQUETA_ROL = { turista: 'Turista', gestor: 'Gestor', admin: 'Administrador' }
const ETIQUETA_TIPO = {
  turistica: 'Turísticas',
  cultural: 'Culturales',
  peligrosa: 'Peligrosas',
  segura: 'Seguras',
}
const CUENTA_VACIA = { nombre: '', email: '', password: '', rol: 'gestor' }

const PARAMETROS = [
  {
    campo: 'umbralAltoRiesgo',
    etiqueta: 'Umbral de alto riesgo',
    ayuda: 'Reportes vigentes en una zona para clasificarla como de alto riesgo.',
    min: 1,
    max: 1000,
  },
  {
    campo: 'vigenciaReporteHoras',
    etiqueta: 'Vigencia de un reporte (horas)',
    ayuda: 'Tiempo durante el que un reporte cuenta en el mapa de calor.',
    min: 1,
    max: 720,
  },
  {
    campo: 'quorum',
    etiqueta: 'Quórum de votación',
    ayuda: 'Votos mínimos para que la votación de un reporte no pase a disputa.',
    min: 1,
    max: 1000,
  },
  {
    campo: 'plazoVotacionHoras',
    etiqueta: 'Plazo de votación (horas)',
    ayuda: 'Tiempo que permanece abierta la votación de un reporte nuevo.',
    min: 1,
    max: 336,
  },
]

const aRango = ({ desde, hasta }) => {
  const rango = {}
  if (desde) rango.desde = new Date(`${desde}T00:00:00`).toISOString()
  if (hasta) rango.hasta = new Date(`${hasta}T23:59:59.999`).toISOString()
  return rango
}

const aTexto = (config) =>
  Object.fromEntries(PARAMETROS.map(({ campo }) => [campo, String(config[campo])]))

function useDatos(clave, cargar) {
  const [res, setRes] = useState({ clave: null, datos: null, error: '' })

  useEffect(() => {
    let activo = true
    cargar()
      .then((datos) => activo && setRes({ clave, datos, error: '' }))
      .catch((err) => activo && setRes({ clave, datos: null, error: mensajeDeError(err) }))
    return () => {
      activo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  const vigente = res.clave === clave
  return { cargando: !vigente, datos: vigente ? res.datos : null, error: vigente ? res.error : '' }
}

function Estado({ cargando, error, onReintentar, children }) {
  if (cargando) {
    return (
      <div className="state" role="status">
        <div className="spinner" aria-hidden="true" />
        <p>Cargando…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="state" role="alert">
        <p className="state__title">No se pudo cargar</p>
        <p>{error}</p>
        <button type="button" className="btn btn--primary" onClick={onReintentar}>
          Reintentar
        </button>
      </div>
    )
  }
  return children
}

function ParametrosForm({ config }) {
  const [base, setBase] = useState(config)
  const [valores, setValores] = useState(() => aTexto(config))
  const [aviso, setAviso] = useState({ tipo: '', texto: '' })
  const [enviando, setEnviando] = useState(false)

  const cambiar = (e) => setValores((v) => ({ ...v, [e.target.name]: e.target.value }))

  const guardar = async (e) => {
    e.preventDefault()
    setAviso({ tipo: '', texto: '' })

    const cambios = {}
    for (const { campo, etiqueta, min, max } of PARAMETROS) {
      const texto = valores[campo].trim()
      const numero = Number(texto)
      if (texto === '' || !Number.isInteger(numero) || numero < min || numero > max) {
        setAviso({
          tipo: 'error',
          texto: `${etiqueta}: ingresa un número entero entre ${min} y ${max}`,
        })
        return
      }
      if (numero !== base[campo]) cambios[campo] = numero
    }

    if (Object.keys(cambios).length === 0) {
      setAviso({ tipo: 'info', texto: 'No hay cambios por guardar' })
      return
    }

    setEnviando(true)
    try {
      const actualizada = await actualizarConfig(cambios)
      setBase(actualizada)
      setValores(aTexto(actualizada))
      setAviso({ tipo: 'success', texto: 'Parámetros actualizados' })
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDeError(err, 'No se pudieron guardar los parámetros') })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="stack" onSubmit={guardar} noValidate>
      <div className="grid">
        {PARAMETROS.map(({ campo, etiqueta, ayuda, min, max }) => (
          <div key={campo} className="field">
            <label className="field__label" htmlFor={`param-${campo}`}>
              {etiqueta}
            </label>
            <input
              id={`param-${campo}`}
              name={campo}
              type="number"
              inputMode="numeric"
              className="input"
              min={min}
              max={max}
              step={1}
              value={valores[campo]}
              onChange={cambiar}
              disabled={enviando}
              required
            />
            <span className="field__hint">{ayuda}</span>
          </div>
        ))}
      </div>

      {aviso.texto && (
        <p
          className={`alert alert--${aviso.tipo === 'error' ? 'error' : aviso.tipo}`}
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
        >
          {aviso.texto}
        </p>
      )}

      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar parámetros'}
        </button>
      </div>
    </form>
  )
}

export default function AdminDashboard() {
  const { user: yo } = useAuth()
  const [version, setVersion] = useState(0)
  const [filtros, setFiltros] = useState({ desde: '', hasta: '' })
  const [aplicados, setAplicados] = useState({ desde: '', hasta: '' })
  const [filtroRol, setFiltroRol] = useState('')
  const [aviso, setAviso] = useState({ tipo: '', texto: '' })
  const [cuentaAbierta, setCuentaAbierta] = useState(false)
  const [cuenta, setCuenta] = useState(CUENTA_VACIA)
  const [errorCuenta, setErrorCuenta] = useState('')
  const [accion, setAccion] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const recargar = () => setVersion((v) => v + 1)

  const claveStats = `${JSON.stringify(aplicados)}:${version}`
  const stats = useDatos(claveStats, () => estadisticas(aRango(aplicados)))

  const claveUsuarios = `${filtroRol}:${version}`
  const usuarios = useDatos(claveUsuarios, () => listarUsuarios(filtroRol ? { rol: filtroRol } : {}))

  const claveConfig = `config:${version}`
  const configuracion = useDatos(claveConfig, obtenerConfig)

  const aplicarFiltros = (e) => {
    e.preventDefault()
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setAviso({ tipo: 'error', texto: 'La fecha inicial no puede ser posterior a la final' })
      return
    }
    setAviso({ tipo: '', texto: '' })
    setAplicados(filtros)
  }

  const abrirCuenta = () => {
    setCuenta(CUENTA_VACIA)
    setErrorCuenta('')
    setCuentaAbierta(true)
  }

  const cambiarCuenta = (e) => setCuenta((c) => ({ ...c, [e.target.name]: e.target.value }))

  const guardarCuenta = async (e) => {
    e.preventDefault()
    setErrorCuenta('')
    setEnviando(true)
    try {
      await crearCuenta({ ...cuenta, nombre: cuenta.nombre.trim(), email: cuenta.email.trim() })
      setCuentaAbierta(false)
      setAviso({ tipo: 'success', texto: 'Cuenta creada' })
      recargar()
    } catch (err) {
      setErrorCuenta(mensajeDeError(err, 'No se pudo crear la cuenta'))
    } finally {
      setEnviando(false)
    }
  }

  const ejecutarAccion = async () => {
    setEnviando(true)
    try {
      if (accion.tipo === 'rol') await cambiarRol(accion.usuario._id, accion.rol)
      else await cambiarEstado(accion.usuario._id, accion.activo)
      setAviso({ tipo: 'success', texto: 'Cambio aplicado' })
      recargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: mensajeDeError(err, 'No se pudo aplicar el cambio') })
    } finally {
      setEnviando(false)
      setAccion(null)
    }
  }

  const pedirRol = (usuario, rol) => {
    if (rol !== usuario.rol) setAccion({ tipo: 'rol', usuario, rol })
  }

  const pedirEstado = (usuario) => {
    const activo = !usuario.activo
    if (activo) {
      setEnviando(true)
      cambiarEstado(usuario._id, true)
        .then(() => {
          setAviso({ tipo: 'success', texto: 'Cuenta activada' })
          recargar()
        })
        .catch((err) => setAviso({ tipo: 'error', texto: mensajeDeError(err) }))
        .finally(() => setEnviando(false))
      return
    }
    setAccion({ tipo: 'estado', usuario, activo })
  }

  const s = stats.datos

  return (
    <div className="page">
      <div className="row row--between">
        <div>
          <h1 className="page__title">Panel de administración</h1>
          <p className="page__subtitle">Estadísticas, parámetros del sistema y gestión de cuentas.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={abrirCuenta}>
          Crear cuenta
        </button>
      </div>

      {aviso.texto && (
        <p
          className={`alert ${aviso.tipo === 'error' ? 'alert--error' : 'alert--success'}`}
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
        >
          {aviso.texto}
        </p>
      )}

      <section className="card stack" aria-labelledby="stats-titulo">
        <h2 id="stats-titulo" className="card__title">
          Estadísticas
        </h2>

        <form className="row" onSubmit={aplicarFiltros}>
          <div className="field">
            <label className="field__label" htmlFor="desde">
              Desde
            </label>
            <input id="desde" type="date" className="input" value={filtros.desde} onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="hasta">
              Hasta
            </label>
            <input id="hasta" type="date" className="input" value={filtros.hasta} onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn--secondary">
            Aplicar
          </button>
          <button type="button" className="btn btn--ghost" onClick={recargar}>
            Actualizar
          </button>
        </form>

        <Estado cargando={stats.cargando} error={stats.error} onReintentar={recargar}>
          {s && (
            <div className="grid">
              <div className="card stat">
                <span className="stat__value">{s.usuarios.total}</span>
                <span className="stat__label">Usuarios</span>
              </div>
              {ROLES.map((rol) => (
                <div key={rol} className="card stat">
                  <span className="stat__value">{s.usuarios.porRol[rol] ?? 0}</span>
                  <span className="stat__label">{ETIQUETA_ROL[rol]}s</span>
                </div>
              ))}
              <div className="card stat">
                <span className="stat__value">{s.zonas.activas}</span>
                <span className="stat__label">Zonas activas</span>
              </div>
              {Object.entries(s.zonas.porTipo).map(([tipo, total]) => (
                <div key={tipo} className="card stat">
                  <span className="stat__value">{total}</span>
                  <span className="stat__label">Zonas {ETIQUETA_TIPO[tipo]?.toLowerCase() ?? tipo}</span>
                </div>
              ))}
              {typeof s.reportes === 'number' && (
                <div className="card stat">
                  <span className="stat__value">{s.reportes}</span>
                  <span className="stat__label">Reportes</span>
                </div>
              )}
              {typeof s.publicaciones === 'number' && (
                <div className="card stat">
                  <span className="stat__value">{s.publicaciones}</span>
                  <span className="stat__label">Publicaciones</span>
                </div>
              )}
            </div>
          )}
        </Estado>
      </section>

      <section className="card stack" aria-labelledby="params-titulo">
        <h2 id="params-titulo" className="card__title">
          Parámetros del sistema
        </h2>

        <Estado cargando={configuracion.cargando} error={configuracion.error} onReintentar={recargar}>
          {configuracion.datos && (
            <ParametrosForm key={configuracion.datos.updatedAt} config={configuracion.datos} />
          )}
        </Estado>
      </section>

      <section className="card stack" aria-labelledby="usuarios-titulo">
        <div className="row row--between">
          <h2 id="usuarios-titulo" className="card__title">
            Usuarios
          </h2>
          <div className="field">
            <label className="sr-only" htmlFor="filtro-rol">
              Filtrar por rol
            </label>
            <select id="filtro-rol" className="input" value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
              <option value="">Todos los roles</option>
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>
                  {ETIQUETA_ROL[rol]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Estado cargando={usuarios.cargando} error={usuarios.error} onReintentar={recargar}>
          {usuarios.datos && usuarios.datos.length === 0 && (
            <div className="state">
              <p className="state__title">Sin usuarios</p>
              <p>No hay cuentas con este filtro.</p>
            </div>
          )}

          {usuarios.datos && usuarios.datos.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.datos.map((u) => {
                    const esYo = u._id === yo?._id
                    return (
                      <tr key={u._id}>
                        <td>{u.nombre}</td>
                        <td>{u.email}</td>
                        <td>
                          <label className="sr-only" htmlFor={`rol-${u._id}`}>
                            Rol de {u.nombre}
                          </label>
                          <select
                            id={`rol-${u._id}`}
                            className="input"
                            value={u.rol}
                            disabled={esYo || enviando}
                            onChange={(e) => pedirRol(u, e.target.value)}
                          >
                            {ROLES.map((rol) => (
                              <option key={rol} value={rol}>
                                {ETIQUETA_ROL[rol]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className={`badge ${u.activo ? 'badge--ok' : 'badge--danger'}`}>
                            {u.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`btn btn--sm ${u.activo ? 'btn--danger' : 'btn--secondary'}`}
                            disabled={esYo || enviando}
                            onClick={() => pedirEstado(u)}
                          >
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Estado>
      </section>

      <Modal
        open={cuentaAbierta}
        title="Crear cuenta"
        onClose={enviando ? undefined : () => setCuentaAbierta(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setCuentaAbierta(false)} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" form="form-cuenta" className="btn btn--primary" disabled={enviando}>
              {enviando ? 'Creando…' : 'Crear'}
            </button>
          </>
        }
      >
        <form id="form-cuenta" className="stack" onSubmit={guardarCuenta} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="c-nombre">
              Nombre
            </label>
            <input id="c-nombre" name="nombre" className="input" value={cuenta.nombre} onChange={cambiarCuenta} required />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="c-email">
              Correo electrónico
            </label>
            <input id="c-email" name="email" type="email" className="input" value={cuenta.email} onChange={cambiarCuenta} required />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="c-password">
              Contraseña inicial
            </label>
            <input id="c-password" name="password" type="password" className="input" autoComplete="new-password" value={cuenta.password} onChange={cambiarCuenta} required />
            <span className="field__hint">Mínimo 8 caracteres, con letras y números.</span>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="c-rol">
              Rol
            </label>
            <select id="c-rol" name="rol" className="input" value={cuenta.rol} onChange={cambiarCuenta}>
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>
                  {ETIQUETA_ROL[rol]}
                </option>
              ))}
            </select>
          </div>
          {errorCuenta && (
            <p className="alert alert--error" role="alert">
              {errorCuenta}
            </p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(accion)}
        title={accion?.tipo === 'rol' ? 'Cambiar rol' : 'Desactivar cuenta'}
        message={
          accion?.tipo === 'rol'
            ? `¿Cambiar el rol de ${accion?.usuario.nombre} a ${ETIQUETA_ROL[accion?.rol]}?`
            : `¿Desactivar la cuenta de ${accion?.usuario.nombre}? Perderá el acceso de inmediato.`
        }
        confirmLabel={accion?.tipo === 'rol' ? 'Cambiar rol' : 'Desactivar'}
        danger={accion?.tipo === 'estado'}
        loading={enviando}
        onConfirm={ejecutarAccion}
        onCancel={() => setAccion(null)}
      />
    </div>
  )
}