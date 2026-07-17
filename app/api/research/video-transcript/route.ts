import { NextResponse } from "next/server";

const VIDEO_ID = "s_wGr2TYeHU";
const YOUTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

type CaptionTrack = {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string; runs?: { text?: string }[] };
};

export async function GET() {
  try {
    const playerResponse = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${YOUTUBE_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        videoId: VIDEO_ID,
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20260715.00.00",
            hl: "en",
            gl: "US"
          }
        }
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30000)
    });
    const player = await playerResponse.json() as any;
    const videoDetails = player.videoDetails || {};
    const tracks: CaptionTrack[] = player.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const selected = tracks.find(track => track.languageCode?.startsWith("en") && track.kind !== "asr")
      || tracks.find(track => track.languageCode?.startsWith("en"))
      || tracks[0];

    if (!selected?.baseUrl) {
      return NextResponse.json({
        status: "metadata-only",
        title: videoDetails.title || null,
        description: videoDetails.shortDescription || null,
        author: videoDetails.author || null,
        lengthSeconds: videoDetails.lengthSeconds || null,
        viewCount: videoDetails.viewCount || null,
        keywords: videoDetails.keywords || [],
        playability: player.playabilityStatus || null,
        error: "No caption track was available."
      });
    }

    const captionUrl = new URL(selected.baseUrl);
    captionUrl.searchParams.set("fmt", "json3");
    const captionsResponse = await fetch(captionUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000)
    });
    const captions = await captionsResponse.json() as { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[] };
    const segments = (captions.events || [])
      .filter(event => event.segs?.length)
      .map(event => ({
        startMs: event.tStartMs || 0,
        durationMs: event.dDurationMs || 0,
        text: (event.segs || []).map(segment => segment.utf8 || "").join("").replace(/\s+/g, " ").trim()
      }))
      .filter(segment => segment.text);

    return NextResponse.json({
      status: "success",
      title: videoDetails.title || null,
      description: videoDetails.shortDescription || null,
      author: videoDetails.author || null,
      lengthSeconds: videoDetails.lengthSeconds || null,
      keywords: videoDetails.keywords || [],
      availableTracks: tracks.map(track => ({ languageCode: track.languageCode, kind: track.kind || "manual", name: track.name })),
      transcript: segments.map(segment => segment.text).join(" ").replace(/\s+/g, " ").trim(),
      segments
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retrieve video data" }, { status: 502 });
  }
}
