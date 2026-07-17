import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://www.usetranscribe.io/AGENTS.md", {
      cache: "no-store",
      signal: AbortSignal.timeout(30000)
    });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "text/plain" }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retrieve API instructions" }, { status: 502 });
  }
}
