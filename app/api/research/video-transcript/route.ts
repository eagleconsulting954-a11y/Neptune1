import { NextResponse } from "next/server";

const VIDEO_ID = "s_wGr2TYeHU";

export async function GET() {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
    const [metadataResponse, listResponse] = await Promise.all([
      fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30000)
      }),
      fetch(`https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&type=list`, {
        cache: "no-store",
        signal: AbortSignal.timeout(30000)
      })
    ]);
    const metadataText = await metadataResponse.text();
    const metadata = metadataResponse.ok ? JSON.parse(metadataText) : { error: metadataText, status: metadataResponse.status };
    const trackList = await listResponse.text();
    const tracks = Array.from(trackList.matchAll(/<track\s+([^>]+)\/>/g)).map(match => {
      const attributes = Object.fromEntries(Array.from(match[1].matchAll(/(\w+)="([^"]*)"/g)).map(attribute => [attribute[1], attribute[2].replaceAll("&amp;", "&")]));
      return attributes;
    });
    const selected = tracks.find(track => String(track.lang_code || "").startsWith("en") && !track.kind)
      || tracks.find(track => String(track.lang_code || "").startsWith("en"))
      || tracks[0];

    if (!selected) return NextResponse.json({ metadata, error: "No YouTube caption track was available.", availableTracks: tracks });

    const params = new URLSearchParams({
      v: VIDEO_ID,
      lang: String(selected.lang_code || "en"),
      fmt: "json3"
    });
    if (selected.name) params.set("name", String(selected.name));
    if (selected.kind) params.set("kind", String(selected.kind));

    const captionsResponse = await fetch(`https://www.youtube.com/api/timedtext?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000)
    });
    const captionText = await captionsResponse.text();
    const captions = JSON.parse(captionText) as { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[] };
    const segments = (captions.events || [])
      .filter(event => event.segs?.length)
      .map(event => ({
        startMs: event.tStartMs || 0,
        durationMs: event.dDurationMs || 0,
        text: (event.segs || []).map(segment => segment.utf8 || "").join("").replace(/\s+/g, " ").trim()
      }))
      .filter(segment => segment.text);

    return NextResponse.json({
      metadata,
      status: "success",
      selected,
      availableTracks: tracks,
      transcript: segments.map(segment => segment.text).join(" ").replace(/\s+/g, " ").trim(),
      segments
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retrieve transcript" }, { status: 502 });
  }
}
