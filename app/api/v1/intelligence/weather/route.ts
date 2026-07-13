import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { getWeatherAndOcean } from "@/src/lib/server/maritime";

export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lon"));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return NextResponse.json({ error: "Valid lat and lon coordinates are required." }, { status: 400 });
    return NextResponse.json(await getWeatherAndOcean(latitude, longitude));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown weather provider error";
    console.error(error);
    return NextResponse.json({ error: "Unable to retrieve live weather and marine forecast data.", detail: message }, { status: 502 });
  }
}
