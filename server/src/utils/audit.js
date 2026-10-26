import AuditLog from '../models/AuditLog.model.js'

export const registrarAuditoria = ({ actor, accion, objetivo, detalle }) =>
  AuditLog.create({ actor, accion, objetivo, detalle })