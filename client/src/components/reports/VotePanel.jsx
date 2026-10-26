import { useEffect, useState } from 'react'
import { votar, miVoto } from '../../api/votes.js'
import { mensajeDeError } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'

const MINUTO_MS = 60 * 1000
const HORA_MS = 60 * MINUTO_MS

const textoPlazo = (cierre, ahora) => {
  if (!cierre) return ''
  const restante = new Date(cierre).getTime() - ahora
  if (restante <= 0) return 'Votación por cerrar'
  const horas = Math.floor(restante / HORA_MS)
  const minutos = Math.floor((restante % HORA_MS) / MINUTO_MS)
  return horas > 0 ? `Cierra en ${horas} h ${minutos} min` : `Cierra en ${minutos} min`
}

export default function VotePanel({ reporte, onVotado }) {
  const { user } = useAuth()
  const [ahora] = useState(() => Date.now())
  const [mio, setMio] = useState(undefined)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const autorId = reporte.autor?._id ?? reporte.autor
  const propio = String(autorId) === String(user._id)

  useEffect(() => {
    if (propio) return undefined
    let activo = true
    miVoto(reporte._id)
      .then((voto) => activo && setMio(voto))
      .catch(() => activo && setMio(null))
    return () => {
      activo = false
    }
  }, [reporte._id, propio])

  const emitir = async (voto) => {
    setError('')
    setEnviando(true)
    try {
      const actualizado = await votar(reporte._id, voto)
      setMio(voto)
      onVotado?.(actualizado)
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo registrar tu voto'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="stack">
      <p className="muted">
        {reporte.confirmaciones} confirman · {reporte.rechazos} rechazan
        {reporte.cierreVotacion ? ` · ${textoPlazo(reporte.cierreVotacion, ahora)}` : ''}
      </p>

      {propio && <p className="muted">No puedes votar tu propio reporte.</p>}

      {!propio && mio && (
        <p className="alert alert--info" role="status">
          Ya votaste: {mio === 'confirmar' ? 'confirmaste' : 'rechazaste'} este reporte.
        </p>
      )}

      {!propio && mio === null && (
        <div className="row">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => emitir('confirmar')} disabled={enviando}>
            Confirmar
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => emitir('rechazar')} disabled={enviando}>
            Rechazar
          </button>
        </div>
      )}

      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}