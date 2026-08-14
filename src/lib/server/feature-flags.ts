export const FEATURE_FLAGS = {
  passkeys: true,
  managed_devices: true,
  trust_center: true,
  experimental_reports: false,
  experimental_sso: false,
  experimental_offline_conflict_resolution: false
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

type FeatureConfig = {
  global?: Partial<Record<FeatureFlagKey, boolean>>;
  organizations?: Record<string, Partial<Record<FeatureFlagKey, boolean>>>;
};

function parseConfig(): FeatureConfig {
  const raw = String(process.env.NEPTUNE_FEATURE_FLAGS || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as FeatureConfig : {};
  } catch {
    return {};
  }
}

export function featureEnabled(flag: FeatureFlagKey, orgId?: string | null) {
  const config = parseConfig();
  if (orgId && typeof config.organizations?.[orgId]?.[flag] === "boolean") {
    return Boolean(config.organizations[orgId]?.[flag]);
  }
  if (typeof config.global?.[flag] === "boolean") return Boolean(config.global[flag]);
  return FEATURE_FLAGS[flag];
}

export function featureFlagSnapshot(orgId?: string | null) {
  return Object.fromEntries(
    (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).map(flag => [flag, featureEnabled(flag, orgId)])
  ) as Record<FeatureFlagKey, boolean>;
}
