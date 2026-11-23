import { Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadCsv } from '../lib/csvExport';
import type { TelemetryReading } from '../hooks/useTelemetry';

/**
 * T7.3 (#77) — Botón "Exportar CSV" del histórico (HU-07).
 *
 * - Un operador **no ve** el botón (criterio de HU-07: la exportación es
 *   solo para administradores).
 * - Se deshabilita cuando no hay lecturas para exportar.
 */
export default function ExportCsvButton({
  readings,
  zoneLabel,
}: {
  readings: ReadonlyArray<TelemetryReading>;
  zoneLabel: string;
}) {
  const { isAdmin } = useAuth();

  if (!isAdmin) return null;

  const disabled = readings.length === 0;

  return (
    <button
      type="button"
      className="nm-flat"
      onClick={() => downloadCsv(readings, zoneLabel)}
      disabled={disabled}
      aria-label={`Exportar histórico de ${zoneLabel} en CSV`}
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
      <Download size={16} strokeWidth={1.5} />
      Exportar CSV
    </button>
  );
}
