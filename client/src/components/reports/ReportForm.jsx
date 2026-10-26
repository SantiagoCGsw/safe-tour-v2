import { useState } from 'react'
import { crearReporte } from '../../api/reports.js'
import { mensajeDeError } from '../../api/client.js'

const TIPOS = [
  { valor: 'robo', etiqueta: 'Robo' },
  { valor: 'accidente', etiqueta: 'Accidente' },
  { valor: 'peligro', etiqueta: 'Zona peligrosa' },
  { valor: 'obra', etiqueta: 'Obra o cierre' },
  { valor: 'turismo', etiqueta: 'Información turística' },
]

export default function ReportForm({ position, onCreado, onCancelar }) {
  const [form, setForm] = useState({ titulo: '', tipo: 'robo', descripcion: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cambiar = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    if (!position) {
      setError('Necesitamos tu ubicación para registrar el reporte')
      return
    }
    if (form.titulo.trim().length < 3) {
      setError('El título debe tener al menos 3 caracteres')
      return
    }

    const datos = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      ubicacion: { lat: position.lat, lng: position.lng },
    }
    if (form.descripcion.trim()) datos.descripcion = form.descripcion.trim()

    setEnviando(true)
    try {
      const reporte = await crearReporte(datos)
      onCreado(reporte)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo enviar el reporte'))
      setEnviando(false)
    }
  }

  return (
    <form className="stack" onSubmit={enviar} noValidate>
      <p className={`alert ${position ? 'alert--info' : 'alert--error'}`} role="status">
        {position
          ? 'Se usará tu ubicación actual para el reporte.'
          : 'Aún no tenemos tu ubicación. Activa el permiso de ubicación para reportar.'}
      </p>

      <div className="field">
        <label className="field__label" htmlFor="r-titulo">
          Título
        </label>
        <input id="r-titulo" name="titulo" className="input" value={form.titulo} onChange={cambiar} maxLength={120} required />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="r-tipo">
          Tipo de incidente
        </label>
        <select id="r-tipo" name="tipo" className="input" value={form.tipo} onChange={cambiar}>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="r-descripcion">
          Descripción (opcional)
        </label>
        <textarea id="r-descripcion" name="descripcion" className="input" value={form.descripcion} onChange={cambiar} maxLength={1000} />
      </div>

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={enviando || !position}>
          {enviando ? 'Enviando…' : 'Enviar reporte'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  )
}