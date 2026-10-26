import client from './client.js'

export const register = (datos) => client.post('/auth/register', datos).then((r) => r.data)

export const login = (datos) => client.post('/auth/login', datos).then((r) => r.data)

export const me = () => client.get('/auth/me').then((r) => r.data)

export const logout = () => client.post('/auth/logout').then((r) => r.data)

export const obtenerPerfil = () => client.get('/users/perfil').then((r) => r.data)

export const actualizarPerfil = (datos) => client.put('/users/perfil', datos).then((r) => r.data)