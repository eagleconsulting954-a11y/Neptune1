"use client";

import { useEffect, useState } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

type InstallAppButtonProps = {
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

export function InstallAppButton({ className = "btn", label = "Install Neptune App", installedLabel = "Open Neptune App" }: InstallAppButtonProps) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setInstalled(isStandalone());

    function capturePrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setStatus("");
    }

    function markInstalled() {
      setInstalled(true);
      setPromptEvent(null);
      setInstructionsOpen(false);
      setStatus("Neptune was installed on this device.");
    }

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function install() {
    if (installed || isStandalone()) {
      window.location.href = "/dashboard";
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
      setStatus("Installation was dismissed. Neptune can be installed later from this button.");
    }
  }

  return (
    <>
      <button type="button" className={`${className} neptune-install-button`} onClick={install} aria-haspopup={installed ? undefined : "dialog"}>
        <span aria-hidden="true">{installed ? "↗" : "⇩"}</span>{installed ? installedLabel : label}
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
              <li>Tap <b>Add</b>, then open Neptune once while connected before sailing.</li>
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
