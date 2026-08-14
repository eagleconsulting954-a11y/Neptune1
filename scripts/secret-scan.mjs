import { execFileSync } from "node:child_process";
import fs from "node:fs";

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const excluded = /^(node_modules\/|\.next\/|docs\/|README\.md$|\.env\.example$|package-lock\.json$|public\/)/;
const patterns = [
  ["Stripe live secret", /\bsk_live_[A-Za-z0-9]{20,}\b/],
  ["Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{20,}\b/],
  ["Resend API key", /\bre_[A-Za-z0-9]{20,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Private key", /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["OpenAI secret", /\bsk-[A-Za-z0-9_-]{32,}\b/]
];

const findings = [];
for (const file of files) {
  if (excluded.test(file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
  for (const [name, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) findings.push(`${name} pattern in ${file}`);
  }
}

if (findings.length) {
  console.error("Potential committed secrets detected:\n" + findings.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Neptune secret regression scan passed across ${files.length} tracked paths.`);
