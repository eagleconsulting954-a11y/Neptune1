"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Vessel = { id: string; name: string; imo?: string | null };
type EmergencyEventRecord = {
  id: string;
  vessel_id?: string | null;
  title: string;
  status: string;
  source_device_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  point_count?: number;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_accuracy_m?: number | null;
  last_fix_at?: string | null;
};
type GpsPoint = {
  id: string;
  event_id: string;
  sequence_no: number;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  altitude_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  recorded_at: string;
  sync_state?: "pending" | "queued" | "synced";
};
type OfflineResult = { ok: boolean; queued?: boolean; status?: number; pending?: number; processed?: number; synced?: number };
type EmergencyOfflineApi = {
  startEvent: (event: EmergencyEventRecord) => Promise<OfflineResult>;
  updateEvent: (event: Partial<EmergencyEventRecord> & { id: string }) => Promise<OfflineResult>;
  appendPosition: (position: GpsPoint) => Promise<OfflineResult>;
  flushPending: (eventId: string) => Promise<OfflineResult>;
  flush: () => Promise<OfflineResult>;
  load: () => Promise<{ activeEvent: EmergencyEventRecord | null; positions: GpsPoint[]; pending: number }>;
  pending: () => Promise<number>;
};
type WakeLockLike = { release: () => Promise<void>; addEventListener?: (type: string, listener: () => void) => void };

type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> } };
type WindowWithEmergency = Window & { NeptuneEmergencyOffline?: EmergencyOfflineApi };

const SAMPLE_INTERVAL_MS = 15_000;
const MOVEMENT_SAMPLE_METERS = 50;
const STALE_FIX_MS = 60_000;

function emergencyApi() {
  return (window as WindowWithEmergency).NeptuneEmergencyOffline;
}

function uniqueId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${random}`;
}

function deviceId() {
  const key = "neptune-vessel-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = uniqueId("device");
  window.localStorage.setItem(key, created);
  return created;
}

function radians(value: number) {
  return value * Math.PI / 180;
}

function distanceMeters(a: Pick<GpsPoint, "latitude" | "longitude">, b: Pick<GpsPoint, "latitude" | "longitude">) {
  const earth = 6_371_000;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function bearingDegrees(a: Pick<GpsPoint, "latitude" | "longitude">, b: Pick<GpsPoint, "latitude" | "longitude">) {
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function formatCoordinate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(6) : "—";
}

function formatAge(milliseconds: number) {
  if (milliseconds < 1_000) return "now";
  if (milliseconds < 60_000) return `${Math.floor(milliseconds / 1_000)} sec`;
  return `${Math.floor(milliseconds / 60_000)} min`;
}

function messageForPositionError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "Location permission was denied. Enable precise location for Neptune in the device settings.";
  if (error.code === error.POSITION_UNAVAILABLE) return "The device cannot obtain a GPS fix. Confirm that the vessel device has GNSS/GPS hardware and an unobstructed sky view.";
  if (error.code === error.TIMEOUT) return "The GPS request timed out. Keep Neptune open and retry with the device near a clear sky view.";
  return "Unable to obtain the device position.";
}

export function EmergencyGpsTracker() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState("");
  const [activeEvent, setActiveEvent] = useState<EmergencyEventRecord | null>(null);
  const [recentEvents, setRecentEvents] = useState<EmergencyEventRecord[]>([]);
  const [tracking, setTracking] = useState(false);
  const [current, setCurrent] = useState<GpsPoint | null>(null);
  const [trail, setTrail] = useState<GpsPoint[]>([]);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [requesting, setRequesting] = useState(false);

  const activeRef = useRef<EmergencyEventRecord | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockLike | null>(null);
  const lastSavedRef = useRef<GpsPoint | null>(null);
  const sequenceRef = useRef(0);
  const trailRef = useRef<GpsPoint[]>([]);

  useEffect(() => { activeRef.current = activeEvent; }, [activeEvent]);
  useEffect(() => { trailRef.current = trail; }, [trail]);

  async function refreshPending() {
    const api = emergencyApi();
    if (api) setPending(await api.pending().catch(() => 0));
  }

  async function loadServerRecords() {
    try {
      const [vesselResponse, eventResponse] = await Promise.all([
        fetch("/api/v1/vessels", { cache: "no-store" }),
        fetch("/api/v1/emergency-events?limit=8", { cache: "no-store" })
      ]);
      if (vesselResponse.ok) {
        const payload = await vesselResponse.json();
        const list = Array.isArray(payload.items) ? payload.items : [];
        setVessels(list);
        setSelectedVessel(value => value || list[0]?.id || "");
      }
      if (eventResponse.ok) {
        const payload = await eventResponse.json();
        setRecentEvents(Array.isArray(payload.items) ? payload.items : []);
      }
    } catch {}
  }

  async function hydrateLocalEmergency() {
    const api = emergencyApi();
    if (!api) return;
    const saved = await api.load().catch(() => null);
    if (!saved) return;
    setActiveEvent(saved.activeEvent);
    activeRef.current = saved.activeEvent;
    const positions = Array.isArray(saved.positions) ? saved.positions : [];
    setTrail(positions);
    trailRef.current = positions;
    const latest = positions.at(-1) || null;
    setCurrent(latest);
    lastSavedRef.current = latest;
    sequenceRef.current = positions.reduce((maximum, point) => Math.max(maximum, Number(point.sequence_no) || 0), 0);
    setPending(saved.pending || 0);
    if (saved.activeEvent) {
      setSelectedVessel(saved.activeEvent.vessel_id || "");
      setMessage("An active emergency session was recovered from this device. Tap Resume GPS to continue recording positions.");
    }
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    void loadServerRecords();
    if (emergencyApi()) void hydrateLocalEmergency();

    const ready = () => void hydrateLocalEmergency();
    const network = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void refreshPending();
    };
    const status = (event: Event) => {
      const detail = (event as CustomEvent<{ pending?: number; message?: string }>).detail;
      if (typeof detail?.pending === "number") setPending(detail.pending);
      if (detail?.message) setMessage(detail.message);
    };
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    const flushTimer = window.setInterval(() => {
      const event = activeRef.current;
      const api = emergencyApi();
      if (event?.id && api) void api.flushPending(event.id).then(refreshPending);
    }, 30_000);

    window.addEventListener("neptune-emergency-offline-ready", ready);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("neptune-emergency-offline-status", status);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(flushTimer);
      window.removeEventListener("neptune-emergency-offline-ready", ready);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("neptune-emergency-offline-status", status);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      void wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  async function requestWakeLock() {
    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!wakeLock || document.visibilityState !== "visible") return;
    try {
      wakeLockRef.current = await wakeLock.request("screen");
      wakeLockRef.current.addEventListener?.("release", () => { wakeLockRef.current = null; });
    } catch {}
  }

  async function persistPoint(base: Omit<GpsPoint, "id" | "event_id" | "sequence_no">, force = false) {
    const event = activeRef.current;
    const api = emergencyApi();
    if (!event || !api) return;
    const previous = lastSavedRef.current;
    const elapsed = previous ? new Date(base.recorded_at).getTime() - new Date(previous.recorded_at).getTime() : Infinity;
    const moved = previous ? distanceMeters(previous, base) : Infinity;
    if (!force && previous && elapsed < SAMPLE_INTERVAL_MS && moved < MOVEMENT_SAMPLE_METERS) return;

    const point: GpsPoint = {
      ...base,
      id: uniqueId("gps"),
      event_id: event.id,
      sequence_no: sequenceRef.current + 1
    };
    sequenceRef.current = point.sequence_no;
    lastSavedRef.current = point;
    const nextTrail = [...trailRef.current, point].slice(-2_000);
    trailRef.current = nextTrail;
    setTrail(nextTrail);
    await api.appendPosition(point);
    await refreshPending();
  }

  function positionFromBrowser(position: GeolocationPosition) {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_m: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      altitude_m: position.coords.altitude !== null && Number.isFinite(position.coords.altitude) ? position.coords.altitude : null,
      speed_mps: position.coords.speed !== null && Number.isFinite(position.coords.speed) ? position.coords.speed : null,
      heading_deg: position.coords.heading !== null && Number.isFinite(position.coords.heading) ? position.coords.heading : null,
      recorded_at: new Date(position.timestamp || Date.now()).toISOString()
    };
  }

  function handlePosition(position: GeolocationPosition) {
    const base = positionFromBrowser(position);
    const currentPoint: GpsPoint = {
      ...base,
      id: "current",
      event_id: activeRef.current?.id || "",
      sequence_no: sequenceRef.current
    };
    setCurrent(currentPoint);
    setNow(Date.now());
    void persistPoint(base);
  }

  function beginWatch() {
    if (!navigator.geolocation) {
      setMessage("This browser does not expose device geolocation.");
      return;
    }
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      error => setMessage(messageForPositionError(error)),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
    setTracking(true);
    setMessage(navigator.onLine ? "Emergency GPS tracking is active." : "Emergency GPS tracking is active offline. Positions are stored on this device and have not been transmitted.");
    void requestWakeLock();
  }

  function firstFix() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 });
    });
  }

  async function startTracking() {
    const api = emergencyApi();
    if (!api) {
      setMessage("The emergency offline service is still loading. Retry in a moment.");
      return;
    }
    if (!navigator.geolocation) {
      setMessage("This device does not provide browser geolocation.");
      return;
    }
    setRequesting(true);
    setMessage("Requesting a precise GPS fix from this device...");
    try {
      const initial = await firstFix();
      const event: EmergencyEventRecord = {
        id: uniqueId("emg"),
        vessel_id: selectedVessel || null,
        title: "Emergency GPS tracking",
        status: "Active",
        source_device_id: deviceId(),
        started_at: new Date().toISOString()
      };
      await api.startEvent(event);
      setActiveEvent(event);
      activeRef.current = event;
      setTrail([]);
      trailRef.current = [];
      lastSavedRef.current = null;
      sequenceRef.current = 0;
      const base = positionFromBrowser(initial);
      setCurrent({ ...base, id: "current", event_id: event.id, sequence_no: 0 });
      await persistPoint(base, true);
      beginWatch();
      await refreshPending();
    } catch (error) {
      setMessage(error && typeof error === "object" && "code" in error ? messageForPositionError(error as GeolocationPositionError) : "Unable to start emergency GPS tracking.");
    } finally {
      setRequesting(false);
    }
  }

  function resumeTracking() {
    if (!activeRef.current) return;
    beginWatch();
  }

  async function stopTracking() {
    const event = activeRef.current;
    const api = emergencyApi();
    if (!event || !api) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
    await wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    await api.flushPending(event.id);
    const endedAt = new Date().toISOString();
    const result = await api.updateEvent({ id: event.id, status: "Stopped", ended_at: endedAt });
    setActiveEvent(null);
    activeRef.current = null;
    setMessage(result.queued ? "Emergency tracking stopped. The final GPS package is stored locally and will synchronize when connectivity returns." : "Emergency tracking stopped and the final GPS package was synchronized.");
    await refreshPending();
    void loadServerRecords();
  }

  async function markCurrentPosition() {
    if (!current || !activeRef.current) return;
    await persistPoint({
      latitude: current.latitude,
      longitude: current.longitude,
      accuracy_m: current.accuracy_m,
      altitude_m: current.altitude_m,
      speed_mps: current.speed_mps,
      heading_deg: current.heading_deg,
      recorded_at: new Date().toISOString()
    }, true);
    setMessage("Current position marked in the emergency trail.");
  }

  async function copyCoordinates() {
    if (!current) return;
    const text = `${current.latitude.toFixed(6)}, ${current.longitude.toFixed(6)} · accuracy ${Math.round(current.accuracy_m || 0)} m · ${current.recorded_at}`;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Coordinates copied to the device clipboard.");
    } catch {
      setMessage(text);
    }
  }

  async function syncNow() {
    const api = emergencyApi();
    if (!api) return;
    const event = activeRef.current;
    if (event?.id) await api.flushPending(event.id);
    const result = await api.flush();
    await refreshPending();
    setMessage(result.pending ? `${result.pending} emergency GPS item${result.pending === 1 ? " remains" : "s remain"} on this device.` : "Emergency GPS records are synchronized.");
    void loadServerRecords();
  }

  const startPoint = trail[0] || null;
  const distanceFromStart = startPoint && current ? distanceMeters(startPoint, current) : 0;
  const bearingFromStart = startPoint && current && distanceFromStart > 1 ? bearingDegrees(startPoint, current) : null;
  const fixAge = current ? Math.max(0, now - new Date(current.recorded_at).getTime()) : Infinity;
  const inferredSpeed = trail.length > 1
    ? distanceMeters(trail[trail.length - 2], trail[trail.length - 1]) / Math.max(1, (new Date(trail[trail.length - 1].recorded_at).getTime() - new Date(trail[trail.length - 2].recorded_at).getTime()) / 1_000)
    : 0;
  const anomalies = [
    fixAge > STALE_FIX_MS ? "No fresh GPS fix for more than 60 seconds." : "",
    (current?.accuracy_m || 0) > 1_000 ? "Position accuracy is worse than 1,000 meters." : "",
    inferredSpeed > 100 ? "Possible impossible position jump or spoofing anomaly." : ""
  ].filter(Boolean);

  const plot = useMemo(() => {
    if (!trail.length) return { points: "", first: null as null | { x: number; y: number }, last: null as null | { x: number; y: number } };
    const width = 680;
    const height = 260;
    const padding = 22;
    const latitudes = trail.map(point => point.latitude);
    const longitudes = trail.map(point => point.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const latSpan = Math.max(maxLat - minLat, 0.00001);
    const lonSpan = Math.max(maxLon - minLon, 0.00001);
    const mapped = trail.map(point => ({
      x: padding + ((point.longitude - minLon) / lonSpan) * (width - padding * 2),
      y: height - padding - ((point.latitude - minLat) / latSpan) * (height - padding * 2)
    }));
    return {
      points: mapped.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
      first: mapped[0],
      last: mapped[mapped.length - 1]
    };
  }, [trail]);

  return <section className="gps-emergency-panel">
    <div className="gps-emergency-head">
      <div>
        <p className="eyebrow">Offline Emergency GPS Recorder</p>
        <h2>Device position, breadcrumb trail, and reconnect synchronization</h2>
        <p>Records precise device coordinates while Neptune remains open. Offline positions stay on this vessel device until a network connection successfully synchronizes them.</p>
      </div>
      <div className={`gps-live-status ${tracking ? "active" : ""} ${online ? "online" : "offline"}`}><i />{tracking ? "GPS TRACKING" : "GPS STANDBY"} · {online ? "CONNECTED" : "OFFLINE"}</div>
    </div>

    <div className={`gps-transmission-banner ${online ? "connected" : "offline"}`}>
      <b>{online ? "Connection available" : "Stored on this device — not transmitted"}</b>
      <span>{online ? "New GPS samples are sent to Neptune when the protected API accepts them." : "Use GMDSS, VHF/DSC, EPIRB, satellite communications, and company distress procedures for actual emergency transmission."}</span>
    </div>

    <div className="gps-control-bar">
      <label><span>Vessel</span><select value={selectedVessel} onChange={event => setSelectedVessel(event.target.value)} disabled={Boolean(activeEvent)}><option value="">Unassigned device</option>{vessels.map(vessel => <option key={vessel.id} value={vessel.id}>{vessel.name}{vessel.imo ? ` · IMO ${vessel.imo}` : ""}</option>)}</select></label>
      {!activeEvent && <button className="btn danger gps-start" onClick={startTracking} disabled={requesting}>{requesting ? "Acquiring GPS..." : "Start Emergency GPS"}</button>}
      {activeEvent && !tracking && <button className="btn gold" onClick={resumeTracking}>Resume GPS</button>}
      {activeEvent && <button className="btn danger-outline" onClick={stopTracking}>Stop tracking</button>}
      <button className="btn" onClick={markCurrentPosition} disabled={!current || !activeEvent}>Mark position</button>
      <button className="btn" onClick={copyCoordinates} disabled={!current}>Copy coordinates</button>
      <button className="btn" onClick={syncNow} disabled={!online || pending === 0}>Sync now</button>
    </div>

    {message && <div className="gps-message" role="status">{message}</div>}

    <div className="gps-metric-grid">
      <article><span>Latitude</span><b>{formatCoordinate(current?.latitude)}</b><small>WGS 84 device fix</small></article>
      <article><span>Longitude</span><b>{formatCoordinate(current?.longitude)}</b><small>WGS 84 device fix</small></article>
      <article className={fixAge > STALE_FIX_MS ? "warning" : ""}><span>Fix age</span><b>{current ? formatAge(fixAge) : "—"}</b><small>{current ? new Date(current.recorded_at).toLocaleTimeString() : "No position"}</small></article>
      <article className={(current?.accuracy_m || 0) > 1_000 ? "warning" : ""}><span>Accuracy</span><b>{current?.accuracy_m !== null && current?.accuracy_m !== undefined ? `${Math.round(current.accuracy_m)} m` : "—"}</b><small>Lower is better</small></article>
      <article><span>Speed</span><b>{current?.speed_mps !== null && current?.speed_mps !== undefined ? `${(current.speed_mps * 1.94384).toFixed(1)} kn` : "—"}</b><small>Device-reported</small></article>
      <article><span>Heading</span><b>{current?.heading_deg !== null && current?.heading_deg !== undefined ? `${Math.round(current.heading_deg)}°` : "—"}</b><small>Device-reported</small></article>
      <article><span>From start</span><b>{distanceFromStart >= 1_852 ? `${(distanceFromStart / 1_852).toFixed(2)} nm` : `${Math.round(distanceFromStart)} m`}</b><small>{bearingFromStart === null ? "Awaiting movement" : `Bearing ${Math.round(bearingFromStart)}°`}</small></article>
      <article className={pending ? "warning" : ""}><span>Device queue</span><b>{pending}</b><small>{pending ? "Awaiting sync" : "Synchronized"}</small></article>
    </div>

    <div className="gps-workspace-grid">
      <article className="gps-trail-card">
        <div className="gps-card-head"><div><p className="eyebrow">Local breadcrumb plot</p><h3>{trail.length} recorded position{trail.length === 1 ? "" : "s"}</h3></div><span>Not a navigational chart</span></div>
        <div className="gps-plot" aria-label="Emergency GPS breadcrumb trail">
          <svg viewBox="0 0 680 260" role="img">
            <defs><pattern id="gps-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.7" /></pattern></defs>
            <rect width="680" height="260" fill="url(#gps-grid)" />
            {plot.points && <polyline points={plot.points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
            {plot.first && <circle cx={plot.first.x} cy={plot.first.y} r="6" className="gps-start-dot" />}
            {plot.last && <circle cx={plot.last.x} cy={plot.last.y} r="8" className="gps-current-dot" />}
          </svg>
          {!trail.length && <div className="gps-empty">Start emergency tracking to create a device-local trail.</div>}
        </div>
      </article>

      <article className="gps-event-card">
        <p className="eyebrow">Emergency session</p>
        <h3>{activeEvent ? "Active device record" : "No active emergency"}</h3>
        {activeEvent ? <dl><div><dt>Event ID</dt><dd>{activeEvent.id}</dd></div><div><dt>Started</dt><dd>{new Date(activeEvent.started_at).toLocaleString()}</dd></div><div><dt>Vessel</dt><dd>{vessels.find(vessel => vessel.id === activeEvent.vessel_id)?.name || "Unassigned"}</dd></div><div><dt>Device</dt><dd>{activeEvent.source_device_id || "Current device"}</dd></div></dl> : <p>Starting tracking creates an emergency event before the first position is stored. The event and GPS trail remain organization-isolated.</p>}
        {anomalies.length > 0 && <div className="gps-anomaly"><b>Position warning</b>{anomalies.map(item => <span key={item}>{item}</span>)}</div>}
        <div className="gps-foreground-warning"><b>Keep Neptune open.</b><span>Browser GPS may pause when the screen locks, the operating system suspends the app, or battery-saving restrictions activate.</span></div>
      </article>
    </div>

    {recentEvents.length > 0 && <div className="gps-recent-events"><div className="gps-card-head"><div><p className="eyebrow">Organization emergency history</p><h3>Recent GPS sessions</h3></div></div><div className="gps-recent-grid">{recentEvents.map(event => <article key={event.id}><span className={event.status === "Active" ? "active" : ""}>{event.status}</span><b>{vessels.find(vessel => vessel.id === event.vessel_id)?.name || "Unassigned vessel"}</b><small>{new Date(event.started_at).toLocaleString()} · {event.point_count || 0} points</small>{event.last_latitude !== null && event.last_latitude !== undefined && <code>{Number(event.last_latitude).toFixed(5)}, {Number(event.last_longitude).toFixed(5)}</code>}</article>)}</div></div>}

    <div className="gps-safety-boundary"><b>Emergency safety boundary</b><span>Neptune records and synchronizes operational evidence. It does not transmit a maritime distress alert, replace GMDSS, VHF Channel 16, DSC, EPIRB, SART, PLB, LRIT, AIS, ECDIS, NAVTEX, SafetyNET, VTS instructions, or approved company emergency procedures.</span></div>
  </section>;
}
