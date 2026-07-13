import { listResource, upsertSubscription } from "@/src/lib/server/db";
import { normalizePlan, publicPlanAccess, type PlanKey } from "@/src/lib/plans";

export const TRIAL_DAYS = 14;

export type Entitlement = {
  allowed: boolean;
  status: "trialing" | "active" | "expired" | "inactive";
  plan: PlanKey;
  planName: string;
  expiresAt: string | null;
  daysRemaining: number;
  access: ReturnType<typeof publicPlanAccess>;
  reason?: "TRIAL_EXPIRED" | "SUBSCRIPTION_REQUIRED";
};

function daysUntil(value: string | null) {
  if (!value) return 0;
  const remaining = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 86_400_000));
}

function entitlementBase(planValue: unknown) {
  const plan = normalizePlan(planValue);
  const access = publicPlanAccess(plan);
  return { plan, planName: access.name, access };
}

export async function startTrial(orgId: string, selectedPlan: unknown = "captain") {
  const plan = normalizePlan(selectedPlan);
  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  await upsertSubscription({
    orgId,
    plan,
    status: "trialing",
    currentPeriodEnd: expiresAt
  });
  return {
    allowed: true,
    status: "trialing" as const,
    ...entitlementBase(plan),
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
      ...entitlementBase("captain"),
      expiresAt: null,
      daysRemaining: 0,
      reason: "SUBSCRIPTION_REQUIRED"
    };
  }

  const rawStatus = String(subscription.status || "inactive").toLowerCase();
  const base = entitlementBase(subscription.plan || "captain");
  const expiresAt = subscription.current_period_end ? String(subscription.current_period_end) : null;
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : Number.POSITIVE_INFINITY;
  const expired = Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();

  if (["trial", "trialing"].includes(rawStatus)) {
    if (expired || !expiresAt) {
      return {
        allowed: false,
        status: "expired",
        ...base,
        expiresAt,
        daysRemaining: 0,
        reason: "TRIAL_EXPIRED"
      };
    }
    return {
      allowed: true,
      status: "trialing",
      ...base,
      expiresAt,
      daysRemaining: daysUntil(expiresAt)
    };
  }

  if (rawStatus === "active") {
    if (expired) {
      return {
        allowed: false,
        status: "expired",
        ...base,
        expiresAt,
        daysRemaining: 0,
        reason: "SUBSCRIPTION_REQUIRED"
      };
    }
    return {
      allowed: true,
      status: "active",
      ...base,
      expiresAt,
      daysRemaining: expiresAt ? daysUntil(expiresAt) : 30
    };
  }

  return {
    allowed: false,
    status: "inactive",
    ...base,
    expiresAt,
    daysRemaining: 0,
    reason: "SUBSCRIPTION_REQUIRED"
  };
}
