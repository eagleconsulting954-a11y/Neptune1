import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://youtube-transcript-api-tau-one.vercel.app/transcript", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=s_wGr2TYeHU" }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000)
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
