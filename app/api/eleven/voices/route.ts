import { NextResponse } from "next/server";

const ELEVENLABS_API_BASE =
  process.env.ELEVENLABS_API_BASE?.replace(/\/+$/, "") || "https://api.elevenlabs.io/v1";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[elevenlabs-voices] Missing ELEVENLABS_API_KEY");
    return NextResponse.json({ error: "Missing ElevenLabs API key" }, { status: 500 });
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/voices`, {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[elevenlabs-voices] Failed to fetch voices", response.status, text);
      return NextResponse.json({ error: "Failed to fetch ElevenLabs voices" }, { status: 502 });
    }

    const payload = await response.json();
    const voices = Array.isArray(payload?.voices)
      ? payload.voices.map((voice: any) => ({
          voice_id: voice?.voice_id ?? null,
          name: voice?.name ?? null,
          accent: voice?.accent ?? voice?.labels?.accent ?? null,
          description: voice?.description ?? null,
          gender: voice?.gender ?? voice?.labels?.gender ?? null,
          age: voice?.age ?? voice?.labels?.age ?? null,
          preview_url: voice?.preview_url ?? voice?.preview_url_mp3 ?? null,
        }))
      : [];

    return NextResponse.json({ voices });
  } catch (error) {
    console.error("[elevenlabs-voices] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected error retrieving voices" }, { status: 500 });
  }
}
