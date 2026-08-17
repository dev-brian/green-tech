import { useState } from 'react';
import { FlaskConical, Send, Zap, Trash2, ChevronDown, ChevronUp, Search, MapPin, Loader2, CloudSun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { THRESHOLDS, statusFor, worstOf, type SensorStatus } from '../lib/sensorThresholds';
import { addLocalReading, setLocalReadings, clearLocalReadings, type TelemetryReading } from '../lib/localTelemetry';
import { searchLocations, getCurrentWeather, getForecast, type WeatherLocation, type CurrentWeather } from '../lib/weatherService';

type Status = SensorStatus;

function Slider({
  label, value, min, max, step = 1, unit, status, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  unit: string; status: Status; onChange: (v: number) => void;
}) {
  const statusColor = {
    green: 'var(--status-green)',
    yellow: 'var(--status-yellow)',
    red: 'var(--status-red)',
    offline: 'var(--status-offline)',
  }[status];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="metric-label">{label}</span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontWeight: 700, fontSize: '0.875rem', color: statusColor,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span className={`nm-led nm-led--${status}`} style={{ width: 10, height: 10 }} />
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
      />
    </div>
  );
}

export default function TestDataPanel({ greenhouseId }: { greenhouseId: string | null }) {
  const { isAdmin } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [temperature, setTemperature] = useState(22);
  const [humidity, setHumidity] = useState(65);
  const [soilMoisture, setSoilMoisture] = useState(65);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<WeatherLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<WeatherLocation | null>(null);
  const [currentWeather, setCurrentWeather] = useState<CurrentWeather | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [injectSpike, setInjectSpike] = useState(false);

  if (!isAdmin || !greenhouseId) return null;

  const tempStatus = statusFor(temperature, THRESHOLDS.temperature);
  const humidStatus = statusFor(humidity, THRESHOLDS.humidity);
  const soilStatus = statusFor(soilMoisture, THRESHOLDS.soilMoisture);

  const showFeedback = (type: 'ok' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationQuery.trim()) return;
    setWeatherBusy(true);
    setWeatherError(null);
    setCurrentWeather(null);
    setSelectedLocation(null);
    try {
      const results = await searchLocations(locationQuery);
      setLocationResults(results);
      if (results.length === 0) {
        setWeatherError('No se encontraron lugares con ese nombre. Prueba agregando el estado, ej. "Apizaco, Tlaxcala, MX".');
      }
    } catch (err: any) {
      setWeatherError(err.message || 'Error al buscar la ubicación.');
      setLocationResults([]);
    } finally {
      setWeatherBusy(false);
    }
  };

  const handleSelectLocation = async (loc: WeatherLocation) => {
    setWeatherBusy(true);
    setWeatherError(null);
    try {
      const weather = await getCurrentWeather(loc.lat, loc.lon);
      setCurrentWeather(weather);
      setSelectedLocation(loc);
      setTemperature(weather.temperature);
      setLocationResults([]);
      setLocationQuery(`${loc.name}${loc.state ? ', ' + loc.state : ''}`);
    } catch (err: any) {
      setWeatherError(err.message || 'Error al obtener el clima.');
    } finally {
      setWeatherBusy(false);
    }
  };

  const pushManualReading = () => {
    try {
      addLocalReading(greenhouseId, {
        nodeId: currentWeather ? 'OWM-REAL' : 'MANUAL-01',
        sector: currentWeather ? currentWeather.locationLabel : 'Manual',
        temperature,
        humidity,
        soilMoisture,
      });
      showFeedback('ok', 'Lectura enviada — el Dashboard se actualiza al instante.');
    } catch (e: any) {
      showFeedback('error', 'Error al guardar localmente: ' + (e.message || 'desconocido.'));
    }
  };

  const generateBulk = async () => {
    const hours = 24;
    const intervalMin = 30;
    const points = Math.floor((hours * 60) / intervalMin);
    const now = Date.now();
    const amplitude = 6; // variación día/noche en °C, para el respaldo sintético

    // Respaldo sintético (onda día/noche) por defecto; se reemplaza por
    // interpolación de datos reales si logramos traer el pronóstico de OWM.
    let tempAt: (i: number) => number = (i) => {
      const t = new Date(now - i * intervalMin * 60 * 1000);
      const hourOfDay = t.getHours() + t.getMinutes() / 60;
      const dayPhase = Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI);
      const noise = i === 0 ? 0 : (Math.random() - 0.5) * 1.5;
      return 22 + dayPhase * amplitude + noise;
    };
    let usedRealForecast = false;

    try {
      if (selectedLocation) {
        setGenerating(true);
        // OWM gratuito no da historial, pero sí pronóstico real cada 3h.
        // Tomamos los primeros ~24h de ese pronóstico (8-9 puntos reales)
        // e interpolamos linealmente entre ellos para suavizar la curva.
        const forecast = await getForecast(selectedLocation.lat, selectedLocation.lon);
        const anchors = forecast.slice(0, 9).map((f) => f.temperature);

        if (anchors.length >= 2) {
          const anchorCount = anchors.length;
          tempAt = (i: number) => {
            const anchorPos = (1 - i / points) * (anchorCount - 1);
            const lowerIdx = Math.floor(anchorPos);
            const upperIdx = Math.min(lowerIdx + 1, anchorCount - 1);
            const frac = anchorPos - lowerIdx;
            const base = anchors[lowerIdx] + (anchors[upperIdx] - anchors[lowerIdx]) * frac;
            const noise = i === 0 ? 0 : (Math.random() - 0.5) * 0.4; // ruido chico, solo textura
            return base + noise;
          };
          usedRealForecast = true;
        }
      } else if (currentWeather) {
        // Sin pronóstico disponible pero sí un clima actual: ancla la
        // onda sintética a ese único dato real.
        const nowDate = new Date(now);
        const nowHourOfDay = nowDate.getHours() + nowDate.getMinutes() / 60;
        const nowDayPhase = Math.sin(((nowHourOfDay - 8) / 24) * 2 * Math.PI);
        const base = currentWeather.temperature - amplitude * nowDayPhase;
        tempAt = (i: number) => {
          const t = new Date(now - i * intervalMin * 60 * 1000);
          const hourOfDay = t.getHours() + t.getMinutes() / 60;
          const dayPhase = Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI);
          const noise = i === 0 ? 0 : (Math.random() - 0.5) * 1.5;
          return base + dayPhase * amplitude + noise;
        };
      }
    } catch (err: any) {
      showFeedback('error', 'No se pudo traer el pronóstico real (' + (err.message || 'error') + '); se usaron datos sintéticos en su lugar.');
    } finally {
      setGenerating(false);
    }

    try {
      const readings: TelemetryReading[] = [];
      for (let i = points; i >= 0; i--) {
        const t = new Date(now - i * intervalMin * 60 * 1000);
        const hourOfDay = t.getHours() + t.getMinutes() / 60;
        const dayPhase = Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI);

        let temp = tempAt(i);
        let hum = 68 - dayPhase * 12 + (Math.random() - 0.5) * 4;
        let soil = 65 + Math.sin((i / points) * Math.PI * 3) * 15 + (Math.random() - 0.5) * 3;

        if (injectSpike && i === Math.floor(points * 0.3)) temp += 11;
        if (injectSpike && i === Math.floor(points * 0.65)) soil -= 30;

        temp = Math.round(temp * 10) / 10;
        hum = Math.max(0, Math.min(100, Math.round(hum)));
        soil = Math.max(0, Math.min(100, Math.round(soil)));

        readings.push({
          id: `local-bulk-${i}-${Date.now()}`,
          greenhouseId,
          nodeId: usedRealForecast ? 'ESP32-SIM-01 (pronóstico real)' : currentWeather ? 'ESP32-SIM-01 (temp. real)' : 'ESP32-SIM-01',
          sector: (selectedLocation?.name ?? currentWeather?.locationLabel) || 'Sector 1',
          timestamp: t,
          temperature: temp,
          humidity: hum,
          soilMoisture: soil,
          semaphoreStatus: worstOf(
            statusFor(temp, THRESHOLDS.temperature),
            statusFor(hum, THRESHOLDS.humidity),
            statusFor(soil, THRESHOLDS.soilMoisture),
          ),
          simulated: true,
        });
      }

      setLocalReadings(greenhouseId, readings);
      showFeedback(
        'ok',
        usedRealForecast
          ? `${readings.length} lecturas generadas usando el pronóstico REAL de OpenWeatherMap para ${selectedLocation?.name} (temperatura interpolada de datos reales cada 3h).`
          : currentWeather
            ? `${readings.length} lecturas de 24h generadas, ancladas a los ${currentWeather.temperature}°C reales de ${currentWeather.locationLabel}.`
            : `${readings.length} lecturas de 24h generadas (reemplazaron los datos anteriores). Busca una ubicación arriba para usar temperatura real.`
      );
    } catch (e: any) {
      showFeedback('error', 'Error al generar: ' + (e.message || 'desconocido.'));
    }
  };

  const clearAll = () => {
    if (!window.confirm('¿Borrar todos los datos de prueba locales de este invernadero?')) return;
    clearLocalReadings(greenhouseId);
    showFeedback('ok', 'Datos de prueba locales borrados.');
  };

  return (
    <div className="nm-flat" style={{ padding: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <FlaskConical size={18} strokeWidth={1.5} color="var(--text-secondary)" />
          <h3 style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            Datos de Prueba (local)
          </h3>
          <span style={{
            fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em',
            color: 'var(--text-disabled)', textTransform: 'uppercase',
          }}>
            Solo visible para ti (admin)
          </span>
        </span>
        {isOpen ? <ChevronUp size={18} color="var(--text-secondary)" /> : <ChevronDown size={18} color="var(--text-secondary)" />}
      </button>

      {isOpen && (
        <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Mueve los sliders y envía una lectura para ver el Dashboard reaccionar al instante,
            o genera 24h de historia de un solo golpe.
          </p>

          <div className="nm-concave" style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <span className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CloudSun size={14} strokeWidth={1.5} /> Temperatura real por ubicación
            </span>

            <form onSubmit={handleSearchLocation} style={{ display: 'flex', gap: 'var(--space-xs)' }}>
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Pueblo, municipio o estado (ej. Apizaco, Tlaxcala, MX)"
                className="nm-flat"
                style={{
                  flex: 1, minHeight: 40, padding: '0 var(--space-sm)',
                  border: 'none', outline: 'none', background: 'var(--bg)',
                  color: 'var(--text-primary)', fontSize: '0.875rem', borderRadius: 'var(--radius-sm)',
                }}
              />
              <button
                type="submit"
                disabled={weatherBusy}
                className="btn-secondary"
                style={{ minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Buscar ubicación"
              >
                {weatherBusy ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Search size={16} strokeWidth={1.5} />}
              </button>
            </form>

            {locationResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {locationResults.map((loc) => (
                  <button
                    key={`${loc.lat}-${loc.lon}`}
                    onClick={() => handleSelectLocation(loc)}
                    className="nm-flat"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      textAlign: 'left', padding: '8px 12px', fontSize: '0.8125rem',
                      border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <MapPin size={13} strokeWidth={1.5} color="var(--text-disabled)" style={{ flexShrink: 0 }} />
                    {loc.name}{loc.state ? `, ${loc.state}` : ''}, {loc.country}
                  </button>
                ))}
              </div>
            )}

            {weatherError && (
              <span style={{ fontSize: '0.75rem', color: 'var(--status-red)' }}>{weatherError}</span>
            )}

            {currentWeather && (
              <div className="nm-flat" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {currentWeather.locationLabel}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {currentWeather.description} · Humedad real: {currentWeather.humidity}%
                  </p>
                </div>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {currentWeather.temperature}°C
                </span>
              </div>
            )}

            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-disabled)', lineHeight: 1.5 }}>
              Al elegir un lugar, su temperatura real se aplica al slider de Temperatura y queda lista para usarse
              en "Generar 24h de Datos". La humedad y humedad de suelo del invernadero siguen siendo manuales — el clima exterior no las mide.
            </p>
          </div>

          <div className="nm-concave" style={{ padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <Slider label="Temperatura" value={temperature} min={0} max={45} step={0.5} unit="°C" status={tempStatus} onChange={setTemperature} />
            <Slider label="Humedad Relativa" value={humidity} min={0} max={100} unit="%" status={humidStatus} onChange={setHumidity} />
            <Slider label="Humedad de Suelo" value={soilMoisture} min={0} max={100} unit="%" status={soilStatus} onChange={setSoilMoisture} />
          </div>

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
            fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5,
          }}>
            <input
              type="checkbox"
              checked={injectSpike}
              onChange={(e) => setInjectSpike(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              Forzar un pico de alerta demostrativo (+11°C temperatura, −30% suelo) en el "Generar 24h de Datos".
              Déjalo desmarcado para que la curva respete fielmente el clima real cuando hay una ubicación seleccionada.
            </span>
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            <button onClick={pushManualReading} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px' }}>
              <Send size={16} strokeWidth={1.5} /> Enviar Lectura
            </button>
            <button onClick={generateBulk} disabled={generating} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px' }}>
              {generating ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Zap size={16} strokeWidth={1.5} />}
              {generating ? 'Generando...' : 'Generar 24h de Datos'}
            </button>
            <button
              onClick={clearAll}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px', color: 'var(--status-red)' }}
            >
              <Trash2 size={16} strokeWidth={1.5} /> Borrar Datos de Prueba
            </button>
          </div>

          {feedback && (
            <div className="nm-concave" style={{
              padding: 'var(--space-xs) var(--space-sm)',
              borderLeft: `3px solid ${feedback.type === 'ok' ? 'var(--status-green)' : 'var(--status-red)'}`,
              fontSize: '0.8125rem',
              color: feedback.type === 'ok' ? 'var(--status-green)' : 'var(--status-red)',
            }}>
              {feedback.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
