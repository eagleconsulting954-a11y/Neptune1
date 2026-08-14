import { execFileSync } from "node:child_process";
import fs from "node:fs";

const raw = execFileSync("npm", ["query", "*", "--json"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
const packages = JSON.parse(raw);

const blocked = [
  /(^|\s|\()AGPL/i,
  /(^|\s|\()SSPL/i,
  /Commons Clause/i,
  /Business Source License|BUSL/i
];

const rows = packages.map(item => ({
  name: item.name || "unknown",
  version: item.version || "unknown",
  license: item.license || "UNKNOWN",
  location: item.location || null
}));

const violations = rows.filter(item => blocked.some(pattern => pattern.test(String(item.license))));
const unknown = rows.filter(item => String(item.license).toUpperCase() === "UNKNOWN");
const report = {
  generatedAt: new Date().toISOString(),
  packageCount: rows.length,
  blockedLicenseFindings: violations,
  unknownLicenseCount: unknown.length,
  unknownLicenses: unknown.slice(0, 100),
  packages: rows
};

fs.writeFileSync("license-report.json", JSON.stringify(report, null, 2));

if (violations.length) {
  console.error("Blocked dependency licenses detected:");
  for (const item of violations) console.error(`- ${item.name}@${item.version}: ${item.license}`);
  process.exit(1);
}

console.log(`Neptune dependency license scan passed: ${rows.length} package records, ${unknown.length} unknown license declarations.`);
if (unknown.length) console.log("Unknown declarations are retained in license-report.json for manual procurement/legal review; they are not silently treated as approved licenses.");
