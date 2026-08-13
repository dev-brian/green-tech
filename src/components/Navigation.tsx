import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  Settings2,
  Leaf,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Wrench,
  Sprout
} from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';
import logoUrl from '../icons/logo-green-tech.png';

// ─── Nav items per role ───────────────────────────────────────────────────────

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  /** Omit to allow all roles */
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/',          label: 'Inicio',       icon: Home },
  { path: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/control',   label: 'Alertas',      icon: Settings2 },
  { path: '/plants',    label: 'Plantas',       icon: Leaf, roles: ['admin'] },
];

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  return role === 'admin' ? (
    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
      <ShieldCheck size={10} />
      Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
      <Wrench size={10} />
      Operador
    </span>
  );
}

import { Settings, Plus } from 'lucide-react';
import WorkspaceSettingsModal from './WorkspaceSettingsModal';

// ─── Workspace Selector ───────────────────────────────────────────────────────

function WorkspaceSelector() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  if (!activeWorkspace) return null;

  return (
    <>
      <div className="relative flex items-center gap-1">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-white/5 transition-all text-xs sm:text-sm text-white min-h-[40px]"
        >
          <Sprout size={14} className="text-emerald-500 flex-shrink-0" />
          <span className="max-w-[75px] xs:max-w-[100px] sm:max-w-[120px] truncate text-slate-300 text-xs font-medium">
            {activeWorkspace.name}
          </span>
          <ChevronDown
            size={14}
            className={`text-slate-500 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        <button
          onClick={() => setShowSettingsModal(true)}
          className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-white/5 transition-all text-slate-400 hover:text-white"
          title="Configuración del Invernadero"
        >
          <Settings size={15} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-2 z-40 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-[fadeIn_0.15s_ease]">
              <div className="px-3 py-2 border-b border-white/10 bg-slate-800/30 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mis Invernaderos</span>
                <span className="text-[10px] text-slate-400 font-medium">{workspaces.length}</span>
              </div>
              
              <div className="max-h-48 overflow-y-auto">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setActiveWorkspace(ws);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors text-left ${
                      activeWorkspace.id === ws.id 
                        ? 'bg-emerald-500/10 text-emerald-400 font-semibold' 
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate max-w-[120px]">{ws.name}</span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${
                      ws.role === 'admin' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {ws.role}
                    </span>
                  </button>
                ))}
              </div>

              <div className="p-1.5 border-t border-white/10 bg-slate-950/40 flex flex-col gap-1">
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowSettingsModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Settings size={13} className="text-slate-400" />
                  Configurar Invernadero
                </button>

                <button
                  onClick={() => {
                    setOpen(false);
                    navigate('/onboarding');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors font-medium"
                >
                  <Plus size={13} />
                  + Crear o Unirme a Invernadero
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <WorkspaceSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </>
  );
}

// ─── User menu (desktop) ──────────────────────────────────────────────────────

function UserMenu() {
  const { user, logout, currentRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="relative">
      <button
        id="user-menu-btn"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm text-white"
      >
        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:block max-w-[120px] truncate text-slate-200 text-xs font-medium">
          {user.name}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 w-52 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-[fadeIn_0.15s_ease]">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-white text-sm font-semibold truncate">{user.name}</p>
              <p className="text-slate-400 text-xs truncate">{user.email}</p>
              <div className="mt-1.5">
                <RoleBadge role={currentRole} />
              </div>
            </div>

            <button
              id="logout-btn"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={15} className="text-red-400" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, currentRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  async function handleMobileLogout() {
    await logout();
    navigate('/login');
    setIsOpen(false);
  }

  // Filter nav items by role
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(currentRole)
  );

  return (
    <nav
      style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
      className="py-2 sm:py-3 lg:py-5"
    >
      <div className="container flex justify-between items-center px-4 md:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 lg:gap-3 lg:w-1/4 hover:opacity-80 transition-opacity">
          <img src={logoUrl} alt="GreenTech" className="w-9 h-9 lg:w-11 lg:h-11 object-contain drop-shadow-md" />
          <span className="text-white font-extrabold tracking-tight text-xl lg:text-2xl hidden sm:block drop-shadow-sm">
            Green<span className="text-emerald-400">Tech</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center justify-center gap-8 lg:w-2/4">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative py-1.5 text-[13px] lg:text-[14px] uppercase tracking-widest font-bold transition-all duration-300 ${
                  isActive
                    ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute -bottom-2.5 left-1/2 w-1.5 h-1.5 bg-emerald-400 rounded-full -translate-x-1/2 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right side: workspace selector + user menu + mobile toggle */}
        <div className="flex items-center justify-end gap-3 lg:w-1/4">
          {user && (
            <>
              <WorkspaceSelector />
              <UserMenu />
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            id="mobile-menu-toggle"
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setIsOpen((v) => !v)}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="lg:hidden border-t border-white/10 mt-2 bg-slate-900/95 backdrop-blur-xl absolute w-full shadow-2xl">
          <div className="container py-3 flex flex-col gap-1 px-4">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}

            {user && (
              <button
                id="mobile-logout-btn"
                onClick={handleMobileLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all min-h-[48px] mt-1 border-t border-white/10 pt-3"
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
