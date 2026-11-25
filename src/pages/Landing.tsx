import {
  ArrowRight,
  Bell,
  CheckCheck,
  ChevronDown,
  Droplets,
  FlaskConical,
  Gauge,
  History as HistoryIcon,
  Leaf,
  Mail,
  MapPin,
  Radio,
  Smartphone,
  Sun,
  Thermometer,
  Users,
  Waves,
  WifiOff,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import GreenhouseIllustration, { type IllustrationZone } from '../components/GreenhouseIllustration';
import PrivacyDetails from '../components/PrivacyDetails';
import { CONTACT_EMAIL } from '../lib/brand';
import { STATUS_CLASS, STATUS_WORD, VARIABLES, VARIABLE_ORDER } from '../lib/plainLanguage';
import type { HydroponicVariable, SensorStatus } from '../lib/sensorThresholds';

/*
 * Landing (revisión UI 25 nov). Solo dice lo que el sistema hace hoy:
 * sin cifras inventadas, sin "control automático" (Equipos es solo lectura)
 * y sin "alertas predictivas" (las alertas salen al cruzar un umbral).
 */

// ─── Datos ───────────────────────────────────────────────────────────────────

/** Vista de ejemplo del semáforo; se marca como ejemplo en pantalla. */
const EXAMPLE_ZONES: (IllustrationZone & { crop: string; note: string })[] = [
  { zoneId: 'z1', label: 'Zona 1', crop: 'Lechuga NFT', status: 'green', note: 'Todo en orden' },
  { zoneId: 'z2', label: 'Zona 2', crop: 'Jitomate DWC', status: 'red', note: 'El agua lleva demasiados nutrientes' },
  { zoneId: 'z3', label: 'Zona 3', crop: 'Lechuga NFT', status: 'yellow', note: 'Hace un poco de calor' },
];

/** Hechos comprobados en el repositorio (docs/latencia-alertas.md, docs/prueba-modo-avion.md). */
const FACTS = [
  { value: '7', label: 'variables por zona, del aire y del agua' },
  { value: '< 5 s', label: 'para crear la alerta desde que llega la lectura' },
  { value: 'Sin red', label: 'sigue mostrando la última lectura y se pone al día solo' },
  { value: '2', label: 'cultivos con rangos ideales: jitomate y lechuga' },
];

const STEPS = [
  {
    icon: Radio,
    title: 'Llegan las lecturas',
    text: 'Los sensores de cada zona (o el simulador, en la demo) mandan temperatura, humedad, luz, acidez, nutrientes, temperatura del agua y nivel del tanque.',
  },
  {
    icon: Gauge,
    title: 'Se comparan con el cultivo',
    text: 'Cada lectura se compara con los rangos del cultivo de esa zona. Si sale del rango, se crea una alerta y la zona cambia de color.',
  },
  {
    icon: Bell,
    title: 'Te enteras y lo atiendes',
    text: 'Lo ves en la web o en la app Android, te llega un aviso al celular y marcas "Ya lo revisé" para que tu equipo sepa que alguien se encargó.',
  },
];

const VARIABLE_ICON: Record<HydroponicVariable, React.ElementType> = {
  airTemp: Thermometer,
  humidity: Droplets,
  light: Sun,
  ph: FlaskConical,
  ec: Zap,
  solutionTemp: Waves,
  tankLevel: Gauge,
};

const FEATURES = [
  { icon: Leaf, title: 'Semáforo por zona', text: 'Verde, amarillo o rojo, con una frase que dice qué pasa. La zona con problema aparece primero.' },
  { icon: Bell, title: 'Alertas con seguimiento', text: 'Bandeja con filtros por gravedad y zona. Quién la revisó y cuándo queda registrado.' },
  { icon: HistoryIcon, title: 'Histórico', text: 'Gráfica por variable con la franja ideal del cultivo, por día o por semana.' },
  { icon: MapPin, title: 'Zonas y cultivos', text: 'El admin registra las zonas, elige el cultivo de cada una y ajusta sus rangos.' },
  { icon: Users, title: 'Admin y operador', text: 'El admin configura; el operador ve y atiende. Se entra con Google y un código de invitación.' },
  { icon: WifiOff, title: 'Funciona sin internet', text: 'Se instala como app y sigue abriendo sin red. Lo que marques se envía al volver la conexión.' },
];

const AUDIENCE = [
  { title: 'Quien lleva el invernadero', text: 'Abre el inicio y sabe en segundos si todo está bien o qué zona revisar, sin interpretar números.' },
  { title: 'Quien está en campo', text: 'Recibe el aviso en el celular, ve qué hacer en palabras simples y marca la alerta como revisada.' },
];

// ─── Piezas ──────────────────────────────────────────────────────────────────

function scrollToSection(id: string) {
  // HashRouter: un href="#id" cambiaría la ruta; se hace scroll a mano.
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <header className="landing-head">
      <p className="landing-eyebrow">{eyebrow}</p>
      <h2 className="landing-h2">{title}</h2>
      {text && <p className="landing-lead">{text}</p>}
    </header>
  );
}

function ZoneRow({ zone }: { zone: (typeof EXAMPLE_ZONES)[number] }) {
  const cls = STATUS_CLASS[zone.status as SensorStatus];
  return (
    <li className="landing-zone">
      <span className={`nm-led nm-led--${zone.status}`} aria-hidden="true" />
      <span className="landing-zone__name">
        <strong>{zone.label}</strong> · {zone.crop}
        <span className="landing-zone__note">{zone.note}</span>
      </span>
      <span className={`chip chip--${cls}`}>{STATUS_WORD[zone.status as SensorStatus]}</span>
    </li>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="landing">

      {/* 1. Portada */}
      <section className="container landing-hero animate-fade-in">
        <div className="landing-hero__text">
          <p className="landing-eyebrow">GreenTech · por Palarix</p>
          <h1 className="display landing-h1">
            Tu invernadero hidropónico, <span style={{ color: 'var(--leaf-ink)' }}>zona por zona.</span>
          </h1>
          <p className="landing-lead">
            Ves cada zona en verde, amarillo o rojo desde el navegador o el celular. Si algo sale de rango,
            te avisa y te dice qué revisar.
          </p>
          <div className="landing-cta">
            <Link to="/login" className="btn-primary">
              Entrar <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <button type="button" className="btn-secondary" onClick={() => scrollToSection('como-funciona')}>
              Cómo funciona <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        <figure className="glass landing-preview">
          <figcaption className="landing-preview__cap">
            <span className="metric-label">Vista de ejemplo</span>
            <span className="chip chip--crit">1 zona crítica</span>
          </figcaption>
          <GreenhouseIllustration
            zones={EXAMPLE_ZONES}
            callout={{ zoneId: 'z2', title: 'Zona 2 · Nutrientes', value: 'EC 3.4 mS/cm', status: 'red' }}
          />
          <ul className="landing-zones">
            {[...EXAMPLE_ZONES]
              .sort((a, b) => ['red', 'yellow', 'green', 'offline'].indexOf(a.status) - ['red', 'yellow', 'green', 'offline'].indexOf(b.status))
              .map((z) => <ZoneRow key={z.zoneId} zone={z} />)}
          </ul>
        </figure>
      </section>

      {/* 2. Datos reales del sistema */}
      <section className="landing-band" aria-label="Lo que hace GreenTech hoy">
        <dl className="container landing-facts">
          {FACTS.map((f) => (
            <div key={f.label} className="landing-fact">
              <dt className="landing-fact__value">{f.value}</dt>
              <dd className="landing-fact__label">{f.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 3. Cómo funciona */}
      <section id="como-funciona" className="container landing-section">
        <SectionHead
          eyebrow="Cómo funciona"
          title="De la lectura al aviso, en tres pasos."
          text="No hace falta saber de química del agua: el sistema traduce cada lectura a lo que significa para tu cultivo."
        />
        <ol className="landing-steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="glass landing-step">
                <div className="landing-step__top">
                  <span className="icon-well icon-well--ok"><Icon size={22} strokeWidth={1.75} aria-hidden="true" /></span>
                  <span className="landing-step__num" aria-hidden="true">{i + 1}</span>
                </div>
                <h3 className="landing-h3">{s.title}</h3>
                <p className="landing-p">{s.text}</p>
              </li>
            );
          })}
        </ol>

        <div className="landing-vars">
          <p className="metric-label" style={{ margin: 0 }}>Lo que se mide en cada zona</p>
          <ul>
            {VARIABLE_ORDER.map((v) => {
              const Icon = VARIABLE_ICON[v];
              const info = VARIABLES[v];
              return (
                <li key={v}>
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  {info.name}{info.technical ? ` (${info.technical})` : ''}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 4. Qué puedes hacer */}
      <section className="landing-band landing-section">
        <div className="container">
          <SectionHead eyebrow="Qué puedes hacer" title="Todo lo que necesitas para vigilar el invernadero." />
          <div className="landing-features">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <article key={f.title} className="landing-feature">
                  <span className="icon-well icon-well--ok"><Icon size={20} strokeWidth={1.75} aria-hidden="true" /></span>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="landing-h3">{f.title}</h3>
                    <p className="landing-p">{f.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="landing-platforms">
            <Smartphone size={18} strokeWidth={1.75} aria-hidden="true" />
            En el navegador (se instala como app) y en la app Android, con los mismos datos.
          </p>
        </div>
      </section>

      {/* 5. Para quién */}
      <section className="container landing-section">
        <SectionHead eyebrow="Para quién" title="Pensado para quien está en el invernadero." />
        <div className="landing-audience">
          {AUDIENCE.map((a) => (
            <article key={a.title} className="glass landing-card">
              <CheckCheck size={22} strokeWidth={1.75} color="var(--leaf-ink)" aria-hidden="true" />
              <h3 className="landing-h3">{a.title}</h3>
              <p className="landing-p">{a.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 6. Quiénes somos + 7. Contacto */}
      <section className="landing-band landing-section">
        <div className="container landing-about">
          <div>
            <p className="landing-eyebrow">Quiénes somos</p>
            <h2 className="landing-h2">Palarix</h2>
            <p className="landing-lead" style={{ marginLeft: 0 }}>
              Somos el equipo de la Universidad Tecnológica de Tlaxcala que hace GreenTech: Brian, Rodrigo,
              Alexa y Gael. Es nuestro proyecto integrador 2026.
            </p>
          </div>
          <a href={`mailto:${CONTACT_EMAIL}`} className="glass landing-contact">
            <span className="icon-well icon-well--ok"><Mail size={22} strokeWidth={1.75} aria-hidden="true" /></span>
            <span style={{ minWidth: 0 }}>
              <span className="metric-label" style={{ display: 'block' }}>¿Dudas o quieres probarlo? Escríbenos</span>
              <span className="landing-contact__mail">green.tech.contacto<wbr />@gmail.com</span>
            </span>
          </a>
        </div>
      </section>

      <footer className="container landing-footer">
        <p style={{ margin: 0 }}>© {new Date().getFullYear()} Palarix · GreenTech</p>
        <details className="landing-privacy">
          <summary>Aviso de privacidad</summary>
          <div className="landing-privacy__body"><PrivacyDetails /></div>
        </details>
      </footer>
    </div>
  );
}
