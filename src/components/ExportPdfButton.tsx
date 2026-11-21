import { useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { exportPdf } from '../lib/pdfExport';
import type { TelemetryReading } from '../hooks/useTelemetry';

/**
 * T7.4 (#78) — Botón "Exportar PDF" del histórico (HU-07).
 *
 * - Un operador **no ve** el botón (mismo criterio que el CSV).
 * - Captura las gráficas del contenedor indicado y genera un PDF con
 *   encabezado, gráfica y resumen estadístico.
 * - Mientras genera, muestra un indicador y bloquea doble click.
 */
export default function ExportPdfButton({
  readings,
  zoneLabel,
  chartContainerId,
}: {
  readings: ReadonlyArray<TelemetryReading>;
  zoneLabel: string;
  /** id del elemento DOM que contiene las gráficas a capturar. */
  chartContainerId: string;
}) {
  const { isAdmin } = useAuth();
  const [exporting, setExporting] = useState(false);
  const busyRef = useRef(false);

  if (!isAdmin) return null;

  const disabled = exporting || readings.length === 0;

  async function handleExport() {
    if (busyRef.current) return;
    const container = document.getElementById(chartContainerId);
    if (!container || readings.length === 0) return;

    busyRef.current = true;
    setExporting(true);
    try {
      await exportPdf({ container, readings, zoneLabel });
    } catch (err) {
      console.error('Error al exportar el PDF:', err);
    } finally {
      busyRef.current = false;
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      className="nm-flat"
      onClick={handleExport}
      disabled={disabled}
      aria-label={`Exportar reporte PDF de ${zoneLabel}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-xs)',
        minHeight: 48,
        padding: '0 var(--space-sm)',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--accent)',
        fontWeight: 600,
        fontSize: '0.875rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {exporting ? (
        <Loader2 size={16} strokeWidth={1.5} style={{ animation: 'spin 0.7s linear infinite' }} />
      ) : (
        <FileText size={16} strokeWidth={1.5} />
      )}
      {exporting ? 'Generando…' : 'Exportar PDF'}
    </button>
  );
}
