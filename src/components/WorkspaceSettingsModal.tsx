import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Copy,
  Check,
  RefreshCw,
  UserX,
  LogOut,
  ShieldCheck,
  Wrench,
  Users,
  Key,
  AlertTriangle
} from 'lucide-react';
import { useAuth, type WorkspaceMember } from '../context/AuthContext';

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ── Badge de rol ─────────────────────────────────────────── */
function RoleBadge({ role }: { role: 'admin' | 'operador' }) {
  const isAdmin = role === 'admin';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: isAdmin ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
      color: isAdmin ? 'var(--status-green)' : 'var(--status-blue)',
      border: `1px solid ${isAdmin ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
      borderRadius: 'var(--radius-full)',
      padding: '2px 8px',
      fontSize: '0.625rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      flexShrink: 0,
    }}>
      {isAdmin ? <ShieldCheck size={9} strokeWidth={2} /> : <Wrench size={9} strokeWidth={2} />}
      {isAdmin ? 'Admin' : 'Operador'}
    </span>
  );
}

/* ── Avatar de inicial ────────────────────────────────────── */
function Avatar({ name }: { name: string }) {
  return (
    <div className="nm-flat" style={{
      width: 36,
      height: 36,
      borderRadius: 'var(--radius-full)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontSize: '0.875rem',
      fontWeight: 700,
      color: 'var(--accent)',
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function WorkspaceSettingsModal({ isOpen, onClose }: WorkspaceSettingsModalProps) {
  const {
    activeWorkspace,
    user,
    isAdmin,
    getWorkspaceInviteCode,
    regenerateInviteCode,
    getWorkspaceMembers,
    removeMember,
    leaveWorkspace
  } = useAuth();

  const [inviteCode,     setInviteCode]     = useState<string>('');
  const [members,        setMembers]        = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingCode,    setLoadingCode]    = useState(true);
  const [copied,         setCopied]         = useState(false);
  const [actionError,    setActionError]    = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !activeWorkspace || !isAdmin) return;
    let isMounted = true;

    getWorkspaceInviteCode(activeWorkspace.id)
      .then(code => { if (isMounted) setInviteCode(code); })
      .catch(err => console.error('Error fetching invite code:', err))
      .finally(() => { if (isMounted) setLoadingCode(false); });

    getWorkspaceMembers(activeWorkspace.id)
      .then(list => { if (isMounted) setMembers(list); })
      .catch(err => console.error('Error fetching members:', err))
      .finally(() => { if (isMounted) setLoadingMembers(false); });

    return () => { isMounted = false; };
  }, [isOpen, activeWorkspace, isAdmin, getWorkspaceInviteCode, getWorkspaceMembers]);

  if (!isOpen || !activeWorkspace || !user) return null;

  async function handleCopyCode() {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerateCode() {
    if (!activeWorkspace) return;
    if (!window.confirm('¿Regenerar el código? El anterior dejará de funcionar inmediatamente.')) return;
    setLoadingCode(true);
    setActionError(null);
    try {
      const newCode = await regenerateInviteCode(activeWorkspace.id);
      setInviteCode(newCode);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al regenerar código');
    } finally {
      setLoadingCode(false);
    }
  }

  async function handleRemoveMember(uid: string, name?: string) {
    if (!activeWorkspace) return;
    if (!window.confirm(`¿Expulsar a ${name || 'este integrante'} del invernadero?`)) return;
    setActionError(null);
    try {
      await removeMember(activeWorkspace.id, uid);
      setMembers(prev => prev.filter(m => m.uid !== uid));
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al expulsar integrante');
    }
  }

  async function handleLeaveWorkspace() {
    if (!activeWorkspace) return;
    if (!window.confirm(`¿Abandonar "${activeWorkspace.name}"? Perderás acceso inmediatamente.`)) return;
    setActionError(null);
    try {
      await leaveWorkspace(activeWorkspace.id);
      onClose();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al abandonar el invernadero');
    }
  }

  const modalContent = (
    /* ── Backdrop ─────────────────────────────────────────── */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-sm)',
        background: 'rgba(0,0,0,0.72)',
      }}
    >
      {/* ── Panel principal ──────────────────────────────── */}
      <div
        onClick={e => e.stopPropagation()}
        className="nm-flat animate-fade-in"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        {/* ── Cabecera ─────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-sm)',
          padding: 'var(--space-md)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 4 }}>
              <h3 style={{
                margin: 0,
                fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 220,
              }}>
                {activeWorkspace.name}
              </h3>
              <RoleBadge role={isAdmin ? 'admin' : 'operador'} />
            </div>
            <p className="metric-timestamp">
              Configuración e integrantes del espacio de trabajo
            </p>
          </div>

          <button
            onClick={onClose}
            className="nm-flat"
            aria-label="Cerrar modal"
            style={{
              width: 40, height: 40,
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Cuerpo (scrollable) ──────────────────────── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
        }}>

          {/* Error banner */}
          {actionError && (
            <div className="nm-concave" style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
              padding: 'var(--space-sm)',
              borderLeft: '3px solid var(--status-red)',
            }}>
              <AlertTriangle size={16} strokeWidth={1.5} color="var(--status-red)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--status-red)' }}>{actionError}</span>
            </div>
          )}

          {/* ── Código de invitación (solo Admin) ──────── */}
          {isAdmin && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
                <Key size={16} strokeWidth={1.5} color="var(--accent)" />
                <span className="metric-label">Código de Invitación</span>
              </div>
              <div className="nm-concave" style={{ padding: 'var(--space-sm)' }}>
                <p style={{ margin: '0 0 var(--space-sm)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Comparte este código para que operadores accedan al invernadero.
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-sm)',
                  flexWrap: 'wrap',
                }}>
                  {/* Código monospace */}
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                    fontWeight: 800,
                    color: 'var(--accent)',
                    letterSpacing: '0.2em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {loadingCode ? '· · · · · ·' : inviteCode}
                  </span>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    <button
                      onClick={handleCopyCode}
                      disabled={loadingCode || !inviteCode}
                      className="nm-flat"
                      title="Copiar código"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '0 var(--space-sm)',
                        minHeight: 40, border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: copied ? 'var(--accent)' : 'var(--text-secondary)',
                        fontSize: '0.8125rem', fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                      }}
                    >
                      {copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>

                    <button
                      onClick={handleRegenerateCode}
                      disabled={loadingCode}
                      className="nm-flat"
                      title="Regenerar código"
                      style={{
                        width: 40, height: 40,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                      }}
                    >
                      <RefreshCw size={14} strokeWidth={1.5} style={{ animation: loadingCode ? 'spin 0.7s linear infinite' : 'none' }} />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Lista de integrantes (solo Admin) ──────── */}
          {isAdmin && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-sm)' }}>
                <Users size={16} strokeWidth={1.5} color="var(--status-blue)" />
                <span className="metric-label">Integrantes ({members.length})</span>
              </div>

              {loadingMembers ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-xs)', padding: 'var(--space-xl)', color: 'var(--text-disabled)' }}>
                  <div style={{ width: 16, height: 16, border: '2px solid var(--text-disabled)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: '0.8125rem' }}>Cargando...</span>
                </div>
              ) : members.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-disabled)', fontStyle: 'italic', padding: 'var(--space-sm) 0' }}>
                  No hay otros integrantes registrados.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', maxHeight: 240, overflowY: 'auto' }}>
                  {members.map(member => {
                    const isSelf = member.uid === user.uid;
                    return (
                      <div
                        key={member.uid}
                        className="nm-concave"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 'var(--space-sm)',
                          padding: 'var(--space-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', overflow: 'hidden', flex: 1 }}>
                          <Avatar name={member.name || member.email || 'U'} />
                          <div style={{ overflow: 'hidden' }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {member.name || 'Usuario'}{isSelf && <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: '0.75rem' }}>(Tú)</span>}
                            </p>
                            <p className="metric-timestamp" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {member.email}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexShrink: 0 }}>
                          <RoleBadge role={member.role as 'admin' | 'operador'} />
                          {!isSelf && (
                            <button
                              onClick={() => handleRemoveMember(member.uid, member.name || member.email)}
                              title="Expulsar integrante"
                              className="nm-flat"
                              style={{
                                width: 32, height: 32,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: 'none', borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-disabled)', cursor: 'pointer',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--status-red)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-disabled)')}
                            >
                              <UserX size={14} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Footer de acciones ────────────────────────── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-sm)',
          padding: 'var(--space-md)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}>
          {/* Abandonar invernadero */}
          <button
            onClick={handleLeaveWorkspace}
            className="nm-flat btn-nm-danger"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 'var(--space-xs)',
              minHeight: 48,
              padding: '0 var(--space-md)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              flex: '1 1 auto',
            }}
          >
            <LogOut size={16} strokeWidth={1.5} />
            Abandonar Invernadero
          </button>

          {/* Cerrar */}
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ flex: '1 1 auto', minWidth: 100 }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
