"use client";

import { useEffect, useState } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

type InstallNeptuneButtonProps = {
  className?: string;
  label?: string;
  installedLabel?: string;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as NavigatorWithStandalone).standalone);
}

function isAppleMobile() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function InstallNeptuneButton({ className = "btn", label = "Install Neptune App", installedLabel = "Neptune Installed" }: InstallNeptuneButtonProps) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setInstalled(isStandalone());

    function ready(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setStatus("");
    }

    function complete() {
      setInstalled(true);
      setPromptEvent(null);
      setInstructionsOpen(false);
      setStatus("Neptune was installed on this device.");
    }

    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  async function install() {
    if (installed || isStandalone()) {
      setInstalled(true);
      setStatus("Neptune is already installed on this device.");
      return;
    }

    if (!promptEvent) {
      setInstructionsOpen(true);
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === "accepted") {
      setStatus("Finishing the Neptune installation...");
    } else {
      setStatus("Installation was dismissed. You can install Neptune later from this button.");
    }
  }

  return (
    <>
      <button type="button" className={`${className} neptune-install-button`} onClick={install} aria-haspopup="dialog" disabled={installed}>
        <span aria-hidden="true">⇩</span>{installed ? installedLabel : label}
      </button>
      {status && <span className="neptune-install-status" role="status">{status}</span>}
      {instructionsOpen && <div className="install-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setInstructionsOpen(false); }}>
        <section className="install-modal glass premium" role="dialog" aria-modal="true" aria-labelledby="install-neptune-title">
          <div className="install-modal-head">
            <div><p className="eyebrow">Install from this website</p><h2 id="install-neptune-title">Add Neptune to this device.</h2></div>
            <button type="button" className="install-modal-close" onClick={() => setInstructionsOpen(false)} aria-label="Close installation instructions">×</button>
          </div>
          {isAppleMobile() ? <div className="install-instructions">
            <p>On iPhone or iPad, use Safari to install Neptune:</p>
            <ol>
              <li>Tap the <b>Share</b> button in Safari.</li>
              <li>Select <b>Add to Home Screen</b>.</li>
              <li>Tap <b>Add</b>. Open Neptune once while connected before the vessel leaves coverage.</li>
            </ol>
          </div> : <div className="install-instructions">
            <p>Your browser did not provide the automatic installer. Use its application menu:</p>
            <ol>
              <li>Open the browser menu.</li>
              <li>Select <b>Install Neptune</b>, <b>Install app</b>, or <b>Add to Home screen</b>.</li>
              <li>Confirm the installation and open Neptune once while connected.</li>
            </ol>
          </div>}
          <div className="install-modal-actions"><button type="button" className="btn gold" onClick={() => setInstructionsOpen(false)}>Done</button><a className="btn" href="/install">Full installation guide</a></div>
        </section>
      </div>}
    </>
  );
}
