"use client";

import { useEffect, useMemo, useState } from "react";

type LocationResult = {
  id?: number;
  name: string;
  country?: string;
  countryCode?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type Props = {
  data: Record<string, any>;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
};

const INTEL_TABS = ["Weather & Ocean", "Port Intelligence", "Bunkering Plan", "MRCC Directory", "Nav Aids"];

function formatNumber(value: unknown, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
}

function compass(value: unknown) {
  const degrees = Number(value);
  if (!Number.isFinite(degrees)) return "—";
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return `${points[Math.round(degrees / 45) % 8]} ${Math.round(degrees)}°`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export function MaritimeIntelligence({ data, refresh, notify }: Props) {
  const [active, setActive] = useState(INTEL_TABS[0]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [selectedPortId, setSelectedPortId] = useState("");
  const [congestion, setCongestion] = useState<any>(null);
  const [congestionLoading, setCongestionLoading] = useState(false);
  const [bunkerResult, setBunkerResult] = useState<any>(null);
  const [nearestContacts, setNearestContacts] = useState<any[]>([]);
  const [showPortForm, setShowPortForm] = useState(false);
  const [showMrccForm, setShowMrccForm] = useState(false);

  const ports = data?.ports || [];
  const bunkerPlans = data?.bunkerPlans || [];
  const mrccContacts = nearestContacts.length ? nearestContacts : (data?.mrccContacts || []);
  const selectedPort = ports.find((port: any) => port.id === selectedPortId);

  useEffect(() => {
    if (!selectedPortId && ports[0]?.id) setSelectedPortId(ports[0].id);
  }, [ports, selectedPortId]);

  async function searchLocation(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    const response = await fetch(`/api/v1/intelligence/geocode?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      notify(result.error || "Location search failed.");
      return;
    }
    setSuggestions(result.results || []);
  }

  async function loadForecast(target = location) {
    if (!target) {
      notify("Choose a port, city, or coordinate before loading weather.");
      return;
    }
    setForecastLoading(true);
    const response = await fetch(`/api/v1/intelligence/weather?lat=${target.latitude}&lon=${target.longitude}`, { cache: "no-store" });
    const result = await response.json();
    setForecastLoading(false);
    if (!response.ok) {
      notify(result.error || "Weather and ocean forecast failed.");
      return;
    }
    setForecast(result);
    setActive("Weather & Ocean");
    notify(`Live weather and ocean forecast loaded for ${target.name}.`);
  }

  function chooseLocation(result: LocationResult) {
    setLocation(result);
    setQuery([result.name, result.admin1, result.country].filter(Boolean).join(", "));
    setSuggestions([]);
    void loadForecast(result);
  }

  function useCurrentPosition() {
    if (!navigator.geolocation) {
      notify("Location services are not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const target = { name: "Current vessel/device position", latitude: position.coords.latitude, longitude: position.coords.longitude };
        setLocation(target);
        setQuery(target.name);
        void loadForecast(target);
      },
      () => notify("Location permission was denied or unavailable."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function usePortLocation(port: any) {
    if (!Number.isFinite(Number(port.latitude)) || !Number.isFinite(Number(port.longitude))) {
      notify("This port needs latitude and longitude before weather can be loaded.");
      return;
    }
    const target = {
      name: port.name,
      country: port.country,
      latitude: Number(port.latitude),
      longitude: Number(port.longitude),
      timezone: port.timezone
    };
    setLocation(target);
    setQuery([port.name, port.country].filter(Boolean).join(", "));
    void loadForecast(target);
  }

  async function savePort(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/v1/ports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        max_draft_m: body.max_draft_m ? Number(body.max_draft_m) : null,
        bunkering_available: body.bunkering_available === "on"
      })
    });
    const result = await response.json();
    if (!response.ok) {
      notify(result.error || "Unable to save port information.");
      return;
    }
    setShowPortForm(false);
    notify("Port information saved to the production database.");
    await refresh();
    setSelectedPortId(result.item.id);
  }

  async function refreshCongestion() {
    if (!selectedPortId) {
      notify("Choose a saved port first.");
      return;
    }
    setCongestionLoading(true);
    const response = await fetch(`/api/v1/intelligence/port-congestion?portId=${encodeURIComponent(selectedPortId)}`, { cache: "no-store" });
    const result = await response.json();
    setCongestionLoading(false);
    if (!response.ok) {
      notify(result.error || "Unable to load port congestion.");
      return;
    }
    setCongestion(result.congestion);
    notify(result.congestion?.configured ? "Live port congestion refreshed." : result.congestion?.message || "Port congestion provider is not configured.");
    if (result.congestion?.configured) await refresh();
  }

  async function createBunkerPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const numeric = ["distance_nm", "speed_kn", "daily_consumption_mt", "current_rob_mt", "reserve_percent", "price_per_mt"];
    const body: Record<string, any> = { ...values };
    for (const key of numeric) body[key] = Number(body[key] || 0);
    const response = await fetch("/api/v1/intelligence/bunker-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) {
      notify(result.error || "Unable to create bunkering plan.");
      return;
    }
    setBunkerResult(result);
    notify("Bunkering plan calculated and saved.");
    await refresh();
  }

  async function loadNearestMrcc() {
    if (!location) {
      notify("Choose a location before searching for the nearest MRCC contacts.");
      return;
    }
    const response = await fetch(`/api/v1/intelligence/mrcc?lat=${location.latitude}&lon=${location.longitude}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      notify(result.error || "Unable to load MRCC contacts.");
      return;
    }
    setNearestContacts(result.contacts || []);
    setActive("MRCC Directory");
    notify(result.contacts?.length ? "Nearest verified MRCC contacts loaded." : "No verified MRCC contacts are stored for this organization yet.");
  }

  async function saveMrcc(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/v1/intelligence/mrcc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...values,
        latitude: values.latitude ? Number(values.latitude) : null,
        longitude: values.longitude ? Number(values.longitude) : null
      })
    });
    const result = await response.json();
    if (!response.ok) {
      notify(result.error || "Unable to save the MRCC contact.");
      return;
    }
    setShowMrccForm(false);
    setNearestContacts([]);
    notify("Verified MRCC contact saved.");
    await refresh();
  }

  const forecastHours = useMemo(() => forecast?.hourly?.weather?.slice(0, 12) || [], [forecast]);
  const marineByTime = useMemo(() => new Map((forecast?.hourly?.marine || []).map((row: any) => [row.time, row])), [forecast]);

  return (
    <section className="maritime-intel">
      <div className="intel-hero glass premium">
        <div className="intel-sky" aria-hidden="true"><span className="nav-star s1">✦</span><span className="nav-star s2">✦</span><span className="nav-star s3">✦</span><i className="route-line r1" /><i className="route-line r2" /><div className="compass-rose">N<span>✦</span></div><div className="lighthouse"><i /></div><div className="buoy buoy-one">◆</div><div className="buoy buoy-two">◆</div></div>
        <div className="intel-hero-copy"><p className="eyebrow">Maritime Intelligence</p><h2>Navigate with clarity. Lead the next generation forward.</h2><p>Live weather, ocean forecasts, port intelligence, bunkering decisions, and verified rescue contacts—connected to the vessel command workflow.</p><div className="intel-location-bar"><form onSubmit={searchLocation}><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search port, city, or coastal location" /><button className="btn gold">Search</button></form><button className="btn" onClick={useCurrentPosition}>Use current position</button><button className="btn" onClick={() => loadForecast()}>Refresh forecast</button></div>{suggestions.length > 0 && <div className="location-results">{suggestions.map(result => <button key={`${result.id}-${result.latitude}-${result.longitude}`} onClick={() => chooseLocation(result)}><b>{result.name}</b><span>{[result.admin1, result.country].filter(Boolean).join(", ")}</span><small>{formatNumber(result.latitude, 3)}, {formatNumber(result.longitude, 3)}</small></button>)}</div>}</div>
      </div>

      <nav className="intel-tabs">{INTEL_TABS.map(tab => <button key={tab} className={active === tab ? "active" : ""} onClick={() => setActive(tab)}>{tab}</button>)}</nav>

      {active === "Weather & Ocean" && <section className="intel-section">
        {!forecast ? <EmptyState title="Choose a maritime location" body="Search a port or use the vessel/device position to load live weather and ocean conditions." action={<button className="btn gold" onClick={useCurrentPosition}>Use current position</button>} /> : <>
          <div className="intel-section-head"><div><p className="eyebrow">Live Conditions</p><h3>{location?.name || "Selected location"}</h3><span>{formatNumber(forecast.latitude, 3)}, {formatNumber(forecast.longitude, 3)} · {forecast.timezone}</span></div><span className="provider-badge">Open-Meteo · {forecastLoading ? "Updating" : "Live"}</span></div>
          <div className="intel-metrics">
            <Metric icon="☀" label="Air temperature" value={`${formatNumber(forecast.currentWeather?.temperature_2m)}°C`} note={forecast.currentWeather?.condition} />
            <Metric icon="↗" label="Wind" value={`${formatNumber(forecast.currentWeather?.wind_speed_10m)} kn`} note={compass(forecast.currentWeather?.wind_direction_10m)} />
            <Metric icon="≈" label="Wave height" value={`${formatNumber(forecast.currentMarine?.wave_height)} m`} note={`${formatNumber(forecast.currentMarine?.wave_period)} sec`} />
            <Metric icon="〰" label="Swell" value={`${formatNumber(forecast.currentMarine?.swell_wave_height)} m`} note={compass(forecast.currentMarine?.swell_wave_direction)} />
            <Metric icon="◉" label="Sea temperature" value={`${formatNumber(forecast.currentMarine?.sea_surface_temperature)}°C`} note="Surface" />
            <Metric icon="➜" label="Ocean current" value={`${formatNumber(forecast.currentMarine?.ocean_current_velocity)} km/h`} note={compass(forecast.currentMarine?.ocean_current_direction)} />
          </div>
          <div className="intel-grid two">
            <article className="intel-panel glass"><div className="panel-heading"><div><p className="eyebrow">48-Hour Window</p><h3>Weather and sea state</h3></div></div><div className="forecast-table"><div className="forecast-row header"><span>Time</span><span>Condition</span><span>Wind</span><span>Wave</span><span>Swell</span></div>{forecastHours.map((hour: any) => { const marine: any = marineByTime.get(hour.time) || {}; return <div className="forecast-row" key={hour.time}><span>{dateLabel(hour.time)}</span><span>{hour.condition}</span><span>{formatNumber(hour.wind_speed_10m)} kn</span><span>{formatNumber(marine.wave_height)} m</span><span>{formatNumber(marine.swell_wave_height)} m</span></div>; })}</div></article>
            <article className="intel-panel glass"><div className="panel-heading"><div><p className="eyebrow">Seven-Day Outlook</p><h3>Voyage planning forecast</h3></div></div><div className="daily-forecast">{(forecast.daily?.weather || []).map((day: any, index: number) => { const sea = forecast.daily?.marine?.[index] || {}; return <div key={day.date}><b>{new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</b><span>{day.condition}</span><small>{formatNumber(day.temperature_2m_min)}–{formatNumber(day.temperature_2m_max)}°C</small><em>Wave max {formatNumber(sea.wave_height_max)} m</em></div>; })}</div></article>
          </div>
          <p className="safety-note">Planning support only. Confirm with official forecasts, NAVTEX/SafetyNET, bridge systems, local VTS, and the Master’s passage plan before navigation.</p>
        </>}
      </section>}

      {active === "Port Intelligence" && <section className="intel-section">
        <div className="intel-section-head"><div><p className="eyebrow">Port Intelligence</p><h3>Congestion, terminal, draft, anchorage, and bunkering information</h3></div><button className="btn gold" onClick={() => setShowPortForm(value => !value)}>{showPortForm ? "Close form" : "Add port"}</button></div>
        {showPortForm && <form className="intel-form glass" onSubmit={savePort}><label>Port name<input name="name" required /></label><label>UN/LOCODE<input name="unlocode" placeholder="USMIA" /></label><label>Country<input name="country" required /></label><label>Latitude<input name="latitude" type="number" step="any" required /></label><label>Longitude<input name="longitude" type="number" step="any" required /></label><label>Timezone<input name="timezone" placeholder="America/New_York" /></label><label>Terminal<input name="terminal" /></label><label>Maximum draft (m)<input name="max_draft_m" type="number" step="0.1" /></label><label>Provider port ID<input name="provider_port_id" placeholder="MarineTraffic port ID" /></label><label className="wide">Anchorage and arrival notes<textarea name="anchorage_notes" rows={3} /></label><label className="check"><input name="bunkering_available" type="checkbox" /> Bunkering available</label><button className="btn gold">Save port information</button></form>}
        {ports.length ? <div className="intel-grid port-grid"><article className="intel-panel glass"><div className="port-list">{ports.map((port: any) => <button key={port.id} className={selectedPortId === port.id ? "active" : ""} onClick={() => setSelectedPortId(port.id)}><div><b>{port.name}</b><span>{[port.unlocode, port.country].filter(Boolean).join(" · ")}</span></div><em>{port.bunkering_available ? "Bunker" : "Port"}</em></button>)}</div></article><article className="intel-panel glass">{selectedPort ? <><div className="panel-heading"><div><p className="eyebrow">Selected Port</p><h3>{selectedPort.name}</h3></div><span className="status">{selectedPort.unlocode || "No UN/LOCODE"}</span></div><div className="port-facts"><div><span>Country</span><b>{selectedPort.country || "—"}</b></div><div><span>Terminal</span><b>{selectedPort.terminal || "—"}</b></div><div><span>Max draft</span><b>{selectedPort.max_draft_m ? `${selectedPort.max_draft_m} m` : "—"}</b></div><div><span>Bunkering</span><b>{selectedPort.bunkering_available ? "Available" : "Not recorded"}</b></div><div className="wide"><span>Anchorage notes</span><b>{selectedPort.anchorage_notes || "No notes recorded."}</b></div></div><div className="actions"><button className="btn gold" disabled={congestionLoading} onClick={refreshCongestion}>{congestionLoading ? "Refreshing..." : "Refresh live congestion"}</button><button className="btn" onClick={() => usePortLocation(selectedPort)}>Load port weather</button></div>{congestion && <div className={`congestion-card ${String(congestion.congestionLevel || "").toLowerCase()}`}><div><span>Congestion</span><b>{congestion.congestionLevel || "Unavailable"}</b></div><div><span>Vessels in port</span><b>{congestion.vesselsInPort ?? "—"}</b></div><div><span>Waiting</span><b>{congestion.vesselsWaiting ?? "—"}</b></div><div><span>Average wait</span><b>{congestion.averageWaitHours != null ? `${congestion.averageWaitHours} h` : "—"}</b></div>{!congestion.configured && <p>{congestion.message}</p>}</div>}</> : <EmptyState title="Select a port" body="Choose a saved port to review its information and congestion status." />}</article></div> : <EmptyState title="No ports recorded" body="Add the first real port record with coordinates, terminal details, draft, and provider ID." action={<button className="btn gold" onClick={() => setShowPortForm(true)}>Add port</button>} />}
      </section>}

      {active === "Bunkering Plan" && <section className="intel-section">
        <div className="intel-section-head"><div><p className="eyebrow">Bunkering Planner</p><h3>Calculate voyage consumption, reserve, lift quantity, and estimated cost</h3></div></div>
        <div className="intel-grid two bunker-layout"><form className="intel-form glass" onSubmit={createBunkerPlan}><label>Departure port<input name="departure_port" required /></label><label>Destination port<input name="destination_port" required /></label><label>Bunker port<input name="bunker_port" required /></label><label>Fuel type<select name="fuel_type" defaultValue="VLSFO"><option>VLSFO</option><option>MGO</option><option>HSFO</option><option>LNG</option><option>Biofuel blend</option><option>Methanol</option></select></label><label>Distance (nm)<input name="distance_nm" type="number" step="0.1" required /></label><label>Speed (kn)<input name="speed_kn" type="number" step="0.1" defaultValue="12" required /></label><label>Daily consumption (mt)<input name="daily_consumption_mt" type="number" step="0.01" required /></label><label>Current ROB (mt)<input name="current_rob_mt" type="number" step="0.01" required /></label><label>Reserve (%)<input name="reserve_percent" type="number" step="0.1" defaultValue="15" required /></label><label>Price per mt (USD)<input name="price_per_mt" type="number" step="0.01" placeholder="Leave 0 for provider" /></label><label>Supplier<input name="supplier" /></label><label>ETA<input name="eta" /></label><label className="wide">Plan notes<textarea name="notes" rows={3} /></label><button className="btn gold">Calculate and save plan</button></form><article className="intel-panel glass bunker-result">{bunkerResult ? <><p className="eyebrow">Calculated Lift</p><h2>{formatNumber(bunkerResult.calculation?.quantity_required_mt, 2)} mt</h2><div className="port-facts"><div><span>Voyage days</span><b>{formatNumber(bunkerResult.calculation?.voyage_days, 2)}</b></div><div><span>Voyage burn</span><b>{formatNumber(bunkerResult.calculation?.voyage_consumption_mt, 2)} mt</b></div><div><span>Reserve</span><b>{formatNumber(bunkerResult.calculation?.reserve_mt, 2)} mt</b></div><div><span>Estimated cost</span><b>${Number(bunkerResult.calculation?.estimated_cost || 0).toLocaleString()}</b></div></div><span className="provider-badge">{bunkerResult.priceProvider?.configured ? bunkerResult.priceProvider.provider : "Manual price"}</span></> : <EmptyState title="Build a bunkering plan" body="Enter the route, consumption, ROB, reserve, and fuel pricing. Neptune will calculate the recommended lift and save the plan." />}</article></div>
        {bunkerPlans.length > 0 && <article className="intel-panel glass"><div className="panel-heading"><div><p className="eyebrow">Saved Plans</p><h3>Recent bunkering decisions</h3></div></div><div className="data-grid"><table><thead><tr><th>Route</th><th>Bunker port</th><th>Fuel</th><th>Required</th><th>Price</th><th>Estimated cost</th><th>Status</th></tr></thead><tbody>{bunkerPlans.map((plan: any) => <tr key={plan.id}><td>{plan.departure_port} → {plan.destination_port}</td><td>{plan.bunker_port}</td><td>{plan.fuel_type}</td><td>{formatNumber(plan.quantity_required_mt, 2)} mt</td><td>${Number(plan.price_per_mt || 0).toLocaleString()}</td><td>${Number(plan.estimated_cost || 0).toLocaleString()}</td><td><span className="status">{plan.status}</span></td></tr>)}</tbody></table></div></article>}
      </section>}

      {active === "MRCC Directory" && <section className="intel-section">
        <div className="intel-section-head"><div><p className="eyebrow">MRCC Contacts</p><h3>Verified maritime rescue coordination contacts</h3><span>Store only contacts validated against an authoritative national or IMO/GMDSS source.</span></div><div className="actions"><button className="btn" onClick={loadNearestMrcc}>Find nearest</button><button className="btn gold" onClick={() => setShowMrccForm(value => !value)}>{showMrccForm ? "Close form" : "Add verified contact"}</button></div></div>
        <div className="emergency-warning"><b>Emergency use:</b> Always use GMDSS distress procedures, VHF Channel 16/DSC, satellite distress systems, official publications, and the vessel’s approved emergency plan. This directory is a secondary reference.</div>
        {showMrccForm && <form className="intel-form glass" onSubmit={saveMrcc}><label>MRCC/JRCC name<input name="name" required /></label><label>Country<input name="country" required /></label><label>Region/SRR<input name="region" /></label><label>Phone<input name="phone" /></label><label>Email<input name="email" type="email" /></label><label>VHF channel<input name="vhf_channel" placeholder="16 / 70 DSC" /></label><label>MMSI<input name="mmsi" /></label><label>Latitude<input name="latitude" type="number" step="any" /></label><label>Longitude<input name="longitude" type="number" step="any" /></label><label>Authoritative source URL<input name="source_url" type="url" required /></label><label>Verified date<input name="verified_at" type="date" required /></label><label className="wide">Notes<textarea name="notes" rows={3} /></label><button className="btn gold">Save verified contact</button></form>}
        {mrccContacts.length ? <div className="mrcc-grid">{mrccContacts.map((contact: any) => <article className="mrcc-card glass" key={contact.id}><div className="mrcc-card-head"><div><p className="eyebrow">{contact.country || "MRCC"}</p><h3>{contact.name}</h3></div>{contact.distance_nm != null && <span className="status">{contact.distance_nm} nm</span>}</div><p>{contact.region || "Search and rescue region not recorded."}</p><div className="mrcc-actions">{contact.phone && <a className="btn gold" href={`tel:${contact.phone}`}>Call {contact.phone}</a>}{contact.email && <a className="btn" href={`mailto:${contact.email}`}>Email</a>}{contact.source_url && <a className="btn" href={contact.source_url} target="_blank" rel="noreferrer">Verify source</a>}</div><div className="mrcc-meta"><span>VHF {contact.vhf_channel || "—"}</span><span>MMSI {contact.mmsi || "—"}</span><span>Verified {contact.verified_at || "—"}</span></div></article>)}</div> : <EmptyState title="No verified MRCC contacts" body="Import or add contacts only after verifying them against an authoritative source. Neptune intentionally does not invent emergency contact data." action={<button className="btn gold" onClick={() => setShowMrccForm(true)}>Add verified contact</button>} />}
      </section>}

      {active === "Nav Aids" && <section className="intel-section">
        <div className="nav-aids-screen glass premium"><div className="nav-aids-ocean"><div className="nav-horizon" /><div className="nav-lighthouse"><i /><b /></div><div className="nav-buoy left">◆</div><div className="nav-buoy right">◆</div><div className="nav-route"><span>•</span><span>•</span><span>•</span><span>•</span></div><div className="nav-compass"><b>N</b><span>✦</span><small>Steady course</small></div></div><div className="nav-aids-copy"><p className="eyebrow">The Next Watch</p><h2>Technology should strengthen seamanship—not replace it.</h2><p>Use Neptune to make weather, risk, port readiness, fuel decisions, and emergency references easier to understand. Give the next generation a clearer operational picture while preserving the judgment, discipline, and responsibility of professional mariners.</p><div className="actions"><button className="btn gold" onClick={() => setActive("Weather & Ocean")}>Open weather intelligence</button><button className="btn" onClick={() => setActive("Port Intelligence")}>Review port readiness</button><button className="btn" onClick={() => setActive("MRCC Directory")}>Open emergency directory</button></div><p className="safety-note">Not an electronic chart, ECDIS, radar, AIS, GMDSS terminal, or official aid to navigation. Never use this visual for vessel navigation.</p></div></div>
      </section>}
    </section>
  );
}

function Metric({ icon, label, value, note }: { icon: string; label: string; value: string; note?: string }) {
  return <article className="intel-metric glass"><i>{icon}</i><div><span>{label}</span><b>{value}</b><small>{note || "—"}</small></div></article>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return <div className="intel-empty glass"><div className="icon">✦</div><h3>{title}</h3><p>{body}</p>{action}</div>;
}
