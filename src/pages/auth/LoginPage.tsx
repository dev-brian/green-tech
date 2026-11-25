import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { useAuth, LS_PRIVACY_ACCEPTED } from '../../context/AuthContext';
import iconUrl from '../../icons/icon_green-tech.svg';
import { CONTACT_EMAIL } from '../../lib/brand';
import PrivacyDetails from '../../components/PrivacyDetails';

/* ── Modal de Aviso de Privacidad ───────────────────────── */
function PrivacyNoticeModal({ onAccept }: { onAccept: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const p: React.CSSProperties = { fontSize: '0.875rem', lineHeight: 1.65, margin: '0 0 var(--space-xs)' };
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
      padding: 'var(--space-sm)',
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: 'calc(100dvh - 2 * var(--space-sm))',
          overflowY: 'auto',
          padding: 'var(--space-md)',
          background: 'var(--surface-strong)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
          <ShieldAlert size={20} strokeWidth={1.5} color="var(--accent)" />
          <h3 id="privacy-title" style={{ margin: 0, fontSize: '1.05rem' }}>Aviso de privacidad</h3>
        </div>
        <p style={p}>
          GreenTech, un producto de Palarix, usa tu nombre, tu correo y las lecturas de tu invernadero
          solo para que funcione el monitoreo.{' '}
          <strong style={{ color: 'var(--text-primary)' }}>No vendemos ni compartimos tus datos con terceros.</strong>
        </p>
        <p style={p}>
          Para ejercer tus derechos ARCO (
          <abbr title="Ley Federal de Protección de Datos Personales en Posesión de los Particulares">LFPDPPP</abbr>)
          escríbenos a{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent)', overflowWrap: 'anywhere' }}>{CONTACT_EMAIL}</a>.
        </p>

        {expanded && (
          <div id="privacy-full" style={{ borderTop: '1px solid var(--line)', marginTop: 'var(--space-sm)', paddingTop: 'var(--space-xs)' }}>
            <PrivacyDetails />
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
          <button
            id="privacy-accept-btn"
            onClick={onAccept}
            className="btn-primary"
            style={{ flex: 1, minWidth: 160 }}
          >
            Aceptar y continuar
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="privacy-full"
            style={{
              display: 'flex',
              alignItems: 'center',
              minHeight: 48,
              padding: '0 var(--space-sm)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Leer menos' : 'Leer más'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Página de Login ────────────────────────────────────── */
export default function LoginPage() {
  const { loginWithGoogle, error, clearError, loading, user } = useAuth();
  const navigate  = useNavigate();
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [showPrivacy, setShowPrivacy]       = useState(() => !localStorage.getItem(LS_PRIVACY_ACCEPTED));

  const from = '/dashboard';

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

      {/* ── Layout centrado ─────────────────────────── */}
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: 'var(--space-md) var(--space-sm)',
      }}>
        <div
          className="animate-fade-in"
          style={{ width: '100%', maxWidth: 400 }}
        >

          {/* ── Marca ─────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            {/* Icono oficial en contenedor neumórfico */}
            <div className="nm-flat" style={{
              width: 80,
              height: 80,
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-md)',
            }}>
              <img
                src={iconUrl}
                alt="GreenTech"
                style={{ width: 48, height: 48, objectFit: 'contain' }}
              />
            </div>

            <h1 style={{
              fontSize: 'clamp(1.5rem, 5vw, 2rem)',
              fontWeight: 900,
              margin: 0,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}>
              Green<span style={{ color: 'var(--accent)' }}>Tech</span>
            </h1>
            <p style={{ marginTop: 'var(--space-xs)', marginBottom: 0, fontSize: '0.875rem' }}>
              Monitoreo de invernaderos hidropónicos, por Palarix
            </p>
          </div>

          {/* ── Tarjeta de Login ──────────────────────── */}
          <div className="nm-flat" style={{ padding: 'var(--space-md)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, marginBottom: 4, textAlign: 'center' }}>
              Iniciar sesión
            </h2>
            <p style={{ textAlign: 'center', fontSize: '0.875rem', marginBottom: 'var(--space-md)' }}>
              Accede a tu espacio de trabajo.
            </p>

            {/* Error */}
            {error && (
              <div className="nm-concave" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-xs)',
                padding: 'var(--space-sm)',
                marginBottom: 'var(--space-sm)',
                borderLeft: '3px solid var(--status-red)',
              }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--status-red)', flex: 1 }}>{error}</span>
                <button
                  onClick={clearError}
                  style={{ background: 'none', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer', padding: 4 }}
                  aria-label="Cerrar error"
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </div>
            )}

            {/* Botón de Google */}
            <button
              id="google-login-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="nm-flat"
              style={{
                width: '100%',
                minHeight: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-sm)',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                borderRadius: 'var(--radius-md)',
                padding: '0 var(--space-md)',
                transition: 'box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s',
              }}
            >
              {loading ? (
                <div style={{
                  width: 22, height: 22,
                  border: '2px solid var(--text-disabled)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
              ) : (
                <>
                  {/* Google G */}
                  <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                    Continuar con Google
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Footer */}
          <p style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-disabled)',
            marginTop: 'var(--space-lg)',
          }}>
            © {new Date().getFullYear()} Palarix · Universidad Tecnológica de Tlaxcala
          </p>
        </div>
      </div>
    </>
  );
}
