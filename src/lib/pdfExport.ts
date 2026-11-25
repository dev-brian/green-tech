import type { TelemetryReading } from '../hooks/useTelemetry';
import { CSV_VARIABLES } from './csvExport.ts';

/**
 * T7.4 (#78) — Exportación del histórico a PDF (parte de HU-07).
 *
 * El PDF lleva: encabezado (zona, rango, fecha), la gráfica capturada y un
 * resumen estadístico (promedio, mínimo y máximo por variable).
 *
 * La captura serializa el `<svg>` que dibuja Recharts en vez de usar
 * html2canvas: Tailwind v4 emite colores `oklch` que html2canvas no sabe
 * parsear, y el SVG de Recharts ya trae los colores como atributos.
 * `jspdf` se importa de forma dinámica para no engordar el bundle inicial.
 *
 * `buildPdfSummary` y `buildPdfFilename` son puros para probarlos con
 * `node --test`; el resto solo corre en el navegador.
 */

export interface PdfSummaryRow {
  label: string;
  avg: number;
  min: number;
  max: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Resumen estadístico por variable: promedio, mínimo y máximo. */
export function buildPdfSummary(
  readings: ReadonlyArray<TelemetryReading>,
): PdfSummaryRow[] {
  if (readings.length === 0) return [];
  return CSV_VARIABLES.map(({ key, label }) => {
    const values = readings.map((r) => r[key] as number);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      label,
      avg: round1(avg),
      min: round1(Math.min(...values)),
      max: round1(Math.max(...values)),
    };
  });
}

/** Nombre de archivo: `greentech_historico_<zona>_<AAAA-MM-DD>.pdf`. */
export function buildPdfFilename(zoneLabel: string, now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  const safeZone =
    zoneLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'zona';
  return `greentech_historico_${safeZone}_${stamp}.pdf`;
}

/** Rango real de las lecturas: "14 nov, 08:00 – 14 nov, 14:00". */
export function formatReadingsRange(readings: ReadonlyArray<TelemetryReading>): string {
  if (readings.length === 0) return '—';
  const times = readings.map((r) => r.timestamp.getTime());
  const fmt = (d: Date) =>
    d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${fmt(new Date(Math.min(...times)))} – ${fmt(new Date(Math.max(...times)))}`;
}

// ─── Captura del SVG de Recharts ─────────────────────────────────────────────

/** Fondo de las gráficas del Dashboard (CHART_COLORS.bg). */
const CHART_BG = '#1e222b';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la gráfica para el PDF'));
    img.src = src;
  });
}

async function svgToPngDataUrl(
  svg: SVGSVGElement,
  background: string,
): Promise<{ data: string; width: number; height: number }> {
  const rect = svg.getBoundingClientRect();
  const attrW = parseInt(svg.getAttribute('width') ?? '', 10);
  const attrH = parseInt(svg.getAttribute('height') ?? '', 10);
  const width = Math.round(rect.width) || (attrW > 0 ? attrW : 600);
  const height = Math.round(rect.height) || (attrH > 0 ? attrH : 300);

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  // El SVG serializado no trae el CSS de la página: inyectamos la fuente.
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = 'text { font-family: Inter, system-ui, sans-serif; }';
  clone.insertBefore(style, clone.firstChild);

  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const img = await loadImage(url);
    const scale = 2; // Nitidez al imprimir
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el canvas para el PDF');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL('image/png'), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── Generación del PDF ──────────────────────────────────────────────────────

export interface ExportPdfOptions {
  /** Contenedor de las gráficas (se buscan sus `<svg>` dentro). */
  container: HTMLElement;
  readings: ReadonlyArray<TelemetryReading>;
  zoneLabel: string;
}

export async function exportPdf({
  container,
  readings,
  zoneLabel,
}: ExportPdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');

  // Solo los SVG grandes (las gráficas); se ignoran iconos lucide, si los hay.
  const svgs = Array.from(container.querySelectorAll('svg')).filter(
    (s) => s.getBoundingClientRect().width > 120,
  );
  const charts: { title: string; png: { data: string; width: number; height: number } }[] = [];
  for (const svg of svgs) {
    const title =
      svg.closest('.nm-flat')?.querySelector('h3')?.textContent?.trim() ?? 'Gráfica';
    charts.push({ title, png: await svgToPngDataUrl(svg, CHART_BG) });
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureRoom = (needed: number) => {
    if (y + needed > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  // ── Encabezado ──
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(16, 185, 129); // --accent
  pdf.text('GreenTech · Reporte de histórico', margin, y);
  y += 9;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);
  pdf.text(`Zona: ${zoneLabel}`, margin, y);
  y += 5;
  pdf.text(`Rango: ${formatReadingsRange(readings)}`, margin, y);
  y += 5;
  pdf.text(`Lecturas incluidas: ${readings.length}`, margin, y);
  y += 5;
  pdf.text(`Generado: ${new Date().toLocaleString('es-MX')}`, margin, y);
  y += 9;

  // ── Gráficas capturadas ──
  for (const chart of charts) {
    ensureRoom(40);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 30, 30);
    pdf.text(chart.title, margin, y);
    y += 6;

    const imgH = (chart.png.height / chart.png.width) * contentW;
    ensureRoom(imgH + 6);
    pdf.addImage(chart.png.data, 'PNG', margin, y, contentW, imgH);
    y += imgH + 9;
  }

  // ── Resumen estadístico ──
  const summary = buildPdfSummary(readings);
  if (summary.length > 0) {
    ensureRoom(16 + summary.length * 6);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30, 30, 30);
    pdf.text('Resumen estadístico', margin, y);
    y += 8;

    const cols = [margin, margin + 86, margin + 124, margin + 162];
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Variable', cols[0], y);
    pdf.text('Promedio', cols[1], y);
    pdf.text('Mínimo', cols[2], y);
    pdf.text('Máximo', cols[3], y);
    y += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(45, 45, 45);
    for (const row of summary) {
      pdf.text(row.label, cols[0], y);
      pdf.text(String(row.avg), cols[1], y);
      pdf.text(String(row.min), cols[2], y);
      pdf.text(String(row.max), cols[3], y);
      y += 5;
    }
  }

  pdf.save(buildPdfFilename(zoneLabel));
}
