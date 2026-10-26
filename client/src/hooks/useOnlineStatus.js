import { useSyncExternalStore } from 'react'

const suscribir = (aviso) => {
  window.addEventListener('online', aviso)
  window.addEventListener('offline', aviso)
  return () => {
    window.removeEventListener('online', aviso)
    window.removeEventListener('offline', aviso)
  }
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    suscribir,
    () => navigator.onLine,
    () => true,
  )
}