import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { huboError: false }

  static getDerivedStateFromError() {
    return { huboError: true }
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) console.error(error)
  }

  render() {
    if (!this.state.huboError) return this.props.children

    return (
      <div className="page">
        <div className="card state" role="alert">
          <p className="state__title">Algo salió mal</p>
          <p>La pantalla no pudo cargarse. Recarga para intentarlo de nuevo.</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      </div>
    )
  }
}