import { ZodError } from 'zod'

const PARTES = ['body', 'query', 'params']

export const validate = (esquemas) => (req, res, next) => {
  try {
    const valido = {}
    for (const parte of PARTES) {
      if (!esquemas[parte]) continue
      const entrada = parte === 'body' ? (req.body ?? {}) : req[parte]
      valido[parte] = esquemas[parte].parse(entrada)
    }
    req.valid = valido
    if (valido.body) req.body = valido.body
    next()
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errors: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      })
    }
    next(err)
  }
}