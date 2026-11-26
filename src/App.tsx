import { lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import AlertSystem from './components/AlertSystem';
import PwaUpdatePrompt from './components/PwaUpdatePrompt';
import PushPermissionPrompt from './components/PushPermissionPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import ConnectionBanner from './components/ConnectionBanner';
import GuidedTour from './components/GuidedTour';

// Pages
// La landing va en el paquete inicial; el resto se carga por ruta (auditoría A8)
// para que la primera visita no descargue Recharts ni las pantallas con sesión.
// El service worker precachea todos los .js, así que siguen abriendo sin red.
import Landing from './pages/Landing';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ControlPanel = lazy(() => import('./pages/ControlPanel'));
const PlantManagement = lazy(() => import('./pages/PlantManagement'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const OnboardingWizard = lazy(() => import('./pages/OnboardingWizard'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const ZonesPage = lazy(() => import('./pages/ZonesPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));

function PageFallback() {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)', padding: 'var(--space-2xl) 0', color: 'var(--text-secondary)' }}>
      <span style={{ width: 20, height: 20, border: '2px solid var(--track)', borderTopColor: 'var(--leaf)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} aria-hidden="true" />
      <span>Cargando…</span>
    </div>
  );
}


// ─── Auth pages don't show the nav/alert bar ──────────────────────────────────

const AUTH_PATHS = ['/login', '/onboarding'];

function AppShell() {
  const { user } = useAuth();
  const location = useLocation();

  const isAuthPage = AUTH_PATHS.some((p) => location.pathname.startsWith(p));

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isAuthPage && <Navigation />}
      {!isAuthPage && user && <ConnectionBanner />}
      {/* En Alertas ya está la lista completa; los avisos flotantes la tapaban (T3.2 #72) */}
      {!isAuthPage && location.pathname !== '/alerts' && <AlertSystem />}
      {/* Recorrido para usuarios nuevos: sale solo la primera vez en el tablero */}
      {!isAuthPage && user && <GuidedTour />}

      <main style={{ flex: 1 }}>
        {/* El ErrorBoundary va por fuera del Suspense: también atrapa una página
            que no se pudo descargar (por ejemplo, tras publicar una versión nueva). */}
        <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* ── Public routes ── */}
          {/* Con sesión, la landing de marketing no aplica: "Inicio" es el tablero (revisión UI 25 nov). */}
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
          <Route
            path="/login"
            element={
              // If already logged in, skip login page → go to dashboard
              user ? <Navigate to="/dashboard" replace /> : <LoginPage />
            }
          />
          
          <Route 
            path="/onboarding" 
            element={
              <ProtectedRoute requireWorkspace={false}>
                <OnboardingWizard />
              </ProtectedRoute>
            } 
          />

          {/* ── Protected routes (any authenticated user) ── */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AlertsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/control"
            element={
              <ProtectedRoute>
                <ControlPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plants"
            element={
              <ProtectedRoute>
                <PlantManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/zones"
            element={
              <ProtectedRoute>
                <ZonesPage />
              </ProtectedRoute>
            }
          />


          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
      <PushPermissionPrompt />
      <PwaUpdatePrompt />
    </AuthProvider>
  );
}

export default App;
