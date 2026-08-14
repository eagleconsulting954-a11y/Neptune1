import { spawn } from "node:child_process";

const port = 3391;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    AUTH_SECRET: process.env.AUTH_SECRET || "ci-csrf-neptune-secret",
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
      const response = await fetch(`${base}/`);
      if (response.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Neptune CSRF test server did not start.\n${output}`);
}

function assert(name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  console.log(`✓ ${name}`);
}

try {
  await waitForServer();

  const crossOrigin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://attacker.invalid",
      "sec-fetch-site": "cross-site",
      cookie: "neptune_session_v2=fake"
    },
    body: JSON.stringify({ email: "nobody@example.test", password: "invalid" })
  });
  const crossBody = await crossOrigin.json().catch(() => ({}));
  assert("cross-site mutation rejected", crossOrigin.status === 403 && crossBody.code === "CSRF_REJECTED", `received ${crossOrigin.status}: ${JSON.stringify(crossBody)}`);

  const sameOrigin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: base,
      "sec-fetch-site": "same-origin"
    },
    body: JSON.stringify({ email: "nobody@example.test", password: "invalid" })
  });
  assert("same-origin mutation reaches route", sameOrigin.status !== 403, `same-origin request was rejected as CSRF`);

  const stripe = await fetch(`${base}/api/stripe/webhook`, {
    method: "POST",
    headers: { origin: "https://stripe.com", "sec-fetch-site": "cross-site" },
    body: "{}"
  });
  assert("Stripe webhook remains CSRF-exempt and fails on missing provider secrets", stripe.status === 503, `received ${stripe.status}`);

  console.log("Neptune CSRF regression checks passed.");
} finally {
  child.kill("SIGTERM");
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!child.killed) child.kill("SIGKILL");
}
