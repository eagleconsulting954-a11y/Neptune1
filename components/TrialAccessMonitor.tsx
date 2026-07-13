"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Entitlement = {
  status: "trialing" | "active";
  expiresAt: string | null;
  daysRemaining: number;
};

function remainingLabel(expiresAt: string | null, fallbackDays: number) {
  if (!expiresAt) return `${fallbackDays} days remaining`;
  const milliseconds = new Date(expiresAt).getTime() - Date.now();
  if (milliseconds <= 0) return "Trial ended";
  const totalHours = Math.ceil(milliseconds / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"} remaining`;
  return `${hours} hour${hours === 1 ? "" : "s"} remaining`;
}

export function TrialAccessMonitor() {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const response = await fetch("/api/v1/dashboard", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (response.status === 402) {
        window.location.href = "/trial-expired";
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      if (cancelled) return;
      setEntitlement(data.entitlement || null);
      if (data.entitlement?.status === "trialing") {
        setLabel(remainingLabel(data.entitlement.expiresAt, data.entitlement.daysRemaining || 0));
      }
    }

    void checkAccess();
    const accessTimer = window.setInterval(checkAccess, 60_000);
    const countdownTimer = window.setInterval(() => {
      setEntitlement(current => {
        if (current?.status === "trialing") setLabel(remainingLabel(current.expiresAt, current.daysRemaining));
        return current;
      });
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(accessTimer);
      window.clearInterval(countdownTimer);
    };
  }, []);

  if (!entitlement || entitlement.status !== "trialing") return null;

  return (
    <div className="trial-access-monitor">
      <div><b>14-day trial active</b><span>{label}</span></div>
      <Link className="btn gold" href="/checkout">Choose a plan</Link>
    </div>
  );
}
