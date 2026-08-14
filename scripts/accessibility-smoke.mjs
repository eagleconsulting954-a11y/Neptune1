import { spawn } from "node:child_process";

const port = 3386;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    AUTH_SECRET: process.env.AUTH_SECRET || "ci-accessibility-smoke-secret",
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
      if (response.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`Accessibility test server did not start.\n${output}`);
}

function assert(name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  console.log(`✓ ${name}`);
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function checkHtml(route, html) {
  assert(`${route} declares language`, /<html[^>]*\slang=["']en["']/i.test(html), "missing html lang=en");
  assert(`${route} has a document title`, /<title>[^<]+<\/title>/i.test(html), "missing non-empty title");
  const h1 = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];
  assert(`${route} has one primary heading`, h1.length === 1, `expected one h1, found ${h1.length}`);

  const images = html.match(/<img\b[^>]*>/gi) || [];
  for (const image of images) assert(`${route} image alt`, /\salt=("[^"]*"|'[^']*')/i.test(image), `image missing alt: ${image.slice(0, 180)}`);

  const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/gi) || [];
  for (const button of buttons) {
    const hasLabel = /aria-label=("[^"]+"|'[^']+')/i.test(button) || stripTags(button).length > 0;
    assert(`${route} button name`, hasLabel, `button has no accessible name: ${button.slice(0, 180)}`);
  }

  const inputs = html.match(/<(input|select|textarea)\b[^>]*>/gi) || [];
  for (const control of inputs) {
    if (/type=["']hidden["']/i.test(control)) continue;
    const idMatch = control.match(/\sid=["']([^"']+)["']/i);
    const aria = /aria-label=("[^"]+"|'[^']+')|aria-labelledby=("[^"]+"|'[^']+')/i.test(control);
    const named = /\sname=["'][^"']+["']/i.test(control);
    const associated = idMatch ? new RegExp(`<label[^>]*for=["']${idMatch[1]}["']`, "i").test(html) : false;
    const wrapped = named && new RegExp(`<label[^>]*>[\\s\\S]{0,400}${control.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(html);
    assert(`${route} form control labeling`, aria || associated || wrapped, `control may lack a label: ${control.slice(0, 180)}`);
  }
}

try {
  await waitForServer();
  const routes = ["/", "/pricing", "/login", "/signup", "/install", "/resources", "/trust", "/status"];
  for (const route of routes) {
    const response = await fetch(`${base}${route}`, { redirect: "manual" });
    assert(`${route} renders`, response.status === 200, `expected 200, received ${response.status}`);
    checkHtml(route, await response.text());
  }
  console.log("Neptune accessibility baseline checks passed. Manual WCAG 2.2 AA review is still required before making an accessibility conformance claim.");
} finally {
  child.kill("SIGTERM");
  await new Promise(resolve => setTimeout(resolve, 250));
  if (!child.killed) child.kill("SIGKILL");
}
