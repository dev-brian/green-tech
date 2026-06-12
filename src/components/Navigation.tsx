import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, Settings2, Leaf } from 'lucide-react';

export default function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Inicio', icon: Home },
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/control', label: 'Panel', icon: Settings2 },
    { path: '/plants', label: 'Plantas', icon: Leaf },
  ];

  return (
    <nav style={{
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--panel-border)',
      padding: '1rem',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div className="container flex justify-between items-center">
        <div className="flex items-center" style={{ gap: '0.75rem' }}>
          <Leaf className="text-green" size={28} />
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>Green<span className="text-green">Tech</span></h1>
        </div>
        
        <div className="flex" style={{ gap: '1.5rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center"
                style={{
                  gap: '0.5rem',
                  color: isActive ? 'var(--accent-green)' : 'var(--text-muted)',
                  fontWeight: isActive ? '600' : '400',
                  padding: '0.5rem 0',
                  borderBottom: isActive ? '2px solid var(--accent-green)' : '2px solid transparent'
                }}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
