import { useState } from 'react';
import { ArrowRight, Activity, Droplets, Zap, Wifi, FlaskConical, Thermometer, Sun, BarChart3, Shield, Leaf, ChevronDown, CheckCircle2, TrendingDown, Clock, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── DATA ────────────────────────────────────────────────────────────────────

const stats = [
  { value: '40%', label: 'Reducción de pérdidas de cultivo', icon: TrendingDown, color: 'var(--accent-green)' },
  { value: '60%', label: 'Ahorro en consumo de agua', icon: Droplets, color: 'var(--accent-blue)' },
  { value: '24/7', label: 'Monitoreo continuo sin interrupciones', icon: Clock, color: 'var(--accent-amber)' },
  { value: '3x', label: 'Mayor rendimiento por ciclo de cultivo', icon: Activity, color: '#a78bfa' },
];

const steps = [
  {
    number: '01',
    icon: Wifi,
    title: 'Sensores Capturan',
    description: 'Nodos IoT distribuidos en el invernadero miden temperatura, humedad relativa y pH del agua en ciclos de 5 segundos.',
    color: 'var(--accent-green)',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
  {
    number: '02',
    icon: BarChart3,
    title: 'ALGORA Analiza',
    description: 'Nuestro motor de reglas procesa los datos en tiempo real, detecta anomalías y genera predicciones de comportamiento.',
    color: 'var(--accent-blue)',
    glow: 'rgba(59, 130, 246, 0.25)',
  },
  {
    number: '03',
    icon: Zap,
    title: 'Sistema Actúa',
    description: 'Las actualizaciones se envían a la interfaz web al instante. El riego y la ventilación se ajustan automáticamente.',
    color: 'var(--accent-amber)',
    glow: 'rgba(245, 158, 11, 0.25)',
  },
];

const benefits = [
  {
    icon: TrendingDown,
    title: 'Reduce pérdidas hasta un 40%',
    description: 'Detecta condiciones fuera de rango antes de que afecten el cultivo. Evita pérdidas por golpes de calor, hongos y sobre-riego.',
    audience: 'Operadores',
    color: 'var(--accent-green)',
  },
  {
    icon: Droplets,
    title: 'Ahorra hasta 60% de agua',
    description: 'El riego se activa únicamente cuando los sensores confirman que es necesario, eliminando el desperdicio por ciclos fijos.',
    audience: 'Sustentabilidad',
    color: 'var(--accent-blue)',
  },
  {
    icon: BarChart3,
    title: 'Datos para tomar decisiones',
    description: 'Históricos de cada sensor con gráficas exportables. Información precisa para justificar inversiones y optimizar protocolos.',
    audience: 'Gestión',
    color: '#a78bfa',
  },
  {
    icon: Shield,
    title: 'Alertas antes que el problema',
    description: 'Notificaciones inmediatas en la interfaz cuando cualquier parámetro sale del rango óptimo definido por el operador.',
    audience: 'Seguridad',
    color: 'var(--accent-amber)',
  },
];

const techStack = [
  { name: 'Temperatura', sensor: 'DHT22', precision: '±0.5°C', icon: Thermometer, color: 'var(--accent-amber)' },
  { name: 'Humedad', sensor: 'DHT22', precision: '±2% RH', icon: Droplets, color: 'var(--accent-blue)' },
  { name: 'pH del Agua', sensor: 'Sonda analógica', precision: '±0.1 pH', icon: FlaskConical, color: 'var(--accent-green)' },
  { name: 'Luminosidad', sensor: 'BH1750', precision: '±5% lux', icon: Sun, color: '#fbbf24' },
];

const trustItems = [
  'Proyecto de investigación aplicada de la UTT',
  'Datos no salen del sistema — infraestructura local',
  'Interfaz validada con operadores reales de invernadero',
  'Código abierto y auditable por el equipo académico',
];

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function Landing() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div style={{ width: '100%' }}>

      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <section className="container animate-fade-in" style={{ textAlign: 'center', padding: '7rem 0 5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.4rem 1rem', background: 'var(--accent-green-glow)',
          borderRadius: '999px', color: 'var(--accent-green)', fontWeight: 700,
          fontSize: '0.85rem', border: '1px solid rgba(16,185,129,0.3)',
          marginBottom: '2rem', letterSpacing: '0.05em'
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)', display: 'inline-block' }} />
          UTT · Proyecto ALGORA · Invernadero Hidropónico
        </div>

        {/* Headline */}
        <h1 className="hero-title" style={{
          fontSize: 'clamp(2.8rem, 6vw, 5rem)', fontWeight: 900,
          lineHeight: 1.1, marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, #fff 30%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>
          El Invernadero que<br />
          <span style={{ background: 'linear-gradient(135deg, #10b981, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            piensa por sí solo.
          </span>
        </h1>

        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', maxWidth: '620px', marginBottom: '3rem', lineHeight: 1.7 }}>
          ALGORA transforma invernaderos tradicionales en sistemas inteligentes. Telemetría en tiempo real, control automático y alertas predictivas para proteger cada ciclo de cultivo.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/dashboard" className="btn-primary" style={{ fontSize: '1rem', padding: '0.9rem 2rem', gap: '0.6rem' }}>
            Ver el Dashboard en Vivo <ArrowRight size={18} />
          </Link>
          <a href="#como-funciona" className="btn-secondary" style={{ fontSize: '1rem', padding: '0.9rem 2rem', gap: '0.6rem' }}>
            Cómo Funciona <ChevronDown size={18} />
          </a>
        </div>

        {/* Subtle grid graphic */}
        <div style={{
          marginTop: '5rem', width: '100%', maxWidth: 800, height: 2,
          background: 'linear-gradient(to right, transparent, rgba(16,185,129,0.4), rgba(59,130,246,0.4), transparent)'
        }} />
      </section>

      {/* ── 2. STATS BANNER ─────────────────────────────────────────────────── */}
      <section style={{ background: 'rgba(15,23,42,0.6)', borderTop: '1px solid var(--panel-border)', borderBottom: '1px solid var(--panel-border)', padding: '3rem 0' }}>
        <div className="container">
          <div className="grid grid-metrics" style={{ gap: '0' }}>
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} style={{
                  textAlign: 'center', padding: '1.5rem 1rem',
                  borderRight: i < stats.length - 1 ? '1px solid var(--panel-border)' : 'none'
                }}>
                  <Icon size={28} style={{ color: s.color, margin: '0 auto 0.75rem' }} />
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.5rem 0 0', lineHeight: 1.4 }}>{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3. CÓMO FUNCIONA ────────────────────────────────────────────────── */}
      <section id="como-funciona" className="container" style={{ padding: '6rem 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <p style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>EL PROCESO</p>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, margin: 0 }}>Tres pasos. Cero pérdidas.</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem', maxWidth: 520, margin: '1rem auto 0' }}>
            Desde el sensor hasta la decisión, ALGORA cierra el ciclo de control en segundos.
          </p>
        </div>

        {/* Steps selector */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
          {steps.map((step, i) => (
            <button key={i} onClick={() => setActiveStep(i)} style={{
              background: activeStep === i ? step.color : 'transparent',
              color: activeStep === i ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${activeStep === i ? step.color : 'var(--panel-border)'}`,
              padding: '0.6rem 1.25rem', borderRadius: '999px', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.3s ease',
              boxShadow: activeStep === i ? `0 0 20px ${step.glow}` : 'none'
            }}>
              {step.number} · {step.title}
            </button>
          ))}
        </div>

        {/* Active step card */}
        {steps.map((step, i) => {
          const Icon = step.icon;
          if (i !== activeStep) return null;
          return (
            <div key={i} className="glass-panel animate-fade-in" style={{
              maxWidth: 700, margin: '0 auto', textAlign: 'center', padding: '3rem',
              border: `1px solid ${step.color}40`,
              boxShadow: `0 0 40px ${step.glow}`
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: step.glow, display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 1.5rem'
              }}>
                <Icon size={40} style={{ color: step.color }} />
              </div>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: step.color, opacity: 0.15, lineHeight: 1, marginBottom: '-1.5rem' }}>{step.number}</div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '1rem' }}>{step.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.7, margin: 0 }}>{step.description}</p>
            </div>
          );
        })}

        {/* Step connectors */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
          {steps.map((_, i) => (
            <div key={i} onClick={() => setActiveStep(i)} style={{
              width: activeStep === i ? 32 : 8, height: 8, borderRadius: 999,
              background: activeStep === i ? steps[i].color : 'var(--panel-border)',
              cursor: 'pointer', transition: 'all 0.4s ease'
            }} />
          ))}
        </div>
      </section>

      {/* ── 4. BENEFICIOS ───────────────────────────────────────────────────── */}
      <section style={{ background: 'rgba(15,23,42,0.5)', borderTop: '1px solid var(--panel-border)', padding: '6rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>IMPACTO REAL</p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, margin: 0 }}>Retorno tangible en cada cosecha.</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem', maxWidth: 540, margin: '1rem auto 0' }}>
              Diseñado para convencer con datos, no con promesas.
            </p>
          </div>

          <div className="grid grid-cards" style={{ gap: '1.5rem' }}>
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="glass-panel" style={{ borderTop: `3px solid ${b.color}` }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    background: `${b.color}20`, padding: '0.3rem 0.8rem', borderRadius: 999,
                    fontSize: '0.75rem', fontWeight: 700, color: b.color, marginBottom: '1.25rem',
                    letterSpacing: '0.05em'
                  }}>
                    {b.audience}
                  </div>
                  <Icon size={36} style={{ color: b.color, marginBottom: '1rem' }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.75rem' }}>{b.title}</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, fontSize: '0.95rem' }}>{b.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 5. TECNOLOGÍA ───────────────────────────────────────────────────── */}
      <section className="container" style={{ padding: '6rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem', alignItems: 'center' }}>
          {/* Left: text */}
          <div>
            <p style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>HARDWARE & SOFTWARE</p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: '1.25rem' }}>
              Precisión de laboratorio. Costo de campo.
            </h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '2rem' }}>
              Cada sensor fue seleccionado por su exactitud, durabilidad en entornos de alta humedad y bajo costo de reemplazo. El firmware corre sobre microcontroladores ESP32 con transmisión MQTT segura.
            </p>
            <Link to="/dashboard" className="btn-primary" style={{ display: 'inline-flex' }}>
              Ver datos en vivo <ArrowRight size={18} />
            </Link>
          </div>

          {/* Right: sensor cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {techStack.map((tech, i) => {
              const Icon = tech.icon;
              return (
                <div key={i} className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
                  <Icon size={28} style={{ color: tech.color, margin: '0 auto 0.75rem' }} />
                  <p style={{ fontWeight: 700, margin: '0 0 0.25rem', fontSize: '0.95rem' }}>{tech.name}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.25rem' }}>{tech.sensor}</p>
                  <span style={{
                    display: 'inline-block', background: `${tech.color}20`, color: tech.color,
                    padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700
                  }}>{tech.precision}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 6. CONFIANZA ────────────────────────────────────────────────────── */}
      <section style={{ background: 'rgba(15,23,42,0.6)', borderTop: '1px solid var(--panel-border)', borderBottom: '1px solid var(--panel-border)', padding: '5rem 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Users size={24} style={{ color: 'var(--accent-green)' }} />
            <p style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.1em', margin: 0 }}>RESPALDO ACADÉMICO</p>
          </div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 800, marginBottom: '3rem' }}>
            Desarrollado con rigor universitario.
          </h2>

          {/* Trust grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', maxWidth: 900, margin: '0 auto 3rem' }}>
            {trustItems.map((item, i) => (
              <div key={i} className="glass-panel" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', textAlign: 'left', padding: '1rem 1.25rem' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--accent-green)', flexShrink: 0, marginTop: 2 }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>

          {/* UTT Badge */}
          <div className="glass-panel" style={{ display: 'inline-flex', alignItems: 'center', gap: '1rem', padding: '1rem 2rem', borderRadius: 16 }}>
            <Leaf size={32} style={{ color: 'var(--accent-green)' }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontWeight: 800, margin: 0, fontSize: '1rem' }}>Universidad Tecnológica de Tlaxcala</p>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>Proyecto Integrador · Ingeniería · 2025</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. CTA FINAL ────────────────────────────────────────────────────── */}
      <section className="container animate-fade-in" style={{ padding: '8rem 0', textAlign: 'center' }}>
        <div className="glass-panel" style={{
          maxWidth: 700, margin: '0 auto', padding: '4rem 3rem',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.08))',
          border: '1px solid rgba(16,185,129,0.3)',
          boxShadow: '0 0 60px rgba(16,185,129,0.12)'
        }}>
          <Leaf size={48} style={{ color: 'var(--accent-green)', margin: '0 auto 1.5rem', filter: 'drop-shadow(0 0 12px rgba(16,185,129,0.5))' }} />
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, marginBottom: '1.25rem' }}>
            Tu invernadero, sin sorpresas.
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
            Accede al dashboard en vivo, explora los datos de sensores y comprueba por qué ALGORA es la solución que el campo mexicano necesita.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/dashboard" className="btn-primary" style={{ fontSize: '1.05rem', padding: '1rem 2.2rem' }}>
              Ir al Centro de Control <ArrowRight size={20} />
            </Link>
            <Link to="/plants" className="btn-secondary" style={{ fontSize: '1.05rem', padding: '1rem 2.2rem' }}>
              Ver Perfiles de Cultivo
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
