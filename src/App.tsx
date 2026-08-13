import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation';
import AlertSystem from './components/AlertSystem';

// Pages
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import ControlPanel from './pages/ControlPanel';
import PlantManagement from './pages/PlantManagement';
import LoginPage from './pages/auth/LoginPage';
import OnboardingWizard from './pages/OnboardingWizard';

// ─── Auth pages don't show the nav/alert bar ──────────────────────────────────

const AUTH_PATHS = ['/login', '/onboarding'];

function AppShell() {
  const { user } = useAuth();
  const location = useLocation();

  const isAuthPage = AUTH_PATHS.some((p) => location.pathname.startsWith(p));

  return (
    <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isAuthPage && <Navigation />}
      {!isAuthPage && <AlertSystem />}

      <main style={{ flex: 1 }}>
        <Routes>
          {/* ── Public routes ── */}
          <Route path="/" element={<Landing />} />
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
              <ProtectedRoute allowedRoles={['admin']}>
                <PlantManagement />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
    </AuthProvider>
  );
}

export default App;
