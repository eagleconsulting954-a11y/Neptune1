"use client";

import { useEffect } from "react";

function sendError(payload: Record<string, unknown>) {
  const body = JSON.stringify({
    route: window.location.pathname,
    metadata: { href: window.location.href, viewport: `${window.innerWidth}x${window.innerHeight}` },
    ...payload
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/system/errors", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/system/errors", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  } catch {
    // Error reporting must never interrupt the application.
  }
}

export function GlobalErrorReporter() {
  useEffect(() => {
    const seen = new Map<string, number>();
    const originalFetch = window.fetch.bind(window);

    function reportOnce(payload: Record<string, unknown>) {
      const key = [payload.message, payload.route, payload.statusCode].join("|");
      const last = seen.get(key) || 0;
      if (Date.now() - last < 60_000) return;
      seen.set(key, Date.now());
      sendError(payload);
    }

    function onError(event: ErrorEvent) {
      reportOnce({
        source: "client",
        severity: "error",
        message: event.message || "Unhandled browser error",
        stack: event.error?.stack || null,
        metadata: { filename: event.filename, line: event.lineno, column: event.colno }
      });
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      reportOnce({
        source: "client",
        severity: "error",
        message: reason instanceof Error ? reason.message : String(reason || "Unhandled promise rejection"),
        stack: reason instanceof Error ? reason.stack : null
      });
    }

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      try {
        const response = await originalFetch(...args);
        const target = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].toString() : args[0].url;
        if (response.status >= 500 && !target.includes("/api/system/errors")) {
          reportOnce({
            source: "client",
            severity: response.status >= 503 ? "critical" : "error",
            message: `API request failed with ${response.status}`,
            route: target,
            method: String(args[1]?.method || "GET").toUpperCase(),
            statusCode: response.status
          });
        }
        return response;
      } catch (error) {
        const target = typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].toString() : args[0].url;
        if (!target.includes("/api/system/errors")) {
          reportOnce({
            source: "client",
            severity: "critical",
            message: error instanceof Error ? error.message : "Network request failed",
            stack: error instanceof Error ? error.stack : null,
            route: target,
            method: String(args[1]?.method || "GET").toUpperCase()
          });
        }
        throw error;
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
