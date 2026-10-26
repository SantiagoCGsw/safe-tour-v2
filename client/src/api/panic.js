import client from './client.js'

export const listarContactos = () => client.get('/panic/contactos').then((r) => r.data.contactos)

export const crearContacto = (datos) =>
  client.post('/panic/contactos', datos).then((r) => r.data.contacto)

export const eliminarContacto = (id) => client.delete(`/panic/contactos/${id}`).then((r) => r.data)

export const activarPanico = (ubicacion) =>
  client.post('/panic/activar', { confirmado: true, ubicacion }).then((r) => r.data.resultado)