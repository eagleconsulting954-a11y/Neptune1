import { NextResponse } from "next/server";

export const maxDuration = 300;

const VIDEO_ID = "s_wGr2TYeHU";
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const BASE_URL = "https://www.usetranscribe.io";

export async function GET() {
  try {
    const checkResponse = await fetch(`${BASE_URL}/api/check?platform=youtube&id=${VIDEO_ID}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000)
    });
    const check = await checkResponse.json() as { cached?: boolean; permalink?: string };

    if (check.cached && check.permalink) {
      const permalink = check.permalink.startsWith("http") ? check.permalink : `${BASE_URL}${check.permalink}`;
      const cachedResponse = await fetch(`${permalink}?format=json`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30000)
      });
      const text = await cachedResponse.text();
      return new NextResponse(text, {
        status: cachedResponse.status,
        headers: { "content-type": cachedResponse.headers.get("content-type") || "application/json" }
      });
    }

    const transcribeUrl = new URL(`${BASE_URL}/transcribe`);
    transcribeUrl.searchParams.set("url", VIDEO_URL);
    transcribeUrl.searchParams.set("summarize", "1");
    const response = await fetch(transcribeUrl, {
      headers: { "user-agent": "NeptuneLandingPageResearch/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(285000)
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "text/event-stream" }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retrieve transcript" }, { status: 502 });
  }
}
