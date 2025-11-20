"use server";

import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function POST(request: Request) {
  try {
    const { documentId } = await request.json();
    if (!documentId || typeof documentId !== "string") {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("[eleven-delete-document] Missing ELEVENLABS_API_KEY");
      return NextResponse.json({ error: "Missing ElevenLabs API key" }, { status: 500 });
    }

    const client = new ElevenLabsClient({
      apiKey,
      environment: process.env.ELEVENLABS_API_URL ?? "https://api.elevenlabs.io/",
    });

    await client.conversationalAi.knowledgeBase.documents.delete(documentId, { force: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[eleven-delete-document] Failed to delete document", error);
    return NextResponse.json({ error: "Unable to delete ElevenLabs document" }, { status: 500 });
  }
}
