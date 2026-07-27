import Link from "next/link";
import { InstallAppButton } from "@/components/InstallAppButton";
import { SiteHeader } from "@/components/SiteHeader";

const platforms = [
  ["Android", "Chrome or Edge", "Tap Install Neptune App. If no prompt appears, open the browser menu and select Install app or Add to Home screen."],
  ["iPhone / iPad", "Safari", "Open this page in Safari, tap Share, choose Add to Home Screen, and confirm Add."],
  ["Windows", "Chrome or Edge", "Use the install button or the install icon in the browser address bar. Neptune opens in its own application window."],
  ["macOS", "Safari, Chrome, or Edge", "Use Add to Dock in Safari or Install Neptune in Chrome or Edge."],
];

export default function InstallPage() {
  return (
    <div className="install-page">
      <SiteHeader />
      <main>
        <section className="install-hero">
          <div className="container install-hero-grid">
            <div className="install-copy">
              <p className="eyebrow">Installable vessel application</p>
              <h1>Put Neptune on the vessel device before leaving coverage.</h1>
              <p className="lede">Install Neptune directly from this website. It opens like a dedicated app, keeps the last synchronized vessel workspace available offline, stores supported operational changes on the device, and synchronizes them when connectivity returns.</p>
              <div className="install-actions">
                <div><InstallAppButton className="btn gold" label="Install Neptune App" /></div>
                <Link className="btn" href="/login">Sign in before departure</Link>
                <Link className="btn" href="/dashboard">Open vessel dashboard</Link>
              </div>
            </div>

            <div className="install-device-card glass premium" aria-label="Neptune installed application preview">
              <div className="install-device-shell">
                <div className="install-device-screen">
                  <div className="install-device-head">
                    <div className="install-device-brand"><i>✦</i><span>NEPTUNE</span></div>
                    <span className="install-device-status">OFFLINE READY</span>
                  </div>
                  <div className="install-device-content">
                    <article><span>Ocean mode</span><b>Last synchronized vessel workspace</b><small>Previously loaded operations remain available when the connection drops.</small></article>
                    <article><span>Local queue</span><b>Create and update records offshore</b><small>Supported changes wait on the vessel device until connectivity returns.</small></article>
                    <article><span>Automatic sync</span><b>Reconnect without duplicate entry</b><small>Queued records synchronize in order and receive permanent server IDs.</small></article>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="install-section">
          <div className="container">
            <div className="install-section-head"><div><p className="eyebrow">Device instructions</p><h2>Install from the browser already used onboard.</h2></div><p>No separate download file or app-store account is required for the web app. The operating system creates an application icon and standalone Neptune window from the secured website.</p></div>
            <div className="install-platform-grid">
              {platforms.map(([name, browser, instructions]) => <article className="install-platform-card" key={name}><span>⇩</span><h3>{name}</h3><p><b>{browser}</b><br />{instructions}</p></article>)}
            </div>
          </div>
        </section>

        <section className="install-section">
          <div className="container">
            <div className="install-section-head"><div><p className="eyebrow">Before sailing</p><h2>Complete the first synchronization while connected.</h2></div><p>Offline use is device-specific. Each company-controlled vessel tablet or computer must complete these steps before satellite, cellular, or port connectivity is unavailable.</p></div>
            <div className="install-checklist">
              <article><strong>Step 01</strong><h3>Install and sign in</h3><p>Install Neptune, open the installed app, and sign in with the vessel’s authorized organization account.</p></article>
              <article><strong>Step 02</strong><h3>Open required modules</h3><p>Load the dashboard, vessel records, duties, maintenance, certificates, incidents, safety workspace, and any voyage information needed offshore.</p></article>
              <article><strong>Step 03</strong><h3>Test offline mode</h3><p>Temporarily disable Wi-Fi or use the browser’s offline test, reopen Neptune, create a non-critical test record, then reconnect and confirm synchronization.</p></article>
            </div>
          </div>
        </section>

        <section className="install-section">
          <div className="container install-warning">
            <p className="eyebrow">Operational limitation</p>
            <h2>Offline Neptune is an operational record system, not navigation equipment.</h2>
            <p><b>Live weather, wave, congestion, external bunker pricing, authority updates, subscription verification, login, password recovery, and billing require connectivity.</b> Last-known information must not replace official bridge systems, ECDIS, GMDSS, NAVTEX, SafetyNET, VTS instructions, charts, or required maritime procedures.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
