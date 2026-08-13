import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, Leaf } from 'lucide-react';
import { useAuth, LS_PRIVACY_ACCEPTED } from '../../context/AuthContext';

function PrivacyNoticeModal({ onAccept }: { onAccept: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      padding: '1rem',
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%', maxWidth: 480,
        borderColor: 'rgba(16,185,129,0.25)',
        boxShadow: '0 0 40px rgba(16,185,129,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <ShieldAlert size={20} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)' }}>Aviso de Privacidad</h3>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
          GREEN TECH recopila tu nombre, correo y datos de uso para operar el sistema de monitoreo.
          Tus datos se almacenan cifrados y <strong style={{ color: 'var(--text-main)' }}>no se comparten con terceros</strong> sin tu consentimiento.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
          Tienes derechos ARCO conforme a la <abbr title="Ley Federal de Protección de Datos Personales en Posesión de los Particulares">LFPDPPP</abbr>.{' '}
          Contáctanos en <span style={{ color: 'var(--accent-green)' }}>privacidad@greentech.mx</span>.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            id="privacy-accept-btn"
            onClick={onAccept}
            className="btn-primary"
            style={{ flex: 1, minHeight: 48 }}
          >
            Aceptar y continuar
          </button>
          <a href="#" style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Leer más
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { loginWithGoogle, error, clearError, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loginAttempted, setLoginAttempted] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(() => !localStorage.getItem(LS_PRIVACY_ACCEPTED));

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  function handleAcceptPrivacy() {
    localStorage.setItem(LS_PRIVACY_ACCEPTED, 'true');
    setShowPrivacy(false);
  }

  async function handleGoogleLogin() {
    setLoginAttempted(true);
    clearError();
    await loginWithGoogle();
  }

  if (loginAttempted && !loading && !error && user) {
    navigate(from, { replace: true });
  }

  return (
    <>
      {showPrivacy && <PrivacyNoticeModal onAccept={handleAcceptPrivacy} />}

      {/* Full-page layout */}
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-color)', padding: '2rem 1rem',
        backgroundImage: 'radial-gradient(circle at top right, rgba(16,185,129,0.12), transparent 45%), radial-gradient(circle at bottom left, rgba(59,130,246,0.08), transparent 45%)',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }} className="animate-fade-in">

          {/* ── Brand ── */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            {/* Logo circle */}
            <div style={{
              width: 64, height: 64, borderRadius: '18px',
              background: 'var(--accent-green-glow)',
              border: '1px solid rgba(16,185,129,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: '0 0 30px rgba(16,185,129,0.2)',
            }}>
              <Leaf size={30} style={{ color: 'var(--accent-green)' }} />
            </div>
            <h1 style={{
              fontSize: 'clamp(1.6rem, 5vw, 2rem)', fontWeight: 900, margin: 0,
              background: 'linear-gradient(135deg, #fff 40%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              GREEN<span style={{ background: 'linear-gradient(135deg,#10b981,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> TECH</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.4rem', marginBottom: 0 }}>
              Sistema inteligente de invernadero
            </p>
          </div>

          {/* ── Card ── */}
          <div className="glass-panel" style={{ padding: '2.5rem 2rem', borderColor: 'rgba(255,255,255,0.08)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-main)', textAlign: 'center' }}>
              Iniciar sesión
            </h2>
            <p className="text-center text-slate-400 text-sm mb-6">
              Accede a tu espacio de trabajo para continuar.
            </p>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center flex items-center justify-between">
                <span>{error}</span>
                <button onClick={clearError} className="text-red-400 opacity-70 hover:opacity-100">✕</button>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl py-3 px-4 flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[52px]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <>
                  {/* Google G Logo SVG */}
                  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>
          </div>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'rgba(148,163,184,0.4)', marginTop: '1.75rem' }}>
            © {new Date().getFullYear()} Palarix — Universidad Tecnológica de Tlaxcala
          </p>
        </div>
      </div>
    </>
  );
}
