import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, SquarePlus, Check, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

// ─── Instrucciones para iPhone/iPad ───────────────────────────────────────────

const IOS_STEPS = [
  { icon: Share, text: 'Toca el botón Compartir de Safari.' },
  { icon: SquarePlus, text: 'Elige "Agregar a inicio". Si no aparece, desliza la lista hacia abajo.' },
  { icon: Check, text: 'Toca "Agregar". GreenTech aparecerá en tu pantalla de inicio.' },
];

function IosInstallInstructions({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-sm)',
        background: 'rgba(0,0,0,0.6)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
        className="nm-flat animate-fade-in"
        onClick={(event) => event.stopPropagation()}
        style={{ width: '100%', maxWidth: 400, padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
          <h2 id="ios-install-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Instalar GreenTech
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar instrucciones"
            autoFocus
            style={{
              width: 48, height: 48, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {IOS_STEPS.map(({ icon: Icon, text }, index) => (
            <li key={text} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
              <span className="nm-concave" style={{ width: 48, height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span>{index + 1}. {text}</span>
            </li>
          ))}
        </ol>

        <p style={{ margin: 'var(--space-sm) 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Si no encuentras la opción, abre esta página en Safari.
        </p>
      </div>
    </div>,
    document.body,
  );
}

// ─── Botón de instalación ─────────────────────────────────────────────────────

interface PwaInstallButtonProps {
  /** `bar`: botón compacto de la barra. `menu`: fila del menú móvil. */
  variant: 'bar' | 'menu';
}

export default function PwaInstallButton({ variant }: PwaInstallButtonProps) {
  const { mode, promptInstall } = usePwaInstall();
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  if (mode === 'none') return null;

  const barStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center',
    gap: 'var(--space-xs)',
    padding: '0 var(--space-sm)',
    minHeight: 40,
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'var(--accent)',
    fontSize: '0.8125rem', fontWeight: 600,
    cursor: 'pointer',
  };

  const menuStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center',
    gap: 'var(--space-sm)',
    padding: 'var(--space-sm)',
    minHeight: 48,
    width: '100%',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: '0.9375rem', fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
  };

  return (
    <>
      <button
        onClick={() => (mode === 'ios' ? setShowIosInstructions(true) : void promptInstall())}
        className={variant === 'bar' ? 'nm-flat' : undefined}
        style={variant === 'bar' ? barStyle : menuStyle}
      >
        <Download size={variant === 'bar' ? 14 : 20} strokeWidth={1.5} aria-hidden="true" />
        Instalar app
      </button>

      {showIosInstructions && (
        <IosInstallInstructions onClose={() => setShowIosInstructions(false)} />
      )}
    </>
  );
}
