import { registerSW } from 'virtual:pwa-register'

export const iniciarPWA = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  registerSW({ immediate: true })
}