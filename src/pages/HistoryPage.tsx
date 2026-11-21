import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useZones } from '../hooks/useZones';
import { useTelemetrySource } from '../hooks/useTelemetrySource';
import { useThresholdsByCrop } from '../hooks/useThresholds';
import { useHistory } from '../hooks/useHistory';
import { mergeZoneIds, zoneLabel } from '../lib/zones';
import {
  HISTORY_RANGES,
  HISTORY_VARIABLES,
  seriesValues,
  yDomain,
  type HistoryPoint,
  type HistoryRange,
} from '../lib/history';
import { VARIABLES, GROUP_LABEL, formatValue, idealText, type VariableGroup } from '../lib/plainLanguage';
import type { HydroponicVariable, ThresholdRange } from '../lib/sensorThresholds';

const GROUPS: VariableGroup[] = ['aire', 'agua'];

const hourFormat = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric' });
const fullFormat = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Página de histórico por zona: 24 h o 7 días con líneas de umbral (HU-07, T7.2 #76). */
export default function HistoryPage() {
  const { activeWorkspace } = useAuth();
  const greenhouseId = activeWorkspace?.id ?? null;

  // Zonas registradas y las que ya mandan datos aunque nadie las haya registrado.
  const { zonesById } = useZones(greenhouseId);
  const { zonesById: liveZones } = useTelemetrySource(greenhouseId);
  const zoneIds = useMemo(
    () => mergeZoneIds(Object.keys(zonesById), Object.keys(liveZones)),
    [zonesById, liveZones],
  );

  // ?zona=zona-2 llega desde el tablero para abrir la zona que se estaba viendo.
  const [searchParams] = useSearchParams();
  const [pickedZone, setPickedZone] = useState<string | null>(() => searchParams.get('zona'));
  const zoneId = pickedZone && zoneIds.includes(pickedZone) ? pickedZone : (zoneIds[0] ?? null);
  const [range, setRange] = useState<HistoryRange>('24h');

  // Umbrales del cultivo de la zona elegida (jitomate o lechuga).
  const { forCrop } = useThresholdsByCrop(greenhouseId);
  const thresholds = forCrop(zoneId ? (zonesById[zoneId]?.crop ?? liveZones[zoneId]?.crop) : null);
  const { points, loading, error, reload } = useHistory(greenhouseId, zoneId, range);

  return (
    <div
      className="container animate-fade-in"
      style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <h1 className="display">Histórico</h1>
        <p style={{ maxWidth: 560 }}>
          Cómo han cambiado las lecturas de una zona. La franja verde marca el rango ideal.
        </p>
      </header>

      <section
        className="glass"
        aria-label="Filtros del histórico"
        style={{ padding: 'var(--space-sm) var(--space-md)', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-sm)' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px', minWidth: 0 }}>
          <span className="metric-label">Zona</span>
          <select
            value={zoneId ?? ''}
            onChange={(e) => setPickedZone(e.target.value)}
            disabled={zoneIds.length === 0}
            style={{ minHeight: 48, borderRadius: 12, padding: '0 12px', font: 'inherit', color: 'var(--text-primary)', background: 'var(--surface-strong)', border: '1px solid var(--line)' }}
          >
            {zoneIds.length === 0 && <option value="">Sin zonas todavía</option>}
            {zoneIds.map((id) => (
              <option key={id} value={id}>
                {zoneLabel(id, zonesById, liveZones[id]?.crop)}
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-label="Periodo" style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          {HISTORY_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              className={range === r.value ? 'btn-nm-primary' : 'btn-nm-secondary'}
              aria-pressed={range === r.value}
              onClick={() => setRange(r.value)}
              style={{ minHeight: 48 }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-nm-secondary"
          onClick={reload}
          disabled={loading || !zoneId}
          aria-label="Actualizar histórico"
          style={{ minHeight: 48, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" className={loading ? 'animate-spin' : undefined} />
          Actualizar
        </button>
      </section>

      <p className="metric-label" role="status">
        {loading
          ? 'Cargando histórico…'
          : range === '7d'
            ? 'Promedio de cada hora.'
            : points.length > 0
              ? `${points.length} puntos en las últimas 24 horas.`
              : ''}
      </p>

      {error ? (
        <div className="glass" role="alert" style={{ padding: 'var(--space-md)' }}>
          <p style={{ fontWeight: 600 }}>{error}</p>
        </div>
      ) : !zoneId ? (
        <EmptyMessage text="Todavía no hay zonas con lecturas en este invernadero." />
      ) : !loading && points.length === 0 ? (
        <EmptyMessage
          text={
            range === '7d'
              ? 'No hay promedios por hora de esta zona en los últimos 7 días.'
              : 'No hay lecturas de esta zona en las últimas 24 horas.'
          }
        />
      ) : (
        GROUPS.map((group) => (
          <section key={group} aria-labelledby={`historico-${group}`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <h2 id={`historico-${group}`} style={{ fontSize: '1.125rem' }}>{GROUP_LABEL[group]}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 'var(--space-sm)' }}>
              {HISTORY_VARIABLES.filter((v) => VARIABLES[v].group === group).map((v) => (
                <VariableChart key={v} variable={v} points={points} range={range} threshold={thresholds[v]} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="glass" style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
      <p>{text}</p>
    </div>
  );
}

function VariableChart({
  variable,
  points,
  range,
  threshold,
}: {
  variable: HydroponicVariable;
  points: HistoryPoint[];
  range: HistoryRange;
  threshold: ThresholdRange;
}) {
  const info = VARIABLES[variable];
  const unit = info.unit ? ` ${info.unit}` : '';
  const values = seriesValues(points, variable);
  // El tanque no tiene máximo útil (100 %): solo se marca el mínimo.
  const hasMax = !(variable === 'tankLevel' && threshold.yellowMax >= 100);
  const ideal = { min: threshold.yellowMin, max: threshold.yellowMax };
  const domain = yDomain(values, ideal);

  const avg = values.length > 0 ? values.reduce((s, x) => s + x, 0) / values.length : null;
  const min = values.length > 0 ? Math.min(...values) : null;
  const max = values.length > 0 ? Math.max(...values) : null;
  const summary =
    avg === null || min === null || max === null
      ? 'Sin datos de esta variable en el periodo.'
      : `Promedio ${formatValue(variable, avg)}${unit} · mín. ${formatValue(variable, min)} · máx. ${formatValue(variable, max)}`;

  return (
    <article className="glass" style={{ padding: 'var(--space-sm) var(--space-md)', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <h3 style={{ fontSize: '1rem' }}>
        {info.name}
        {info.technical && info.technical !== info.name ? ` (${info.technical})` : ''}
        {info.unit ? <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}> · {info.unit}</span> : null}
      </h3>
      <span className="metric-label">{idealText(variable, threshold)}</span>
      <div className="well" role="img" aria-label={`${info.name}: ${summary}`} style={{ padding: 8, height: 200 }}>
        {values.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Sin datos
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <ReferenceArea
                y1={ideal.min}
                y2={hasMax ? ideal.max : domain[1]}
                fill="var(--status-ok-soft)"
                fillOpacity={0.6}
                ifOverflow="hidden"
              />
              <ReferenceLine y={ideal.min} stroke="var(--leaf)" strokeDasharray="4 4" ifOverflow="hidden" />
              {hasMax && <ReferenceLine y={ideal.max} stroke="var(--leaf)" strokeDasharray="4 4" ifOverflow="hidden" />}
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t: number) => (range === '7d' ? dayFormat : hourFormat).format(new Date(t))}
                stroke="var(--text-secondary)"
                tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                minTickGap={24}
              />
              <YAxis
                domain={domain}
                width={48}
                tickFormatter={(v: number) => v.toLocaleString('es-MX', { maximumFractionDigits: info.decimals })}
                stroke="var(--text-secondary)"
                tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-strong)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  boxShadow: 'var(--shadow-card)',
                }}
                itemStyle={{ color: 'var(--text-primary)', fontSize: '0.8125rem' }}
                labelStyle={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}
                labelFormatter={(label) => fullFormat.format(new Date(Number(label)))}
                formatter={(value) => [
                  typeof value === 'number' ? `${formatValue(variable, value)}${unit}` : String(value),
                  range === '7d' ? 'Promedio de la hora' : info.name,
                ]}
              />
              <Line
                type="monotone"
                dataKey={variable}
                name={info.name}
                stroke="var(--status-blue)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <span className="metric-label">{summary}</span>
    </article>
  );
}
