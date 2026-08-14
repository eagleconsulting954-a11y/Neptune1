import { spawn } from "node:child_process";

const port = 3377;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    AUTH_SECRET: process.env.AUTH_SECRET || "ci-only-neptune-http-smoke-secret",
    NEXT_PUBLIC_APP_URL: base,
    DATABASE_URL: "",
    ALLOW_DEMO_LOGIN: "false"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", chunk => { output += chunk.toString(); });
child.stderr.on("data", chunk => { output += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/`, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Neptune test server did not start.\n${output}`);
}

function assert(name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  console.log(`✓ ${name}`);
}

try {
  await waitForServer();

  const home = await fetch(`${base}/`, { redirect: "manual" });
  assert("home available", home.status === 200, `expected 200, received ${home.status}`);
  assert("CSP header", Boolean(home.headers.get("content-security-policy")), "missing Content-Security-Policy");
  assert("frame denial", home.headers.get("x-frame-options") === "DENY", `unexpected X-Frame-Options: ${home.headers.get("x-frame-options")}`);
  assert("content type protection", home.headers.get("x-content-type-options") === "nosniff", "missing nosniff");
  assert("permissions policy", Boolean(home.headers.get("permissions-policy")), "missing Permissions-Policy");
  assert("HSTS", Boolean(home.headers.get("strict-transport-security")), "missing Strict-Transport-Security");

  for (const route of ["/dashboard", "/security-center", "/passkeys", "/admin", "/platform-admin"]) {
    const response = await fetch(`${base}${route}`, { redirect: "manual" });
    assert(`${route} unauthenticated redirect`, [307, 308].includes(response.status), `expected redirect, received ${response.status}`);
    assert(`${route} redirects to login`, (response.headers.get("location") || "").includes("/login"), `unexpected location ${response.headers.get("location")}`);
  }

  const securityApi = await fetch(`${base}/api/v1/security-center`, { redirect: "manual" });
  assert("security API rejects anonymous", securityApi.status === 401, `expected 401, received ${securityApi.status}`);

  const bootstrap = await fetch(`${base}/api/bootstrap`, { redirect: "manual" });
  assert("bootstrap rejects anonymous", bootstrap.status === 401, `expected 401, received ${bootstrap.status}`);

  const crm = await fetch(`${base}/api/v1/crm_accounts`, { redirect: "manual" });
  assert("CRM API rejects anonymous", crm.status === 401, `expected 401, received ${crm.status}`);

  const passkey = await fetch(`${base}/api/auth/passkey`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "options", email: "invalid" })
  });
  assert("passkey endpoint validates identity input", passkey.status === 400, `expected 400, received ${passkey.status}`);

  console.log("Neptune production HTTP smoke tests passed.");
} finally {
  child.kill("SIGTERM");
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!child.killed) child.kill("SIGKILL");
}
