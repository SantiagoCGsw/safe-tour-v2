import { useEffect, useRef, useState } from 'react'

const CLIPS = [
  { src: '/videos/login-1.mp4', poster: '/videos/posters/login-1.jpg' },
  { src: '/videos/login-2.mp4', poster: '/videos/posters/login-2.jpg' },
  { src: '/videos/login-3.mp4', poster: '/videos/posters/login-3.jpg' },
]

const FADE_MS = 1000

// Sin movimiento si el usuario lo pidió o tiene el ahorro de datos activo.
const soloEstatico = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  navigator.connection?.saveData === true

// Siguiente clip que no haya fallado al cargar (si no hay otro, devuelve el mismo).
function siguienteVivo(desde, fallidos) {
  for (let paso = 1; paso <= CLIPS.length; paso++) {
    const n = (desde + paso) % CLIPS.length
    if (!fallidos[n]) return n
  }
  return desde
}

export default function VideoBackground() {
  const [estatico] = useState(soloEstatico)
  const [clip, setClip] = useState({ actual: 0, anterior: null })
  const refs = useRef([])
  const fallidos = useRef(CLIPS.map(() => false))

  // Reproduce el clip activo, precarga el siguiente y pausa los demás tras el fundido.
  useEffect(() => {
    if (estatico) return
    const video = refs.current[clip.actual]
    if (!video) return

    video.currentTime = 0
    video.play().catch(() => {})

    const sig = refs.current[siguienteVivo(clip.actual, fallidos.current)]
    if (sig) sig.preload = 'auto'

    const id = window.setTimeout(() => {
      refs.current.forEach((v, i) => {
        if (v && i !== clip.actual) v.pause()
      })
    }, FADE_MS + 100)

    return () => window.clearTimeout(id)
  }, [clip.actual, estatico])

  // Ahorra batería: pausa si la pestaña/app queda en segundo plano.
  useEffect(() => {
    if (estatico) return
    const alCambiar = () => {
      const v = refs.current[clip.actual]
      if (!v) return
      if (document.hidden) v.pause()
      else v.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', alCambiar)
    return () => document.removeEventListener('visibilitychange', alCambiar)
  }, [clip.actual, estatico])

  const alTerminar = (i) => {
    const n = siguienteVivo(i, fallidos.current)
    if (n === i) {
      const v = refs.current[i]
      if (v) {
        v.currentTime = 0
        v.play().catch(() => {})
      }
    } else {
      setClip({ actual: n, anterior: i })
    }
  }

  const alFallar = (i) => {
    fallidos.current[i] = true
    if (i !== clip.actual) return
    const n = siguienteVivo(i, fallidos.current)
    if (n !== i) setClip({ actual: n, anterior: i })
  }

  const clase = (i) => {
    if (i === clip.actual) return 'auth-bg__video auth-bg__video--activo'
    if (i === clip.anterior) return 'auth-bg__video auth-bg__video--saliente'
    return 'auth-bg__video'
  }

  return (
    <div className="auth-bg" aria-hidden="true">
      {!estatico &&
        CLIPS.map((c, i) => (
          <video
            key={c.src}
            ref={(el) => {
                refs.current[i] = el
            }}
            className={clase(i)}
            src={c.src}
            poster={c.poster}
            muted
            playsInline
            preload={i === 0 ? 'auto' : 'metadata'}
            disablePictureInPicture
            tabIndex={-1}
            onEnded={() => alTerminar(i)}
            onError={() => alFallar(i)}
          />
        ))}
      <div className="auth-bg__overlay" />
    </div>
  )
}