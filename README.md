# Safe Tour

Aplicación web progresiva (PWA) de orientación en seguridad, zonas turísticas y culturales en Bogotá, apoyada en GPS y reportes ciudadanos. Es el producto del trabajo de grado de Ingeniería de Software de la Universidad Manuela Beltrán (Bogotá, 2026).

## De qué trata

Un turista o residente ve en un mapa el riesgo por zona, reporta incidentes, consulta rutas que evitan zonas de riesgo alto, activa un botón de pánico, sigue un feed de publicaciones y conversa con un asistente. Los reportes se validan por votación de la comunidad. Gestores y administradores moderan y configuran el sistema.

### Funcionalidades

- Registro, inicio y cierre de sesión con tres roles: turista, gestor y administrador.
- Ubicación en tiempo real y mapa de calor calculado con reportes confirmados o publicados, activos y vigentes.
- Reporte de incidentes (accidente, robo, obra, peligro, turismo), con límite de 10 por hora para turistas.
- Alertas por zona en el cliente (geocercas y notificación local mientras la app está abierta).
- Ruta segura por modo de transporte: se compara la ruta directa con otra que evita zonas de riesgo alto. En transporte público el cálculo es aproximado.
- Botón de pánico con confirmación en dos pasos, límite de 3 activaciones por hora y registro de auditoría. Envía solo a contactos que el usuario registró.
- Feed de publicaciones con comentarios, reacciones, denuncias y moderación.
- Asistente conversacional (ver `ml/README.md`).
- Sitios turísticos y culturales.
- Votación por consenso: el cierre ocurre al vencer el plazo, con quórum y mayoría del 51 %. Los reportes en disputa los resuelve un gestor.
- Registro de cada decisión de consenso como `ChainRecord` (decisión, conteos, fecha y hash de los votos, sin datos personales).
- Gestión de zonas y moderación para gestores. Panel, usuarios, roles y parámetros (umbral, vigencia, quórum, plazo) para administradores.
- Perfil con historial de reportes y contactos de emergencia.

### Alcance y limitaciones

- El registro en cadena guarda el hash localmente con estado pendiente. El envío a una red de pruebas no está implementado.
- El botón de pánico no tiene un canal de correo o SMS conectado. El cliente informa que no hubo entregas.
- Las alertas por zona funcionan con la app abierta. No hay notificaciones push desde el servidor.
- El estimador de riesgo del asistente usa el histórico de 30 días mientras no exista un modelo entrenado con reportes reales.
- La sesión se guarda en `localStorage` con token de 24 horas y el cierre de sesión ocurre solo en el cliente.

## Cómo se hizo

### Arquitectura

- Cliente: React con Vite, `vite-plugin-pwa` (service worker generado con Workbox), Leaflet y react-leaflet para el mapa, Axios para la API. Estilos propios con tokens CSS, modo día y noche, accesibilidad WCAG y diseño pensado para operar con una mano.
- Servidor: Node 20 o superior con Express 5. Capas `routes`, `controllers` y `services`: la lógica de negocio vive en los servicios.
- Datos: MongoDB con Mongoose 9, con `sanitizeFilter` activo.
- Validación: Zod 4 con esquemas estrictos por endpoint.
- Rutas: OpenRouteService.
- Pruebas: Vitest, Supertest y mongodb-memory-server.
- Despliegue previsto sin costo: Vercel (cliente), Render (API) y MongoDB Atlas (base de datos).

### Seguridad

- JWT HS256 con secreto de al menos 32 caracteres. El rol se lee de la base de datos en cada petición, nunca del token ni del cuerpo.
- Contraseñas con bcrypt (costo configurable, mínimo 12 fuera de pruebas).
- helmet, límites de peticiones por ruta, CORS con lista exacta de orígenes, errores genéricos y cuerpo máximo de 10 kb.
- El registro público solo crea turistas. Solo el administrador crea gestores y administradores, y no puede cambiar su propio rol ni su estado.
- Control de propiedad en los objetos, auditoría de cambios privilegiados, índice único (reporte, usuario) en los votos y prohibición de votar el propio reporte.

### Proceso

El proyecto se construyó por iteraciones: base, autenticación y mapa, participación ciudadana y seguridad activa, consenso y cadena, y social con asistente. El empaquetado como APK con PWA Builder está previsto como iteración final.

## Estructura

La estructura del repositorio está en `estructura.txt`.