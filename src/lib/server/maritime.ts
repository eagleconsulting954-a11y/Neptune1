import { createResource, listResource, type Row } from "@/src/lib/server/db";

const WEATHER_BASE = process.env.OPEN_METEO_WEATHER_BASE_URL || "https://api.open-meteo.com/v1/forecast";
const MARINE_BASE = process.env.OPEN_METEO_MARINE_BASE_URL || "https://marine-api.open-meteo.com/v1/marine";
const GEOCODING_BASE = process.env.OPEN_METEO_GEOCODING_BASE_URL || "https://geocoding-api.open-meteo.com/v1/search";

function addApiKey(url: URL, key?: string) {
  if (key) url.searchParams.set("apikey", key);
  return url;
}

async function fetchJson(url: URL | string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(18000),
    ...init,
    headers: { accept: "application/json", ...(init?.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`UPSTREAM_${response.status}:${body.slice(0, 240)}`);
  }
  return response.json();
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function zipped(hourly: Row | undefined, keys: string[], limit = 48) {
  if (!hourly?.time || !Array.isArray(hourly.time)) return [];
  return hourly.time.slice(0, limit).map((time: string, index: number) => {
    const row: Row = { time };
    for (const key of keys) row[key] = Array.isArray(hourly[key]) ? hourly[key][index] : null;
    return row;
  });
}

function dailyRows(daily: Row | undefined, keys: string[]) {
  if (!daily?.time || !Array.isArray(daily.time)) return [];
  return daily.time.map((date: string, index: number) => {
    const row: Row = { date };
    for (const key of keys) row[key] = Array.isArray(daily[key]) ? daily[key][index] : null;
    return row;
  });
}

export function weatherCodeLabel(code: number | null | undefined) {
  const labels: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail"
  };
  return labels[number(code, -1)] || "Variable conditions";
}

export async function geocodeLocation(query: string) {
  const url = addApiKey(new URL(GEOCODING_BASE), process.env.OPEN_METEO_API_KEY);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const data = await fetchJson(url);
  return (data.results || []).map((item: Row) => ({
    id: item.id,
    name: item.name,
    country: item.country,
    countryCode: item.country_code,
    admin1: item.admin1,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone
  }));
}

export async function getWeatherAndOcean(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("INVALID_COORDINATES");

  const weatherUrl = addApiKey(new URL(WEATHER_BASE), process.env.OPEN_METEO_API_KEY);
  weatherUrl.searchParams.set("latitude", String(latitude));
  weatherUrl.searchParams.set("longitude", String(longitude));
  weatherUrl.searchParams.set("timezone", "auto");
  weatherUrl.searchParams.set("forecast_days", "7");
  weatherUrl.searchParams.set("wind_speed_unit", "kn");
  weatherUrl.searchParams.set("cell_selection", "nearest");
  weatherUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility");
  weatherUrl.searchParams.set("hourly", "temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility");
  weatherUrl.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max");

  const marineUrl = addApiKey(new URL(MARINE_BASE), process.env.OPEN_METEO_API_KEY);
  marineUrl.searchParams.set("latitude", String(latitude));
  marineUrl.searchParams.set("longitude", String(longitude));
  marineUrl.searchParams.set("timezone", "auto");
  marineUrl.searchParams.set("forecast_days", "7");
  marineUrl.searchParams.set("cell_selection", "sea");
  marineUrl.searchParams.set("current", "wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction");
  marineUrl.searchParams.set("hourly", "wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction");
  marineUrl.searchParams.set("daily", "wave_height_max,swell_wave_height_max,wave_direction_dominant,wave_period_max");

  const [weather, marine] = await Promise.all([fetchJson(weatherUrl), fetchJson(marineUrl)]);
  const currentWeather = { ...(weather.current || {}), condition: weatherCodeLabel(weather.current?.weather_code) };
  const weatherHourly = zipped(weather.hourly, ["temperature_2m", "relative_humidity_2m", "precipitation_probability", "weather_code", "cloud_cover", "pressure_msl", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "visibility"], 48)
    .map(item => ({ ...item, condition: weatherCodeLabel(item.weather_code) }));

  return {
    provider: "Open-Meteo",
    generatedAt: new Date().toISOString(),
    latitude: weather.latitude,
    longitude: weather.longitude,
    timezone: weather.timezone,
    elevation: weather.elevation,
    currentWeather,
    currentMarine: marine.current || {},
    units: { weather: weather.current_units || {}, marine: marine.current_units || {} },
    hourly: {
      weather: weatherHourly,
      marine: zipped(marine.hourly, ["wave_height", "wave_direction", "wave_period", "swell_wave_height", "swell_wave_direction", "swell_wave_period", "sea_surface_temperature", "ocean_current_velocity", "ocean_current_direction"], 48)
    },
    daily: {
      weather: dailyRows(weather.daily, ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_probability_max", "wind_speed_10m_max", "wind_gusts_10m_max"]).map(item => ({ ...item, condition: weatherCodeLabel(item.weather_code) })),
      marine: dailyRows(marine.daily, ["wave_height_max", "swell_wave_height_max", "wave_direction_dominant", "wave_period_max"])
    },
    attribution: "Weather and marine forecast data: Open-Meteo. Marine conditions are planning support only and are not suitable for navigation."
  };
}

function replaceTemplate(template: string, values: Record<string, string | number | null | undefined>) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => encodeURIComponent(String(values[key] ?? "")));
}

function firstObject(value: any): Row {
  if (Array.isArray(value)) return firstObject(value[0] || {});
  if (value?.data) return firstObject(value.data);
  if (value?.results) return firstObject(value.results);
  return value && typeof value === "object" ? value : {};
}

function pick(source: Row, keys: string[]) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
    const upper = key.toUpperCase();
    if (source[upper] !== undefined && source[upper] !== null && source[upper] !== "") return source[upper];
  }
  return null;
}

export async function fetchPortCongestion(port: Row) {
  const template = process.env.MARINETRAFFIC_PORT_CONGESTION_URL;
  const apiKey = process.env.MARINETRAFFIC_API_KEY;
  if (!template || !apiKey) {
    return {
      configured: false,
      provider: "MarineTraffic",
      message: "Add MARINETRAFFIC_API_KEY and MARINETRAFFIC_PORT_CONGESTION_URL to retrieve live AIS congestion data."
    };
  }

  const target = replaceTemplate(template, {
    portId: port.provider_port_id,
    providerPortId: port.provider_port_id,
    unlocode: port.unlocode,
    latitude: port.latitude,
    longitude: port.longitude
  });
  const url = new URL(target);
  if (!url.searchParams.has("api_key")) url.searchParams.set("api_key", apiKey);
  const raw = await fetchJson(url, { redirect: "follow" });
  const source = firstObject(raw);
  const vesselsInPort = number(pick(source, ["vessels_in_port", "vesselsInPort", "in_port", "port_vessels"]));
  const vesselsWaiting = number(pick(source, ["vessels_waiting", "vesselsWaiting", "waiting", "anchorage_vessels"]));
  const averageWaitHours = number(pick(source, ["avg_wait_hours", "average_wait_hours", "waiting_time_hours", "avg_waiting_time"]));
  const ratio = vesselsInPort ? vesselsWaiting / vesselsInPort : vesselsWaiting ? 1 : 0;
  const congestionLevel = averageWaitHours >= 48 || ratio >= 0.75 ? "Severe" : averageWaitHours >= 24 || ratio >= 0.45 ? "High" : averageWaitHours >= 12 || ratio >= 0.2 ? "Moderate" : "Low";

  return {
    configured: true,
    provider: "MarineTraffic",
    observedAt: new Date().toISOString(),
    vesselsInPort,
    vesselsWaiting,
    averageWaitHours,
    congestionLevel,
    raw
  };
}

export async function fetchBunkerPrice(port: string, fuelType: string) {
  const template = process.env.BUNKER_PRICE_API_URL;
  if (!template) return { configured: false, provider: "External bunker price provider", pricePerMt: null };
  const target = replaceTemplate(template, { port, fuelType });
  const url = new URL(target);
  if (process.env.BUNKER_PRICE_API_KEY && !url.searchParams.has("api_key")) url.searchParams.set("api_key", process.env.BUNKER_PRICE_API_KEY);
  const raw = await fetchJson(url);
  const source = firstObject(raw);
  const pricePerMt = number(pick(source, ["price_per_mt", "price", "value", "usd_per_mt"]), NaN);
  return {
    configured: true,
    provider: process.env.BUNKER_PRICE_PROVIDER_NAME || "External bunker price provider",
    pricePerMt: Number.isFinite(pricePerMt) ? pricePerMt : null,
    raw
  };
}

export function calculateBunkerPlan(input: Row) {
  const distanceNm = Math.max(0, number(input.distance_nm));
  const speedKn = Math.max(0.1, number(input.speed_kn, 12));
  const dailyConsumptionMt = Math.max(0, number(input.daily_consumption_mt));
  const currentRobMt = Math.max(0, number(input.current_rob_mt));
  const reservePercent = Math.max(0, number(input.reserve_percent, 15));
  const pricePerMt = Math.max(0, number(input.price_per_mt));
  const voyageDays = distanceNm / speedKn / 24;
  const voyageConsumptionMt = voyageDays * dailyConsumptionMt;
  const reserveMt = voyageConsumptionMt * reservePercent / 100;
  const totalRequiredMt = voyageConsumptionMt + reserveMt;
  const quantityRequiredMt = Math.max(0, totalRequiredMt - currentRobMt);
  const estimatedCost = quantityRequiredMt * pricePerMt;

  return {
    distance_nm: Number(distanceNm.toFixed(1)),
    speed_kn: Number(speedKn.toFixed(1)),
    daily_consumption_mt: Number(dailyConsumptionMt.toFixed(2)),
    current_rob_mt: Number(currentRobMt.toFixed(2)),
    reserve_percent: Number(reservePercent.toFixed(1)),
    voyage_days: Number(voyageDays.toFixed(2)),
    voyage_consumption_mt: Number(voyageConsumptionMt.toFixed(2)),
    reserve_mt: Number(reserveMt.toFixed(2)),
    total_required_mt: Number(totalRequiredMt.toFixed(2)),
    quantity_required_mt: Number(quantityRequiredMt.toFixed(2)),
    price_per_mt: Number(pricePerMt.toFixed(2)),
    estimated_cost: Number(estimatedCost.toFixed(2))
  };
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

export function distanceNm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const radiusNm = 3440.065;
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radiusNm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function nearestMrcc(orgId: string, latitude: number, longitude: number, limit = 8) {
  const contacts = await listResource("mrcc_contacts", orgId);
  return contacts
    .filter(contact => Number.isFinite(Number(contact.latitude)) && Number.isFinite(Number(contact.longitude)))
    .map(contact => ({ ...contact, distance_nm: Number(distanceNm(latitude, longitude, Number(contact.latitude), Number(contact.longitude)).toFixed(1)) }))
    .sort((a, b) => a.distance_nm - b.distance_nm)
    .slice(0, limit);
}

export async function saveCongestionSnapshot(orgId: string, portId: string, congestion: Row) {
  if (!congestion?.configured) return null;
  return createResource("port_congestion_snapshots", orgId, {
    port_id: portId,
    provider: congestion.provider,
    vessels_in_port: congestion.vesselsInPort,
    vessels_waiting: congestion.vesselsWaiting,
    avg_wait_hours: congestion.averageWaitHours,
    congestion_level: congestion.congestionLevel,
    observed_at: congestion.observedAt,
    raw_json: congestion.raw
  });
}
