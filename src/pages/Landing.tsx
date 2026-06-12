import { ArrowRight, Activity, Droplets, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="container animate-fade-in">
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '6rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'inline-block', padding: '0.5rem 1rem', background: 'var(--accent-green-glow)', borderRadius: '999px', color: 'var(--accent-green)', fontWeight: 'bold', marginBottom: '2rem' }}>
          Sistema Inteligente
        </div>
        <h1 style={{ fontSize: '4rem', fontWeight: 800, marginBottom: '1.5rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          El Futuro del Cultivo
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '600px', marginBottom: '3rem' }}>
          Monitorea, controla y optimiza el entorno de tu invernadero en tiempo real con tecnología de vanguardia y precisión inteligente.
        </p>
        <Link to="/dashboard" className="btn-primary" style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}>
          Ir al Centro de Control <ArrowRight size={20} />
        </Link>
      </section>

      {/* Features Grid */}
      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', padding: '4rem 0' }}>
        <div className="glass-panel">
          <Activity size={40} className="text-green" style={{ marginBottom: '1rem' }} />
          <h3>Monitoreo 24/7</h3>
          <p className="text-muted">Sensores de alta precisión vigilan temperatura, humedad y pH del agua constantemente.</p>
        </div>
        <div className="glass-panel">
          <Droplets size={40} className="text-blue" style={{ marginBottom: '1rem' }} />
          <h3>Riego Automatizado</h3>
          <p className="text-muted">La bomba se activa automáticamente según las necesidades reales de cada planta.</p>
        </div>
        <div className="glass-panel">
          <Zap size={40} className="text-amber" style={{ marginBottom: '1rem' }} />
          <h3>Alertas al Instante</h3>
          <p className="text-muted">Notificaciones en tiempo real si algún parámetro sale del rango óptimo.</p>
        </div>
      </section>
    </div>
  );
}
