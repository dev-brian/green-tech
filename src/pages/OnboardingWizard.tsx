import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sprout, ArrowRight, Key, ShieldCheck, Wrench } from 'lucide-react';
import logoUrl from '../icons/icon_green-tech.svg';

type Mode = 'create' | 'join';

/* ── Tarjeta de selección de modo ───────────────────────── */
function ModeCard({
  selected,
  onClick,
  icon,
  title,
  subtitle,
  accent,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nm-flat"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'left',
        gap: 'var(--space-xs)',
        padding: 'var(--space-sm)',
        border: selected
          ? `1px solid ${accent}`
          : '1px solid rgba(255,255,255,0.03)',
        cursor: 'pointer',
        width: '100%',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        ...(selected && {
          boxShadow: `5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light), inset 0 0 16px rgba(${accent === 'var(--accent)' ? '16,185,129' : '59,130,246'}, 0.06)`,
        }),
      }}
    >
      <div style={{
        width: 40, height: 40,
        borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: selected ? `rgba(${accent === 'var(--accent)' ? '16,185,129' : '59,130,246'}, 0.1)` : 'transparent',
        transition: 'background 0.2s ease',
      }}
        className={selected ? '' : 'nm-concave'}
      >
        {icon}
      </div>
      <p style={{
        margin: 0,
        fontWeight: 700,
        fontSize: '0.9rem',
        color: selected ? accent : 'var(--text-primary)',
        transition: 'color 0.2s ease',
      }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {subtitle}
      </p>
    </button>
  );
}

/* ── Indicador de paso ───────────────────────────────────── */
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 'var(--space-md)' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="step-dot"
          style={{
            height: 6,
            width: i === current ? 20 : 6,
            borderRadius: 'var(--radius-full)',
            background: i === current ? 'var(--accent)' : 'var(--text-disabled)',
          }}
        />
      ))}
    </div>
  );
}

/* ── Página principal ────────────────────────────────────── */
export default function OnboardingWizard() {
  const { user, createWorkspace, joinWorkspaceByCode } = useAuth();
  const navigate = useNavigate();

  const [mode,    setMode]    = useState<Mode>('create');
  const [name,    setName]    = useState('');
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setName('');
    setCode('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true); setError(null);
    try { await createWorkspace(name); navigate('/dashboard'); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al crear el espacio.'); }
    finally { setLoading(false); }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !code.trim()) return;
    setLoading(true); setError(null);
    try { await joinWorkspaceByCode(code); navigate('/dashboard'); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al unirte al espacio.'); }
    finally { setLoading(false); }
  }

  const isCreate = mode === 'create';
  const accentColor = isCreate ? 'var(--accent)' : 'var(--status-blue)';

  return (
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
        style={{ width: '100%', maxWidth: 460 }}
      >

        {/* ── Marca ───────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <div className="nm-flat" style={{
            width: 64, height: 64,
            borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-sm)',
          }}>
            <img src={logoUrl} alt="Green Tech" style={{ width: 38, height: 38, objectFit: 'contain' }} />
          </div>
          <StepDots current={0} total={2} />
          <h1 style={{
            margin: 0,
            fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}>
            Configura tu Invernadero
          </h1>
          <p style={{ margin: 'var(--space-xs) 0 0', fontSize: '0.875rem' }}>
            Crea un espacio propio o únete a uno existente.
          </p>
        </div>

        {/* ── Panel principal ──────────────────────────── */}
        <div className="nm-flat" style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-lg)' }}>

          {/* ── Selector de modo: Crear / Unirse ──────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
            <ModeCard
              selected={isCreate}
              onClick={() => switchMode('create')}
              icon={<ShieldCheck size={20} strokeWidth={1.5} color={isCreate ? 'var(--accent)' : 'var(--text-disabled)'} />}
              title="Crear"
              subtitle="Nuevo invernadero, rol Administrador."
              accent="var(--accent)"
            />
            <ModeCard
              selected={!isCreate}
              onClick={() => switchMode('join')}
              icon={<Wrench size={20} strokeWidth={1.5} color={!isCreate ? 'var(--status-blue)' : 'var(--text-disabled)'} />}
              title="Unirme"
              subtitle="Acceder con código, rol Operador."
              accent="var(--status-blue)"
            />
          </div>

          {/* ── Banner informativo ────────────────────── */}
          <div className="nm-concave" style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-xs)',
            padding: 'var(--space-sm)',
            marginBottom: 'var(--space-md)',
            borderLeft: `3px solid ${accentColor}`,
            borderRadius: 'var(--radius-sm)',
          }}>
            {isCreate
              ? <ShieldCheck size={16} strokeWidth={1.5} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              : <Key        size={16} strokeWidth={1.5} color="var(--status-blue)" style={{ flexShrink: 0, marginTop: 2 }} />
            }
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {isCreate ? (
                <>
                  <strong style={{ color: 'var(--text-primary)' }}>Administrador: </strong>
                  Serás el propietario con control total sobre plantas, configuración y códigos de invitación.
                </>
              ) : (
                <>
                  <strong style={{ color: 'var(--text-primary)' }}>Operador: </strong>
                  Ingresa el código de 6 caracteres que te proporcionó tu administrador (ej.{' '}
                  <code style={{ fontFamily: 'monospace', color: 'var(--status-blue)', letterSpacing: '0.1em' }}>GT-7K9M</code>
                  ).
                </>
              )}
            </p>
          </div>

          {/* ── Error ────────────────────────────────── */}
          {error && (
            <div className="nm-concave" style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
              padding: 'var(--space-sm)',
              marginBottom: 'var(--space-sm)',
              borderLeft: '3px solid var(--status-red)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--status-red)' }}>{error}</span>
            </div>
          )}

          {/* ── Formulario: Crear ─────────────────────── */}
          {isCreate ? (
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <div>
                <label className="metric-label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
                  Nombre del Invernadero
                </label>
                <div style={{ position: 'relative' }}>
                  <Sprout
                    size={16} strokeWidth={1.5}
                    color="var(--text-disabled)"
                    style={{
                      position: 'absolute', left: 'var(--space-sm)',
                      top: '50%', transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej. Invernadero Hidropónico Norte"
                    className="nm-concave"
                    style={{
                      width: '100%',
                      minHeight: 48,
                      padding: '0 var(--space-sm) 0 calc(var(--space-sm) + 24px)',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.9375rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  />
                </div>
              </div>

              <button
                id="create-workspace-btn"
                type="submit"
                disabled={loading || !name.trim()}
                className="btn-primary"
                style={{
                  marginTop: 'var(--space-xs)',
                  color: loading ? 'var(--text-disabled)' : 'var(--accent)',
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 18, height: 18, flexShrink: 0,
                      border: '2px solid var(--text-disabled)',
                      borderTopColor: 'var(--accent)',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                      display: 'inline-block',
                    }} />
                    Creando...
                  </>
                ) : (
                  <>
                    Crear Invernadero
                    <ArrowRight size={18} strokeWidth={1.5} />
                  </>
                )}
              </button>
            </form>

          ) : (
            /* ── Formulario: Unirse ──────────────────── */
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <div>
                <label className="metric-label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
                  Código de Invitación
                </label>
                <div style={{ position: 'relative' }}>
                  <Key
                    size={16} strokeWidth={1.5}
                    color="var(--text-disabled)"
                    style={{
                      position: 'absolute', left: 'var(--space-sm)',
                      top: '50%', transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    required
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="GT-8X9B2"
                    maxLength={10}
                    className="nm-concave"
                    style={{
                      width: '100%',
                      minHeight: 48,
                      padding: '0 var(--space-sm) 0 calc(var(--space-sm) + 24px)',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--status-blue)',
                      fontSize: '1.125rem',
                      fontFamily: 'monospace',
                      letterSpacing: '0.15em',
                      fontWeight: 700,
                      borderRadius: 'var(--radius-sm)',
                    }}
                  />
                </div>
              </div>

              <button
                id="join-workspace-btn"
                type="submit"
                disabled={loading || !code.trim()}
                className="btn-primary"
                style={{
                  marginTop: 'var(--space-xs)',
                  color: loading ? 'var(--text-disabled)' : 'var(--status-blue)',
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 18, height: 18, flexShrink: 0,
                      border: '2px solid var(--text-disabled)',
                      borderTopColor: 'var(--status-blue)',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                      display: 'inline-block',
                    }} />
                    Verificando código...
                  </>
                ) : (
                  <>
                    Unirme como Operador
                    <ArrowRight size={18} strokeWidth={1.5} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* ── Leaf decorativo neumórfico (sutil) ──────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 'var(--space-xs)',
          marginTop: 'var(--space-lg)',
        }}>
          <span
            className="nm-led nm-led--green"
            style={{ width: 8, height: 8 }}
            role="status"
            aria-label="Sistema activo"
          />
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-disabled)' }}>
            Sistema GREEN TECH — {user?.email}
          </p>
        </div>

      </div>
    </div>
  );
}
