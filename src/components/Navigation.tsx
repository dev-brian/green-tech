import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Settings2,
  Leaf,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Wrench,
  Sprout,
  Bell,
  MapPin,
  History as HistoryIcon,
  CircleHelp,
} from 'lucide-react';
import { requestTourStart } from '../lib/tour';
import { useAuth, type UserRole } from '../context/AuthContext';
import { useAlerts } from '../hooks/useAlerts';
import AlertBadge from './AlertBadge';
import { canAccess } from '../lib/routeAccess';
import PwaInstallButton from './PwaInstallButton';
import ThemeToggle from './ThemeToggle';
import logoUrl from '../icons/icon_green-tech.svg';


// ─── Nav items per role ───────────────────────────────────────────────────────

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  // Con sesión, "Inicio" es el tablero. La landing es solo para quien no ha
  // entrado (revisión UI 25 nov: "Inicio" y "Dashboard" confundían).
  { path: '/dashboard', label: 'Inicio',    icon: Home },
  { path: '/alerts',    label: 'Alertas',   icon: Bell },
  { path: '/history',   label: 'Histórico', icon: HistoryIcon },
  { path: '/control',   label: 'Equipos',   icon: Settings2 },
  { path: '/zones',     label: 'Zonas',     icon: MapPin },
  { path: '/plants',    label: 'Cultivos',  icon: Leaf },
];


// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: isAdmin ? 'var(--status-ok-soft)' : 'var(--status-blue-glow)',
      color: isAdmin ? 'var(--status-green)' : 'var(--status-blue)',
      border: `1px solid ${isAdmin ? 'var(--leaf)' : 'var(--status-blue)'}`,
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
            minHeight: 48,
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            maxWidth: 180,
            minWidth: 0,
          }}
        >
          <Sprout size={14} strokeWidth={1.5} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '0.8125rem', fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} className="ws-name">
            {activeWorkspace.name}
          </span>
          <ChevronDown
            size={12} strokeWidth={1.5}
            color="var(--text-disabled)"
            style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {/* Botón de configuración */}
        {/* En celular se abre desde el menú del invernadero (T3.2 #72: 360 px) */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="nm-flat hidden sm:flex"
          aria-label="Configuración del Invernadero"
          title="Configuración del Invernadero"
          style={{
            width: 48, height: 48,
            alignItems: 'center', justifyContent: 'center',
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
              className="dropdown-panel animate-fade-in"
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
                borderBottom: '1px solid var(--line)',
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
                      background: activeWorkspace.id === ws.id ? 'var(--status-ok-soft)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      minHeight: 40, textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => { if (activeWorkspace.id !== ws.id) e.currentTarget.style.background = 'var(--line)'; }}
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
              <div style={{ borderTop: '1px solid var(--line)', padding: 'var(--space-xs)' }}>
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
          minHeight: 48, minWidth: 48, justifyContent: 'center', border: 'none',
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
        <span className="nav-user-name" style={{
          fontSize: '0.8125rem', fontWeight: 600,
          color: 'var(--text-primary)',
          maxWidth: 100,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user.name}
        </span>
        <ChevronDown
          size={12} strokeWidth={1.5} color="var(--text-disabled)"
          className="nav-user-name"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {/* Dropdown del perfil */}
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setOpen(false)} />
          <div
            className="dropdown-panel animate-fade-in"
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
              borderBottom: '1px solid var(--line)',
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
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--status-crit-soft)')}
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
  const { user, logout, currentRole, activeWorkspace } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Badge de alertas no atendidas
  const { unattendedCount } = useAlerts(activeWorkspace?.id ?? null);

  async function handleMobileLogout() {
    await logout();
    navigate('/login');
    setIsOpen(false);
  }

  // Mismo criterio que ProtectedRoute (lib/routeAccess.ts, T1.1 #34)
  // Sin sesión (landing) no hay menú de la app: todas esas páginas piden entrar.
  const visibleItems = user ? NAV_ITEMS.filter((item) => canAccess(item.path, currentRole)) : [];


  return (
    <nav
      style={{
        background: 'var(--glass)',
        borderBottom: '1px solid var(--line)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: 'var(--space-sm) 0',
      }}
    >
      <div className="container flex justify-between items-center">
        {/* Brand */}
        <Link
          to={user ? '/dashboard' : '/'}
          aria-label="GreenTech, inicio"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', textDecoration: 'none', flex: '0 0 auto', minHeight: 48, minWidth: 48 }}
        >
          <img src={logoUrl} alt="GreenTech" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: '1.125rem', color: 'var(--text-primary)' }} className="hidden sm:block">
            GreenTech
          </span>
        </Link>

        {/* Desktop links */}
        <div className={visibleItems.length ? 'hidden xl:flex' : 'hidden'} style={{ alignItems: 'center', gap: 4, padding: 4, borderRadius: 'var(--radius-full)', background: 'var(--track)' }}>
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isAlertsLink = item.path === '/alerts';
            return (
              <Link
                key={item.path}
                to={item.path}
                data-tour={`nav-${item.path}`}
                style={{
                  position: 'relative',
                  minHeight: 44,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  background: isActive ? 'var(--ink-block)' : 'transparent',
                  color: isActive ? 'var(--text-on-ink)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {item.label}
                {isAlertsLink && <AlertBadge count={unattendedCount} />}
              </Link>
            );
          })}
        </div>


        {/* Right: workspace selector + user menu + mobile toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', minWidth: 0 }}>
          {/* En móvil va dentro del menú para no desbordar la barra a 375px */}
          <div className="hidden xl:flex">
            <PwaInstallButton variant="bar" />
          </div>

          <span className="hidden sm:flex" data-tour="tema"><ThemeToggle /></span>

          {user && (
            // En celular va dentro del menú para que la barra quepa en 360 px
            <span className="hidden sm:flex" data-tour="ayuda">
              <button
                type="button"
                className="icon-btn"
                onClick={requestTourStart}
                aria-label="Ver recorrido guiado"
                title="Ver recorrido guiado"
              >
                <CircleHelp size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </span>
          )}

          {user && (
            <>
              <WorkspaceSelector />
              <UserMenu />
            </>
          )}

          {!user && (
            <Link to="/login" className="btn-primary" style={{ width: 'auto', minHeight: 44, padding: '0 18px' }}>
              Entrar
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button
            id="mobile-menu-toggle"
            className="mobile-menu-btn xl:hidden"
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
          className="xl:hidden"
          style={{
            position: 'absolute',
            width: '100%',
            background: 'var(--bg)',
            borderTop: '1px solid var(--line)',
            boxShadow: '0 8px 16px var(--shadow-dark)',
            zIndex: 40,
          }}
        >
          <div className="container" style={{ paddingTop: 'var(--space-xs)', paddingBottom: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isAlertsLink = item.path === '/alerts';
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
                    background: isActive ? 'var(--status-ok-soft)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'color 0.15s ease, background 0.15s ease',
                  }}
                >
                  <Icon size={20} strokeWidth={1.5} />
                  {item.label}
                  {isAlertsLink && unattendedCount > 0 && (
                    <span style={{ flex: 1 }} />
                  )}
                  {isAlertsLink && <AlertBadge count={unattendedCount} />}
                </Link>
              );
            })}

            <PwaInstallButton variant="menu" />

            {user && (
              <button
                type="button"
                onClick={() => { setIsOpen(false); requestTourStart(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                  padding: 'var(--space-sm)', borderRadius: 'var(--radius-md)', minHeight: 48,
                  color: 'var(--text-secondary)', background: 'transparent', border: 'none',
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem', width: '100%', textAlign: 'left',
                }}
              >
                <CircleHelp size={20} strokeWidth={1.5} aria-hidden="true" />
                Ver recorrido guiado
              </button>
            )}

            {/* En celular el cambio de tema vive aquí para que la barra quepa en 360 px */}
            <div className="flex sm:hidden" style={{ alignItems: 'center', gap: 'var(--space-sm)', padding: '0 var(--space-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <ThemeToggle />
              Tema claro u oscuro
            </div>

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
                  borderTop: '1px solid var(--line)',
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
