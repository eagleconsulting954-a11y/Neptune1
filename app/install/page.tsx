import Link from "next/link";
import { InstallAppButton } from "@/components/InstallAppButton";
import { SiteHeader } from "@/components/SiteHeader";

const steps = [
  {
    platform: "Android",
    title: "Install from Chrome or Brave",
    steps: ["Open Neptune in the browser", "Tap Download app", "Confirm Install", "Open Neptune from the home screen"]
  },
  {
    platform: "iPhone & iPad",
    title: "Add Neptune to the Home Screen",
    steps: ["Open Neptune in Safari", "Tap the Share button", "Choose Add to Home Screen", "Confirm Add"]
  },
  {
    platform: "Desktop",
    title: "Install as a desktop app",
    steps: ["Open Neptune in Chrome or Edge", "Select Download app", "Confirm Install", "Launch Neptune from the app menu or desktop"]
  }
];

export default function InstallPage() {
  return (
    <div className="install-page">
      <SiteHeader />
      <main>
        <section className="install-hero">
          <div className="container install-hero-grid">
            <div>
              <p className="eyebrow">Neptune App</p>
              <h1>Install vessel command directly from the website.</h1>
              <p className="lede">Neptune can be installed on supported phones, tablets, and computers as a standalone app. It opens without the normal browser controls and keeps the vessel workflow one tap away.</p>
              <div className="hero-actions">
                <InstallAppButton className="btn gold install-primary" label="Download Neptune app" />
                <Link className="btn" href="/dashboard">Open web dashboard</Link>
              </div>
              <div className="install-trust">
                <span>No app-store account required</span>
                <span>Uses the same secure Neptune login</span>
                <span>Updates automatically from the website</span>
              </div>
            </div>

            <div className="install-device glass premium" aria-label="Neptune installed app preview">
              <div className="install-device-top"><span /><span /><span /></div>
              <div className="install-app-icon"><img src="/neptune-app-icon.svg" alt="Neptune app icon" /></div>
              <p className="eyebrow">Installed vessel workspace</p>
              <h2>Neptune</h2>
              <p>Command, fleet operations, CRM, maritime intelligence, EV risk projects, and organization records in a standalone app window.</p>
              <div className="install-device-actions"><span>Secure login</span><span>Offline support</span><span>Automatic updates</span></div>
            </div>
          </div>
        </section>

        <section className="section install-steps-section">
          <div className="container">
            <div className="section-head"><div><p className="eyebrow">Installation instructions</p><h2>Choose your device.</h2></div><p>The install button opens the native installation prompt when the browser supports it. Apple devices use Safari’s Add to Home Screen option.</p></div>
            <div className="install-step-grid">
              {steps.map(item => <article className="card install-step-card" key={item.platform}><span>{item.platform}</span><h3>{item.title}</h3><ol>{item.steps.map(step => <li key={step}>{step}</li>)}</ol></article>)}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container install-note glass">
            <div><p className="eyebrow">Current app format</p><h2>Installable web app now. App stores can come next.</h2><p>The website version is configured as a Progressive Web App, so customers can install it immediately from Neptune’s website. A separately packaged Apple App Store or Google Play release would require store accounts, review, signing, and native packaging.</p></div>
            <InstallAppButton className="btn gold" label="Install Neptune" />
          </div>
        </section>
      </main>
    </div>
  );
}
