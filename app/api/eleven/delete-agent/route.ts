import { NextRequest, NextResponse } from 'next/server';

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1/convai';

async function deleteKnowledgeDoc(apiKey: string, docId: string) {
  const res = await fetch(`${ELEVEN_BASE}/knowledge-base/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: {
      'xi-api-key': apiKey,
    },
  });
  if (!res.ok && res.status !== 404) {
    const message = await res.text();
    throw new Error(`Failed to delete knowledge doc ${docId}: ${res.status} ${message}`);
  }
}

async function deleteAgent(apiKey: string, agentId: string) {
  const res = await fetch(`${ELEVEN_BASE}/agents/${encodeURIComponent(agentId)}`, {
    method: 'DELETE',
    headers: {
      'xi-api-key': apiKey,
    },
  });
  if (!res.ok && res.status !== 404) {
    const message = await res.text();
    throw new Error(`Failed to delete agent ${agentId}: ${res.status} ${message}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { agentId, documentIds } = await req.json();
    if (!agentId && (!documentIds || documentIds.length === 0)) {
      return NextResponse.json({ success: true });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing ElevenLabs API key' }, { status: 500 });
    }

    if (Array.isArray(documentIds)) {
      for (const docId of documentIds) {
        if (typeof docId === 'string' && docId.trim()) {
          await deleteKnowledgeDoc(apiKey, docId.trim());
        }
      }
    }

    if (typeof agentId === 'string' && agentId.trim()) {
      await deleteAgent(apiKey, agentId.trim());
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete ElevenLabs resources:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to delete ElevenLabs resources' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
