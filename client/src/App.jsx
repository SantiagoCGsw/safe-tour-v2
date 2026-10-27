// client/src/App.jsx
import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Navbar from './components/common/Navbar.jsx'
import ErrorBoundary from './components/common/ErrorBoundary.jsx'
import ChatWidget from './components/chatbot/ChatWidget.jsx'

const Login = lazy(() => import('./pages/Auth/Login.jsx'))
const Register = lazy(() => import('./pages/Auth/Register.jsx'))
const MapPage = lazy(() => import('./pages/Map/MapPage.jsx'))
const FeedPage = lazy(() => import('./pages/Feed/FeedPage.jsx'))
const PlacesPage = lazy(() => import('./pages/Places/PlacesPage.jsx'))
const GestorPage = lazy(() => import('./pages/Gestor/GestorPage.jsx'))
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard.jsx'))
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage.jsx'))

function Cargando() {
  return (
    <div className="state" role="status">
      <div className="spinner" aria-hidden="true" />
      <p>Cargando…</p>
    </div>
  )
}

function SoloInvitados({ children }) {
  const { user, cargando } = useAuth()
  const location = useLocation()
  if (cargando) return <Cargando />
  if (user) return <Navigate to={location.state?.from ?? '/mapa'} replace />
  return children
}

function RutaProtegida({ roles, children }) {
  const { user, cargando } = useAuth()
  const location = useLocation()
  if (cargando) return <Cargando />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.rol)) return <Navigate to="/mapa" replace />
  return children
}

function Layout() {
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <Navbar />
      <div className="page">
        <ChatWidget />
      </div>
      <main id="contenido" className="app-main">
        <Suspense fallback={<Cargando />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  )
}

function NoEncontrada() {
  return (
    <div className="page">
      <div className="card state">
        <p className="state__title">Página no encontrada</p>
        <a className="btn btn--primary" href="/mapa">
          Ir al mapa
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<Cargando />}>
          <Routes>
            <Route
              path="/login"
              element={
                <SoloInvitados>
                  <Login />
                </SoloInvitados>
              }
            />
            <Route
              path="/registro"
              element={
                <SoloInvitados>
                  <Register />
                </SoloInvitados>
              }
            />

            <Route
              element={
                <RutaProtegida>
                  <Layout />
                </RutaProtegida>
              }
            >
              <Route path="/mapa" element={<MapPage />} />
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/sitios" element={<PlacesPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route
                path="/gestor"
                element={
                  <RutaProtegida roles={['gestor', 'admin']}>
                    <GestorPage />
                  </RutaProtegida>
                }
              />
              <Route
                path="/admin"
                element={
                  <RutaProtegida roles={['admin']}>
                    <AdminDashboard />
                  </RutaProtegida>
                }
              />
            </Route>

            <Route path="/" element={<Navigate to="/mapa" replace />} />
            <Route path="*" element={<NoEncontrada />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}