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

  const [inviteCode, setInviteCode] = useState<string>('');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingCode, setLoadingCode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Data fetching
  useEffect(() => {
    if (!isOpen || !activeWorkspace || !isAdmin) return;

    let isMounted = true;

    getWorkspaceInviteCode(activeWorkspace.id)
      .then((code) => {
        if (isMounted) setInviteCode(code);
      })
      .catch((err: unknown) => {
        console.error('Error fetching invite code:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingCode(false);
      });

    getWorkspaceMembers(activeWorkspace.id)
      .then((memberList) => {
        if (isMounted) setMembers(memberList);
      })
      .catch((err: unknown) => {
        console.error('Error fetching members:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingMembers(false);
      });

    return () => {
      isMounted = false;
    };
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
    if (!window.confirm('¿Estás seguro de regenerar el código? El código anterior dejará de funcionar inmediatamente.')) {
      return;
    }
    setLoadingCode(true);
    setActionError(null);
    try {
      const newCode = await regenerateInviteCode(activeWorkspace.id);
      setInviteCode(newCode);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al regenerar código';
      setActionError(msg);
    } finally {
      setLoadingCode(false);
    }
  }

  async function handleRemoveMember(memberUid: string, memberName?: string) {
    if (!activeWorkspace) return;
    if (!window.confirm(`¿Seguro que deseas expulsar a ${memberName || 'este integrante'} del invernadero?`)) {
      return;
    }
    setActionError(null);
    try {
      await removeMember(activeWorkspace.id, memberUid);
      setMembers((prev) => prev.filter((m) => m.uid !== memberUid));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al expulsar integrante';
      setActionError(msg);
    }
  }

  async function handleLeaveWorkspace() {
    if (!activeWorkspace) return;
    if (!window.confirm(`¿Seguro que deseas abandonar el invernadero "${activeWorkspace.name}"? Perderás acceso inmediatamente.`)) {
      return;
    }
    setActionError(null);
    try {
      await leaveWorkspace(activeWorkspace.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al abandonar el invernadero';
      setActionError(msg);
    }
  }

  const modalContent = (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.15s_ease]"
      style={{ margin: 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-white/10 bg-slate-800/40 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate max-w-[220px] sm:max-w-xs">{activeWorkspace.name}</h3>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0">
                  <ShieldCheck size={10} /> Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0">
                  <Wrench size={10} /> Operador
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs mt-1">Configuración e integrantes del espacio de trabajo</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5 sm:gap-6">

          {actionError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Section 1: Invite Code (Admin Only) */}
          {isAdmin && (
            <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-3.5 sm:p-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs sm:text-sm">
                  <Key size={16} className="text-emerald-400 flex-shrink-0" />
                  Código de Invitación
                </div>
                <span className="text-[11px] text-slate-400">Comparte este código para sumar operadores</span>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-950/70 border border-emerald-500/30 rounded-xl p-2.5">
                <span className="w-full sm:w-auto flex-1 font-mono text-center text-lg font-bold text-emerald-400 tracking-widest py-1 sm:py-0">
                  {loadingCode ? 'Cargando...' : inviteCode}
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleCopyCode}
                    disabled={loadingCode || !inviteCode}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 min-h-[38px]"
                    title="Copiar código"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    onClick={handleRegenerateCode}
                    disabled={loadingCode}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors disabled:opacity-50 min-w-[38px] min-h-[38px] flex items-center justify-center"
                    title="Regenerar código (Invalidar anterior)"
                  >
                    <RefreshCw size={14} className={loadingCode ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Member Management (Admin Only) */}
          {isAdmin && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-slate-200 font-semibold text-sm">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-400" />
                  Integrantes del Invernadero ({members.length})
                </div>
              </div>

              {loadingMembers ? (
                <div className="py-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
                  Cargando miembros...
                </div>
              ) : members.length === 0 ? (
                <p className="text-slate-500 text-xs italic">No hay otros miembros registrados.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {members.map((member) => {
                    const isSelf = member.uid === user.uid;
                    return (
                      <div
                        key={member.uid}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-white/5 text-xs"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400">
                            {(member.name || member.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-white font-medium truncate">
                              {member.name || 'Usuario'} {isSelf && '(Tú)'}
                            </p>
                            <p className="text-slate-400 text-[11px] truncate">{member.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {member.role === 'admin' ? (
                            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-emerald-500/20">
                              Admin
                            </span>
                          ) : (
                            <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-blue-500/20">
                              Operador
                            </span>
                          )}

                          {!isSelf && (
                            <button
                              onClick={() => handleRemoveMember(member.uid, member.name || member.email)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Expulsar integrante"
                            >
                              <UserX size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section 3: Actions Footer */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={handleLeaveWorkspace}
              className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-semibold transition-colors min-h-[42px]"
            >
              <LogOut size={16} />
              Abandonar Invernadero
            </button>

            <button
              onClick={onClose}
              className="w-full sm:w-auto flex items-center justify-center py-2.5 px-6 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-white text-xs font-semibold transition-colors min-h-[42px]"
            >
              Cerrar
            </button>
          </div>

        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
