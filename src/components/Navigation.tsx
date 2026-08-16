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
import logoUrl from '../icons/icon_green-tech.svg';

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
  const isAdmin = role === 'admin';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: isAdmin ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
      color: isAdmin ? 'var(--status-green)' : 'var(--status-blue)',
      border: `1px solid ${isAdmin ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
      borderRadius: 'var(--radius-full)',
      padding: '2px 8px',
      fontSize: '0.625rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    }}>
      {isAdmin ? <ShieldCheck size={9} strokeWidth={2} /> : <Wrench size={9} strokeWidth={2} />}
      {isAdmin ? 'Admin' : 'Operador'}
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
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>

        {/* Botón principal del selector */}
        <button
          id="workspace-selector-btn"
          onClick={() => setOpen(v => !v)}
          className="nm-flat"
          style={{
            display: 'flex', alignItems: 'center',
            gap: 'var(--space-xs)',
            padding: '0 var(--space-sm)',
            minHeight: 40,
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            maxWidth: 180,
          }}
        >
          <Sprout size={14} strokeWidth={1.5} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '0.8125rem', fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: 120,
          }}>
            {activeWorkspace.name}
          </span>
          <ChevronDown
            size={12} strokeWidth={1.5}
            color="var(--text-disabled)"
            style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {/* Botón de configuración */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="nm-flat"
          title="Configuración del Invernadero"
          style={{
            width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          <Settings size={14} strokeWidth={1.5} />
        </button>

        {/* Dropdown */}
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setOpen(false)} />
            <div
              className="nm-flat animate-fade-in"
              style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                zIndex: 40, width: 224,
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              {/* Cabecera del dropdown */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--space-xs) var(--space-sm)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span className="metric-label">Mis Invernaderos</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-disabled)', fontWeight: 700 }}>{workspaces.length}</span>
              </div>

              {/* Lista de workspaces */}
              <div style={{ maxHeight: 192, overflowY: 'auto' }}>
                {workspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => { setActiveWorkspace(ws); setOpen(false); }}
                    style={{
                      width: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between',
                      padding: 'var(--space-xs) var(--space-sm)',
                      background: activeWorkspace.id === ws.id ? 'rgba(16,185,129,0.08)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      minHeight: 40, textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => { if (activeWorkspace.id !== ws.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (activeWorkspace.id !== ws.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      fontSize: '0.8125rem', fontWeight: 600,
                      color: activeWorkspace.id === ws.id ? 'var(--accent)' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120,
                    }}>
                      {ws.name}
                    </span>
                    <RoleBadge role={ws.role as UserRole} />
                  </button>
                ))}
              </div>

              {/* Acciones del footer */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: 'var(--space-xs)' }}>
                <button
                  onClick={() => { setOpen(false); setShowSettingsModal(true); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    gap: 'var(--space-xs)',
                    padding: 'var(--space-xs) var(--space-sm)',
                    minHeight: 40, border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8125rem', fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  <Settings size={13} strokeWidth={1.5} />
                  Configurar Invernadero
                </button>

                <button
                  onClick={() => { setOpen(false); navigate('/onboarding'); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    gap: 'var(--space-xs)',
                    padding: 'var(--space-xs) var(--space-sm)',
                    minHeight: 40, border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    color: 'var(--accent)',
                    fontSize: '0.8125rem', fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={13} strokeWidth={1.5} />
                  Crear o Unirme
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
    <div style={{ position: 'relative' }}>
      {/* Avatar + nombre */}
      <button
        id="user-menu-btn"
        onClick={() => setOpen(v => !v)}
        className="nm-flat"
        style={{
          display: 'flex', alignItems: 'center',
          gap: 'var(--space-xs)',
          padding: '0 var(--space-xs) 0 var(--space-xs)',
          minHeight: 40, border: 'none',
          borderRadius: 'var(--radius-md)', cursor: 'pointer',
        }}
      >
        {/* Avatar circular neumórfico */}
        <div className="nm-concave" style={{
          width: 28, height: 28,
          borderRadius: 'var(--radius-full)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', fontWeight: 800,
          color: 'var(--accent)',
          flexShrink: 0,
        }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:block" style={{
          fontSize: '0.8125rem', fontWeight: 600,
          color: 'var(--text-primary)',
          maxWidth: 100,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user.name}
        </span>
        <ChevronDown
          size={12} strokeWidth={1.5} color="var(--text-disabled)"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {/* Dropdown del perfil */}
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setOpen(false)} />
          <div
            className="nm-flat animate-fade-in"
            style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)',
              zIndex: 40, width: 216,
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {/* Info del usuario */}
            <div style={{
              padding: 'var(--space-sm)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              {/* Avatar grande */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                <div className="nm-concave" style={{
                  width: 40, height: 40,
                  borderRadius: 'var(--radius-full)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', fontWeight: 800, color: 'var(--accent)',
                  flexShrink: 0,
                }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.name}
                  </p>
                  <p className="metric-timestamp" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </p>
                </div>
              </div>
              <RoleBadge role={currentRole} />
            </div>

            {/* Cerrar sesión */}
            <button
              id="logout-btn"
              onClick={handleLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: 'var(--space-xs)',
                padding: 'var(--space-sm)',
                minHeight: 48, border: 'none',
                background: 'transparent',
                color: 'var(--status-red)',
                fontSize: '0.875rem', fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut size={16} strokeWidth={1.5} />
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
        background: 'var(--bg)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        boxShadow: '0 4px 8px var(--shadow-dark)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: 'var(--space-sm) 0',
      }}
    >
      <div className="container flex justify-between items-center">
        {/* Brand */}
        <Link
          to="/"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', textDecoration: 'none', flex: '0 0 auto' }}
        >
          <img src={logoUrl} alt="GreenTech" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: '1.125rem', color: 'var(--text-primary)' }} className="hidden sm:block">
            Green<span style={{ color: 'var(--accent)' }}>Tech</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex" style={{ alignItems: 'center', gap: 'var(--space-lg)' }}>
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  position: 'relative',
                  paddingBottom: 6,
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
              >
                {item.label}
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    bottom: -2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    boxShadow: '0 0 8px var(--accent-glow)',
                  }} />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right: workspace selector + user menu + mobile toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          {user && (
            <>
              <WorkspaceSelector />
              <UserMenu />
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            id="mobile-menu-toggle"
            className="mobile-menu-btn lg:hidden"
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setIsOpen((v) => !v)}
          >
            {isOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div
          className="lg:hidden"
          style={{
            position: 'absolute',
            width: '100%',
            background: 'var(--bg)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            boxShadow: '0 8px 16px var(--shadow-dark)',
            zIndex: 40,
          }}
        >
          <div className="container" style={{ paddingTop: 'var(--space-xs)', paddingBottom: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    padding: 'var(--space-sm)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    minHeight: 48,
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    background: isActive ? 'rgba(16,185,129,0.08)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'color 0.15s ease, background 0.15s ease',
                  }}
                >
                  <Icon size={20} strokeWidth={1.5} />
                  {item.label}
                </Link>
              );
            })}

            {user && (
              <button
                id="mobile-logout-btn"
                onClick={handleMobileLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  padding: 'var(--space-sm)',
                  borderRadius: 'var(--radius-md)',
                  minHeight: 48,
                  color: 'var(--status-red)',
                  background: 'transparent',
                  border: 'none',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  marginTop: 'var(--space-xs)',
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <LogOut size={20} strokeWidth={1.5} />
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
