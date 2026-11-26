import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  TOUR_START_EVENT,
  hasSeenTour,
  markTourSeen,
  nextShowableIndex,
  resolveTarget,
  stepsForRole,
  type TourStep,
} from '../lib/tour';

/**
 * Recorrido guiado (ver lib/tour.ts). Oscurece la pantalla, deja a la vista
 * el elemento del paso y pone al lado una tarjeta con qué es y para qué sirve.
 * Sin dependencias: el "hueco" es un recuadro con una sombra enorme.
 */

const PAD = 8;          // aire alrededor del elemento resaltado
const GAP = 12;         // separación entre el elemento y la tarjeta
const EDGE = 16;        // margen con el borde de la pantalla
const CARD_MAX = 360;

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isVisible(selector: string): boolean {
  const el = document.querySelector(selector);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

interface Rect { top: number; left: number; width: number; height: number }

export default function GuidedTour() {
  const { user, activeWorkspace, currentRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Element | null>(null);
  const pendingStart = useRef(false);

  const open = steps !== null;
  const step = steps?.[index];

  const begin = useCallback(() => {
    returnFocus.current = document.activeElement;
    setSteps(stepsForRole(currentRole === 'admin'));
    setIndex(0);
  }, [currentRole]);

  const finish = useCallback(() => {
    if (user) markTourSeen(safeStorage(), user.uid);
    setSteps(null);
    setRect(null);
    setCardPos(null);
    const el = returnFocus.current as HTMLElement | null;
    if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
  }, [user]);

  // Abrirlo desde el botón de ayuda: los pasos apuntan al tablero, así que se va ahí primero.
  useEffect(() => {
    function onStart() {
      if (location.pathname === '/dashboard') begin();
      else {
        pendingStart.current = true;
        navigate('/dashboard');
      }
    }
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [location.pathname, begin, navigate]);

  // Primera visita al tablero (o recién llegado tras pedirlo desde otra página).
  // No sale en el build de pruebas e2e, para no tapar los botones que prueban.
  useEffect(() => {
    if (open || !user || !activeWorkspace || location.pathname !== '/dashboard') return;
    const wanted = pendingStart.current || (import.meta.env.MODE !== 'e2e' && !hasSeenTour(safeStorage(), user.uid));
    if (!wanted) return;
    // Espera a que el tablero termine de cargar para poder señalar sus partes.
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      // Sin lecturas todavía se espera un poco más, por si van llegando.
      const ready = isVisible('[data-tour="estado"]') || (tries >= 10 && isVisible('[data-tour="sin-datos"]'));
      if (ready || tries > 25) {
        window.clearInterval(id);
        pendingStart.current = false;
        begin();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [open, user, activeWorkspace, location.pathname, begin]);

  // Si cambia de página a media vuelta, se cierra sin marcarlo como visto
  // (al cerrar sesión este componente se desmonta).
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    if (steps) { setSteps(null); setRect(null); setCardPos(null); }
  }

  // Salta los pasos cuyo elemento no está en pantalla.
  const go = useCallback((from: number, dir: 1 | -1) => {
    if (!steps) return;
    const next = nextShowableIndex(steps, from, dir, isVisible);
    if (next === -1) {
      if (dir === 1) finish();
      return;
    }
    setIndex(next);
  }, [steps, finish]);

  // Mide el elemento del paso y lo trae a la vista.
  const measure = useCallback(() => {
    if (!step) return;
    const sel = resolveTarget(step, isVisible);
    if (!sel) { setRect(null); return; }
    const r = document.querySelector(sel)!.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const sel = resolveTarget(step, isVisible);
    if (sel) {
      const el = document.querySelector(sel)!;
      const r = el.getBoundingClientRect();
      const fits = r.top >= 72 && r.bottom <= window.innerHeight - 200;
      if (!fits) el.scrollIntoView({ block: r.height > window.innerHeight * 0.5 ? 'start' : 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    const raf = window.requestAnimationFrame(measure);
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    // El scroll suave termina después; se vuelve a medir un rato.
    const t1 = window.setTimeout(measure, 350);
    const t2 = window.setTimeout(measure, 700);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.cancelAnimationFrame(raf);
    };
  }, [step, measure]);

  // Coloca la tarjeta abajo o arriba del elemento; si no cabe, abajo de la pantalla.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !step) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ch = card.offsetHeight;
    const cw = card.offsetWidth;
    if (!rect) {
      setCardPos({ top: Math.max(EDGE, (vh - ch) / 2), left: (vw - cw) / 2 });
      return;
    }
    const left = Math.min(Math.max(EDGE, rect.left), vw - cw - EDGE);
    const below = rect.top + rect.height + GAP;
    const above = rect.top - GAP - ch;
    let top: number;
    if (below + ch <= vh - EDGE) top = below;
    else if (above >= EDGE) top = above;
    else top = vh - ch - EDGE; // el elemento es muy alto: la tarjeta va encima, pegada abajo
    setCardPos({ top, left });
  }, [rect, step, index]);

  // Foco en el botón principal en cada paso.
  useEffect(() => {
    if (open) primaryRef.current?.focus({ preventScroll: true });
  }, [open, index]);

  // Teclado: Esc cierra, flechas avanzan, Tab no sale de la tarjeta.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1, 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1, -1); }
      else if (e.key === 'Tab' && cardRef.current) {
        const items = Array.from(cardRef.current.querySelectorAll<HTMLElement>('button'));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!cardRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, go, finish]);

  if (!open || !step || !steps) return null;

  // Conteo solo de los pasos que sí se van a ver en esta pantalla.
  const shown = steps.filter((s) => !s.targets || s.targets.some(isVisible));
  const position = Math.max(0, shown.indexOf(step)) + 1;
  const isFirst = nextShowableIndex(steps, index - 1, -1, isVisible) === -1;
  const isLast = nextShowableIndex(steps, index + 1, 1, isVisible) === -1;
  const reduced = prefersReducedMotion();

  return (
    <div className="tour-root" data-testid="guided-tour">
      {/* Bloquea los clics a lo de abajo mientras dura el recorrido */}
      <div className="tour-blocker" aria-hidden="true" />
      <div
        className="tour-spot"
        aria-hidden="true"
        style={
          rect
            ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height, transition: reduced ? 'none' : undefined }
            : { top: '50%', left: '50%', width: 0, height: 0, transition: reduced ? 'none' : undefined }
        }
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="tour-card"
        style={{
          maxWidth: `min(${CARD_MAX}px, calc(100vw - ${EDGE * 2}px))`,
          top: cardPos?.top ?? -9999,
          left: cardPos?.left ?? -9999,
          visibility: cardPos ? 'visible' : 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span className="metric-label" aria-live="polite">Paso {position} de {shown.length}</span>
          <button type="button" className="tour-close" onClick={finish} aria-label="Cerrar recorrido">
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <h2 id="tour-title" style={{ fontSize: '1.125rem', margin: 0 }}>{step.title}</h2>
        <p id="tour-body" style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.5 }}>{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {shown.map((s) => <span key={s.id} className={s === step ? 'is-active' : undefined} />)}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {isFirst ? (
            <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 44, padding: '0 16px' }} onClick={finish}>
              Saltar
            </button>
          ) : (
            <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 44, padding: '0 16px' }} onClick={() => go(index - 1, -1)}>
              Anterior
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            className="btn-primary"
            style={{ width: 'auto', minHeight: 44, padding: '0 18px' }}
            onClick={() => (isLast ? finish() : go(index + 1, 1))}
          >
            {isFirst ? 'Empezar' : isLast ? 'Listo' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
