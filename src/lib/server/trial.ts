import { listResource, upsertSubscription } from "@/src/lib/server/db";

export const TRIAL_DAYS = 14;

export type Entitlement = {
  allowed: boolean;
  status: "trialing" | "active" | "expired" | "inactive";
  plan: string;
  expiresAt: string | null;
  daysRemaining: number;
  reason?: "TRIAL_EXPIRED" | "SUBSCRIPTION_REQUIRED";
};

function daysUntil(value: string | null) {
  if (!value) return 0;
  const remaining = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 86_400_000));
}

export async function startTrial(orgId: string) {
  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  await upsertSubscription({
    orgId,
    plan: "fleetops",
    status: "trialing",
    currentPeriodEnd: expiresAt
  });
  return {
    allowed: true,
    status: "trialing" as const,
    plan: "fleetops",
    expiresAt,
    daysRemaining: TRIAL_DAYS
  };
}

export async function getEntitlement(orgId: string): Promise<Entitlement> {
  const subscriptions = await listResource("subscriptions", orgId);
  const subscription = subscriptions[0];

  if (!subscription) {
    return {
      allowed: false,
      status: "inactive",
      plan: "fleetops",
      expiresAt: null,
      daysRemaining: 0,
      reason: "SUBSCRIPTION_REQUIRED"
    };
  }

  const rawStatus = String(subscription.status || "inactive").toLowerCase();
  const expiresAt = subscription.current_period_end ? String(subscription.current_period_end) : null;
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : Number.POSITIVE_INFINITY;
  const expired = Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();

  if (["trial", "trialing"].includes(rawStatus)) {
    if (expired || !expiresAt) {
      return {
        allowed: false,
        status: "expired",
        plan: String(subscription.plan || "fleetops"),
        expiresAt,
        daysRemaining: 0,
        reason: "TRIAL_EXPIRED"
      };
    }
    return {
      allowed: true,
      status: "trialing",
      plan: String(subscription.plan || "fleetops"),
      expiresAt,
      daysRemaining: daysUntil(expiresAt)
    };
  }

  if (rawStatus === "active") {
    if (expired) {
      return {
        allowed: false,
        status: "expired",
        plan: String(subscription.plan || "fleetops"),
        expiresAt,
        daysRemaining: 0,
        reason: "SUBSCRIPTION_REQUIRED"
      };
    }
    return {
      allowed: true,
      status: "active",
      plan: String(subscription.plan || "fleetops"),
      expiresAt,
      daysRemaining: expiresAt ? daysUntil(expiresAt) : 30
    };
  }

  return {
    allowed: false,
    status: "inactive",
    plan: String(subscription.plan || "fleetops"),
    expiresAt,
    daysRemaining: 0,
    reason: rawStatus === "canceled" ? "SUBSCRIPTION_REQUIRED" : "SUBSCRIPTION_REQUIRED"
  };
}
