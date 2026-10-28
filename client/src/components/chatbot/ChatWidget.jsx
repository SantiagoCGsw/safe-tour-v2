
import { Link, useLocation } from 'react-router-dom'

export default function ChatWidget() {
  const location = useLocation()

  return (
    <Link
      to="/chatbot"
      state={{ from: location.pathname }}
      className="btn btn--secondary btn--sm"
      aria-label="Abrir asistente de seguridad y turismo"
    >
      <span aria-hidden="true">✦</span>
      Asistente IA
    </Link>
  )
}
