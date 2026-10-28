import { COLORES, ETIQUETA_TIPO, RIESGO } from './zonaEstilos.js'

// Lista de zonas para elegir cuáles se muestran en el mapa.
// Sin ninguna elegida, el mapa muestra todas.
export default function ZoneList({ zonas, elegidas, onAlternar, onLimpiar }) {
  const ordenadas = [...zonas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <section className="card zone-list" aria-label="Zonas disponibles">
      <div className="row row--between">
        <div>
          <h2 className="card__title zone-list__title">Zonas ({zonas.length})</h2>
          <p className="muted">
            {elegidas.length === 0
              ? 'Toca una o varias zonas para verlas en el mapa. Ahora se muestran todas.'
              : `Mostrando ${elegidas.length} de ${zonas.length} en el mapa.`}
          </p>
        </div>

        {elegidas.length > 0 && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={onLimpiar}>
            Mostrar todas
          </button>
        )}
      </div>

      <ul className="zone-list__grid">
        {ordenadas.map((zona) => {
          const activa = elegidas.includes(String(zona._id))
          return (
            <li key={zona._id}>
              <button
                type="button"
                className="zone-list__item"
                aria-pressed={activa}
                onClick={() => onAlternar(String(zona._id))}
              >
                <span
                  className="zone-list__dot"
                  style={{ background: COLORES[zona.nivelSeguridad] ?? COLORES[3] }}
                  aria-hidden="true"
                />
                <span className="zone-list__text">
                  <strong>{zona.nombre}</strong>
                  <small>
                    {ETIQUETA_TIPO[zona.tipo] ?? zona.tipo} · Nivel {zona.nivelSeguridad} (
                    {RIESGO[zona.nivelSeguridad]})
                  </small>
                </span>
                <span className="zone-list__check" aria-hidden="true">
                  {activa ? '✓' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
