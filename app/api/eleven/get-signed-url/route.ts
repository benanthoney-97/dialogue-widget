import { NextRequest, NextResponse } from 'next/server';
// You may need to install 'node-fetch' if fetch is not available in your Node.js runtime
// import fetch from 'node-fetch';

// This is a placeholder implementation for generating a signed URL for ElevenLabs API usage.
// Replace this logic with your actual signing logic and credentials as needed.

const ELEVENLABS_API_BASE =
  process.env.ELEVENLABS_API_BASE?.replace(/\/+$/, "") || "https://api.elevenlabs.io";

export async function POST(req: NextRequest) {
  try {
    const { agent_id } = await req.json();
    console.log('[elevenlabs-debug] Received agent_id:', agent_id);

    // Get API key from environment variable
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      console.error('[elevenlabs-debug] Missing ELEVENLABS_API_KEY');
      return NextResponse.json({ error: 'Missing ElevenLabs API key' }, { status: 500 });
    }

    if (!agent_id) {
      console.error('[elevenlabs-debug] Missing agent_id in request body');
      return NextResponse.json({ error: 'Missing agent_id' }, { status: 400 });
    }

    // Call ElevenLabs API to get the signed WebSocket URL for the agent
    const url = `${ELEVENLABS_API_BASE}/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent_id)}`;
    console.log('[elevenlabs-debug] Requesting ElevenLabs signed URL:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[elevenlabs-debug] ElevenLabs API error:', errorText);
      return NextResponse.json({ error: errorText }, { status: 500 });
    }

    const data = await response.json();
    console.log('[elevenlabs-debug] ElevenLabs API response:', data);
    const signedUrl = data.signed_url;

    if (!signedUrl) {
      console.error('[elevenlabs-debug] No signed_url in ElevenLabs response:', data);
      return NextResponse.json({ error: 'No signed URL returned from ElevenLabs' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl });
  } catch (error) {
    console.error('[elevenlabs-debug] Exception in get-signed-url:', error);
    type ErrorWithCause = NodeJS.ErrnoException & { cause?: { code?: string } };
    const err = error as ErrorWithCause;
    const networkCodes = new Set(['ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED']);
    const errorCode = err?.code || err?.cause?.code;
    if (errorCode && networkCodes.has(errorCode)) {
      return NextResponse.json(
        {
          error: `Unable to reach ElevenLabs at ${ELEVENLABS_API_BASE}. Check your network connection or ELEVENLABS_API_BASE setting.`,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: err?.message || 'Failed to generate signed URL' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
