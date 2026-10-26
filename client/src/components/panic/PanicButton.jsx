import { useCallback, useEffect, useState } from 'react'
import Modal from '../common/Modal.jsx'
import {
  listarContactos,
  crearContacto,
  eliminarContacto,
  activarPanico,
} from '../../api/panic.js'
import { mensajeDeError } from '../../api/client.js'

const SEGUNDOS_DE_ESPERA = 5
const CONTACTO_VACIO = { nombre: '', email: '', telefono: '' }

const obtenerUbicacion = () =>
  new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) {
      rechazar(new Error('Este dispositivo no permite obtener la ubicación'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => rechazar(new Error('No se pudo obtener tu ubicación')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    )
  })

export default function PanicButton() {
  const [abierto, setAbierto] = useState(false)
  const [version, setVersion] = useState(0)
  const [datos, setDatos] = useState({ version: null, contactos: [], error: '' })
  const [form, setForm] = useState(CONTACTO_VACIO)
  const [errorForm, setErrorForm] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cuenta, setCuenta] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState({ tipo: '', texto: '' })

  useEffect(() => {
    if (!abierto) return undefined
    let activo = true
    listarContactos()
      .then((contactos) => activo && setDatos({ version, contactos, error: '' }))
      .catch((err) => activo && setDatos({ version, contactos: [], error: mensajeDeError(err) }))
    return () => {
      activo = false
    }
  }, [abierto, version])

  const cargando = datos.version !== version
  const contactos = cargando ? [] : datos.contactos

  const enviar = useCallback(async () => {
    setEnviando(true)
    try {
      const ubicacion = await obtenerUbicacion()
      const r = await activarPanico(ubicacion)
      if (r.entregados > 0) {
        setResultado({ tipo: 'success', texto: `Alerta enviada a ${r.contactos} contacto(s).` })
      } else {
        setResultado({
          tipo: 'error',
          texto:
            'La alerta quedó registrada, pero no se pudo entregar porque el servicio de notificaciones aún no está configurado. Llama a la línea de emergencias 123.',
        })
      }
    } catch (err) {
      setResultado({ tipo: 'error', texto: mensajeDeError(err, err.message) })
    } finally {
      setEnviando(false)
    }
  }, [])

  useEffect(() => {
    if (cuenta === null) return undefined
    const temporizador = setTimeout(() => {
      if (cuenta <= 1) {
        setCuenta(null)
        enviar()
      } else {
        setCuenta(cuenta - 1)
      }
    }, 1000)
    return () => clearTimeout(temporizador)
  }, [cuenta, enviar])

  const abrir = () => {
    setResultado({ tipo: '', texto: '' })
    setErrorForm('')
    setVersion((v) => v + 1)
    setAbierto(true)
  }

  const cerrar = () => {
    setCuenta(null)
    setAbierto(false)
  }

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const agregar = async (e) => {
    e.preventDefault()
    setErrorForm('')

    const datosContacto = { nombre: form.nombre.trim() }
    if (form.email.trim()) datosContacto.email = form.email.trim()
    if (form.telefono.trim()) datosContacto.telefono = form.telefono.trim()

    setGuardando(true)
    try {
      await crearContacto(datosContacto)
      setForm(CONTACTO_VACIO)
      setVersion((v) => v + 1)
    } catch (err) {
      setErrorForm(mensajeDeError(err, 'No se pudo guardar el contacto'))
    } finally {
      setGuardando(false)
    }
  }

  const quitar = async (id) => {
    try {
      await eliminarContacto(id)
      setVersion((v) => v + 1)
    } catch (err) {
      setErrorForm(mensajeDeError(err, 'No se pudo eliminar el contacto'))
    }
  }

  return (
    <>
      <button type="button" className="btn btn--danger btn--sm" onClick={abrir}>
        Pánico
      </button>

      <Modal open={abierto} title="Botón de pánico" onClose={cuenta === null && !enviando ? cerrar : undefined}>
        <div className="stack">
          <p className="muted">
            Se enviará tu ubicación a tus contactos de emergencia. Si es una emergencia grave, llama
            también al 123.
          </p>

          {resultado.texto && (
            <p
              className={`alert ${resultado.tipo === 'error' ? 'alert--error' : 'alert--success'}`}
              role={resultado.tipo === 'error' ? 'alert' : 'status'}
            >
              {resultado.texto}
            </p>
          )}

          {cuenta !== null && (
            <div className="state" role="status" aria-live="assertive">
              <span className="stat__value">{cuenta}</span>
              <p>Enviando alerta…</p>
              <button type="button" className="btn btn--secondary" onClick={() => setCuenta(null)}>
                Cancelar
              </button>
            </div>
          )}

          {cuenta === null && (
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => {
                setResultado({ tipo: '', texto: '' })
                setCuenta(SEGUNDOS_DE_ESPERA)
              }}
              disabled={enviando || cargando || contactos.length === 0}
            >
              {enviando ? 'Enviando…' : 'Activar alerta'}
            </button>
          )}

          <h3>Contactos de emergencia</h3>

          {cargando && (
            <div className="state" role="status">
              <div className="spinner" aria-hidden="true" />
            </div>
          )}

          {!cargando && datos.error && (
            <p className="alert alert--error" role="alert">
              {datos.error}
            </p>
          )}

          {!cargando && !datos.error && contactos.length === 0 && (
            <p className="muted">Aún no tienes contactos. Agrega al menos uno para activar la alerta.</p>
          )}

          {contactos.length > 0 && (
            <ul className="list">
              {contactos.map((c) => (
                <li key={c._id} className="list__item">
                  <div>
                    <strong>{c.nombre}</strong>
                    <p className="muted">{[c.email, c.telefono].filter(Boolean).join(' · ')}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => quitar(c._id)}
                    aria-label={`Eliminar a ${c.nombre}`}
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="stack" onSubmit={agregar} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="ct-nombre">
                Nombre
              </label>
              <input id="ct-nombre" name="nombre" className="input" value={form.nombre} onChange={cambiar} maxLength={80} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ct-email">
                Correo (opcional)
              </label>
              <input id="ct-email" name="email" type="email" className="input" value={form.email} onChange={cambiar} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ct-telefono">
                Teléfono (opcional)
              </label>
              <input id="ct-telefono" name="telefono" type="tel" className="input" placeholder="+573001234567" value={form.telefono} onChange={cambiar} />
              <span className="field__hint">Formato +57 seguido de 10 dígitos. Se requiere correo o teléfono.</span>
            </div>

            {errorForm && (
              <p className="alert alert--error" role="alert">
                {errorForm}
              </p>
            )}

            <button type="submit" className="btn btn--secondary" disabled={guardando || !form.nombre.trim()}>
              {guardando ? 'Guardando…' : 'Agregar contacto'}
            </button>
          </form>

          <div className="modal__footer">
            <button type="button" className="btn btn--ghost" onClick={cerrar} disabled={cuenta !== null || enviando}>
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}