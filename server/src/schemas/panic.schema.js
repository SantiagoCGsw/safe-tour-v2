import { z } from 'zod'

const idParam = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido')

export const crearContactoSchema = {
  body: z
    .strictObject({
      nombre: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().max(254).pipe(z.email()).optional(),
      telefono: z
        .string()
        .trim()
        .regex(/^\+57\d{10}$/, 'El teléfono debe tener formato +57 y 10 dígitos')
        .optional(),
    })
    .refine((v) => v.email || v.telefono, { message: 'Se requiere correo o teléfono' }),
}

export const contactoIdSchema = {
  params: z.strictObject({ id: idParam }),
}

export const activarPanicoSchema = {
  body: z.strictObject({
    confirmado: z.literal(true),
    ubicacion: z.strictObject({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  }),
}