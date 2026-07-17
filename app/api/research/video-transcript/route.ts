import { NextResponse } from "next/server";

const VIDEO_URL = "https://www.youtube.com/watch?v=s_wGr2TYeHU";

export async function GET() {
  try {
    const response = await fetch("https://www.usetranscribe.io/transcribe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "NeptuneLandingPageResearch/1.0"
      },
      body: JSON.stringify({ url: VIDEO_URL }),
      cache: "no-store",
      signal: AbortSignal.timeout(60000)
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retrieve transcript" }, { status: 502 });
  }
}
