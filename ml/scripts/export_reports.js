// ml/scripts/export_reports.js
import { connectDB, disconnectDB } from '../../server/src/config/db.js'
import Report, { ESTADOS_MAPA } from '../../server/src/models/Report.model.js'

try {
  await connectDB()
  const reportes = await Report.find({ activo: true }).select('tipo estado ubicacion createdAt').lean()
  const salida = reportes
    .filter((r) => ESTADOS_MAPA.includes(r.estado))
    .map((r) => ({
      tipo: r.tipo,
      estado: r.estado,
      lat: r.ubicacion.lat,
      lng: r.ubicacion.lng,
      fecha: r.createdAt.toISOString(),
    }))
  process.stdout.write(`${JSON.stringify(salida)}\n`)
  process.stderr.write(`Reportes validados exportados: ${salida.length}\n`)
} catch (error) {
  process.stderr.write(`Error al exportar: ${error.message}\n`)
  process.exitCode = 1
} finally {
  await disconnectDB()
}