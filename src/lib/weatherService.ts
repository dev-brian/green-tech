/**
 * Integración con OpenWeatherMap: buscar ubicaciones, clima actual y
 * pronóstico real (usado por el simulador de 24h en TestDataPanel).
 * La API key vive en .env.local (VITE_OPENWEATHER_API_KEY), no aquí.
 */

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined;

export interface WeatherLocation {
  name: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
}

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  description: string;
  locationLabel: string;
}

export interface ForecastPoint {
  date: Date;
  temperature: number;
  humidity: number;
  description: string;
}

function requireApiKey() {
  if (!API_KEY) {
    throw new Error('Falta configurar VITE_OPENWEATHER_API_KEY en .env.local (y reiniciar `pnpm dev`).');
  }
  return API_KEY;
}

/** Busca lugares por nombre (pueblo, municipio, estado...) vía el Geocoding API de OWM. */
export async function searchLocations(query: string): Promise<WeatherLocation[]> {
  const key = requireApiKey();
  const q = query.trim();
  if (!q) return [];

  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=6&appid=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error('API key de OpenWeatherMap inválida o aún no activada (puede tardar unos minutos en activarse tras crearla).');
    throw new Error(`No se pudo buscar la ubicación (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as any[];
  return data.map((d) => ({
    name: d.name,
    state: d.state,
    country: d.country,
    lat: d.lat,
    lon: d.lon,
  }));
}

/** Obtiene el clima actual (temperatura real en °C) para una lat/lon. */
export async function getCurrentWeather(lat: number, lon: number): Promise<CurrentWeather> {
  const key = requireApiKey();
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=es`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error('API key de OpenWeatherMap inválida o aún no activada.');
    throw new Error(`No se pudo obtener el clima (HTTP ${res.status}).`);
  }
  const data = await res.json();
  return {
    temperature: Math.round(data.main.temp * 10) / 10,
    humidity: Math.round(data.main.humidity),
    description: data.weather?.[0]?.description ?? '',
    locationLabel: data.name || 'Ubicación seleccionada',
  };
}

/**
 * Pronóstico real cada 3h (endpoint gratuito de OWM). El plan gratuito no
 * da temperatura histórica, así que estos puntos se usan como anclas
 * reales y solo se interpola entre ellos para suavizar la gráfica.
 */
export async function getForecast(lat: number, lon: number): Promise<ForecastPoint[]> {
  const key = requireApiKey();
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=es`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error('API key de OpenWeatherMap inválida o aún no activada.');
    throw new Error(`No se pudo obtener el pronóstico (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const list = (data.list ?? []) as any[];
  return list.map((item) => ({
    date: new Date(item.dt * 1000),
    temperature: item.main.temp,
    humidity: item.main.humidity,
    description: item.weather?.[0]?.description ?? '',
  }));
}
