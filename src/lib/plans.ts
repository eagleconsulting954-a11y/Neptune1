export type PlanKey = "captain" | "fleetops" | "full_vessel_access" | "enterprise";

export type ModuleKey =
  | "command"
  | "vessels"
  | "maritime_intel"
  | "delegation"
  | "maintenance"
  | "certificates"
  | "incidents"
  | "crm"
  | "analytics"
  | "ev_projects"
  | "seafarer_safety"
  | "activity"
  | "billing"
  | "settings";

export type ResourceKey =
  | "vessels"
  | "duties"
  | "work_orders"
  | "certificates"
  | "incidents"
  | "crm_accounts"
  | "activity_events"
  | "subscriptions"
  | "ports"
  | "bunker_plans"
  | "mrcc_contacts"
  | "port_congestion_snapshots";

export type PlanDefinition = {
  key: PlanKey;
  slug: string;
  name: string;
  shortName: string;
  price: number | null;
  priceLabel: string;
  stripePriceEnv: string;
  note: string;
  description: string;
  modules: ModuleKey[];
  resources: ResourceKey[];
  features: string[];
  excluded: string[];
  limits: {
    vessels: number | null;
    administrators: number | null;
  };
};

const CAPTAIN_MODULES: ModuleKey[] = [
  "command",
  "vessels",
  "maritime_intel",
  "delegation",
  "certificates",
  "activity",
  "billing",
  "settings"
];

const FLEETOPS_MODULES: ModuleKey[] = [
  "command",
  "vessels",
  "maintenance",
  "incidents",
  "crm",
  "analytics",
  "activity",
  "billing",
  "settings"
];

const CAPTAIN_RESOURCES: ResourceKey[] = [
  "vessels",
  "duties",
  "certificates",
  "activity_events",
  "subscriptions",
  "ports",
  "bunker_plans",
  "mrcc_contacts",
  "port_congestion_snapshots"
];

const FLEETOPS_RESOURCES: ResourceKey[] = [
  "vessels",
  "work_orders",
  "incidents",
  "crm_accounts",
  "activity_events",
  "subscriptions"
];

const FULL_MODULES = Array.from(new Set([...CAPTAIN_MODULES, ...FLEETOPS_MODULES, "ev_projects" as ModuleKey, "seafarer_safety" as ModuleKey])) as ModuleKey[];
const FULL_RESOURCES = Array.from(new Set([...CAPTAIN_RESOURCES, ...FLEETOPS_RESOURCES])) as ResourceKey[];

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  captain: {
    key: "captain",
    slug: "captain",
    name: "Captain",
    shortName: "Captain",
    price: 49900,
    priceLabel: "$499",
    stripePriceEnv: "STRIPE_PRICE_CAPTAIN",
    note: "One-vessel onboard command",
    description: "For a captain and shipboard team operating one vessel with command, compliance, delegation, and voyage intelligence tools.",
    modules: CAPTAIN_MODULES,
    resources: CAPTAIN_RESOURCES,
    features: [
      "Captain command dashboard",
      "One vessel profile",
      "Weather and ocean forecasts",
      "Port intelligence and congestion",
      "Bunkering voyage planner",
      "Verified MRCC contact directory",
      "Hot-work and inspection delegation",
      "Certificate tracking",
      "Operational activity log",
      "Mobile command interface"
    ],
    excluded: [
      "Fleet maintenance and work orders",
      "Commercial CRM and pipeline analytics",
      "Fleet administrator analytics",
      "Multi-vessel fleet management",
      "Future EV vessel development workspace",
      "No Other Master seafarer safety, insurance, and welfare workspace"
    ],
    limits: { vessels: 1, administrators: 1 }
  },
  fleetops: {
    key: "fleetops",
    slug: "fleetops",
    name: "FleetOps",
    shortName: "FleetOps",
    price: 149900,
    priceLabel: "$1,499",
    stripePriceEnv: "STRIPE_PRICE_FLEETOPS",
    note: "Shore-side fleet operations",
    description: "For fleet managers and operating teams managing vessels, maintenance, incidents, commercial accounts, and fleet analytics.",
    modules: FLEETOPS_MODULES,
    resources: FLEETOPS_RESOURCES,
    features: [
      "Multi-vessel fleet registry",
      "Maintenance and work orders",
      "Incident and corrective-action records",
      "Commercial CRM and opportunity pipeline",
      "Fleet administrator analytics",
      "Operational activity and audit stream",
      "Up to 5 administrators",
      "Mobile fleet operations interface"
    ],
    excluded: [
      "Weather and ocean intelligence",
      "Port congestion and bunkering planner",
      "MRCC directory",
      "Captain delegation and certificate modules",
      "Future EV vessel development workspace",
      "No Other Master seafarer safety, insurance, and welfare workspace"
    ],
    limits: { vessels: null, administrators: 5 }
  },
  full_vessel_access: {
    key: "full_vessel_access",
    slug: "full-vessel-access",
    name: "Full Vessel Access Package",
    shortName: "Full Vessel Access",
    price: 199800,
    priceLabel: "$1,998",
    stripePriceEnv: "STRIPE_PRICE_FULL_VESSEL_ACCESS",
    note: "Captain + FleetOps combined",
    description: "The complete Neptune vessel and fleet operating suite, combining every Captain and FleetOps module under one subscription.",
    modules: FULL_MODULES,
    resources: FULL_RESOURCES,
    features: [
      "Every Captain package module",
      "Every FleetOps package module",
      "Complete vessel and shore-team workflow",
      "Maritime weather, ocean, port, bunker, and MRCC intelligence",
      "Delegation, certificates, maintenance, and incidents",
      "Commercial CRM and fleet analytics",
      "Future EV Vessel Projects 2026–2035 workspace",
      "No Other Master seafarer safety, insurance, and welfare workspace",
      "Multi-vessel command visibility",
      "Up to 5 administrators",
      "Single combined Stripe subscription"
    ],
    excluded: [],
    limits: { vessels: null, administrators: 5 }
  },
  enterprise: {
    key: "enterprise",
    slug: "enterprise",
    name: "Enterprise",
    shortName: "Enterprise",
    price: null,
    priceLabel: "Custom",
    stripePriceEnv: "STRIPE_PRICE_ENTERPRISE",
    note: "Multi-fleet deployment",
    description: "For larger organizations requiring custom roles, data migration, integrations, and multi-fleet implementation support.",
    modules: FULL_MODULES,
    resources: FULL_RESOURCES,
    features: [
      "All Full Vessel Access modules",
      "Future EV Vessel Projects 2026–2035 workspace",
      "No Other Master seafarer safety, insurance, and welfare workspace",
      "Unlimited organizations",
      "Custom user roles and permissions",
      "Data migration and onboarding",
      "Priority support",
      "Custom API and provider integrations"
    ],
    excluded: [],
    limits: { vessels: null, administrators: null }
  }
};

export function normalizePlan(value: unknown): PlanKey {
  const raw = String(value || "").trim().toLowerCase().replaceAll("-", "_");
  if (raw === "full" || raw === "full_access" || raw === "full_vessel" || raw === "full_vessel_access_package") return "full_vessel_access";
  if (raw in PLAN_CATALOG) return raw as PlanKey;
  return "captain";
}

export function planDefinition(value: unknown) {
  return PLAN_CATALOG[normalizePlan(value)];
}

export function canAccessModule(plan: unknown, module: ModuleKey) {
  return planDefinition(plan).modules.includes(module);
}

export function canAccessResource(plan: unknown, resource: string) {
  return planDefinition(plan).resources.includes(resource as ResourceKey);
}

export function publicPlanAccess(plan: unknown) {
  const definition = planDefinition(plan);
  return {
    key: definition.key,
    slug: definition.slug,
    name: definition.name,
    modules: definition.modules,
    limits: definition.limits
  };
}
