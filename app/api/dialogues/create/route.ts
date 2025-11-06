import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

type IncomingDoc = {
  temp_id: string;
  agent_name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
  lastModified: number;
  groupTempId: string;
};

type CreateDialoguePayload = {
  clientSlug?: string;
  docs?: IncomingDoc[];
  purpose?: string;
  audienceType?: string;
  briefingConversationId?: string | null;
  briefingEndedAt?: number | null;
  personaName?: string | null;
};

function decodeSlug(rawSlug: string): string {
  try {
    return decodeURIComponent(rawSlug);
  } catch {
    return rawSlug;
  }
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  const mimeType = match[1] || 'application/octet-stream';
  const buffer = Buffer.from(match[2], 'base64');
  return { buffer, mimeType };
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

function buildPublicUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/docs/${encodeURIComponent(path)}`;
}

export async function POST(req: Request) {
  let agentId: string | null = null;
  try {
    const body = (await req.json()) as CreateDialoguePayload;
    const {
      clientSlug,
      docs,
      purpose,
      audienceType,
      briefingConversationId,
      briefingEndedAt,
      personaName,
    } = body;

    if (!clientSlug) {
      return NextResponse.json({ error: 'Missing workspace identifier' }, { status: 400 });
    }

    const docsArray: IncomingDoc[] = Array.isArray(docs) ? docs : [];

    const decodedSlug = decodeSlug(clientSlug);

    let clientRecord: { id: number; name?: string | null; display_name?: string | null } | null = null;
    let clientLookupError: unknown = null;

    const trimmedSlug = decodedSlug.trim();
    if (trimmedSlug.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('id, name, display_name')
        .eq('id', trimmedSlug)
        .maybeSingle();
      if (data) {
        clientRecord = data;
      } else if (error) {
        clientLookupError = error;
      }
    }

    if (!clientRecord && trimmedSlug.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('id, name, display_name')
        .eq('name', trimmedSlug)
        .maybeSingle();
      if (data) {
        clientRecord = data;
      } else if (error) {
        clientLookupError = error;
      }
    }

    if (!clientRecord) {
      if (clientLookupError) {
        console.error('[CreateDialogue] Failed to resolve workspace', clientLookupError);
      }
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const clientId = clientRecord.id;

    const { data: profileCandidates, error: ownerLookupError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (ownerLookupError) {
      console.warn('[CreateDialogue] Unable to locate workspace owner profile', ownerLookupError);
    }

    const ownerProfileId = profileCandidates?.[0]?.id ?? null;

    console.log('[CreateDialogue] incoming payload', {
      clientSlug: decodedSlug,
      clientId,
      docsCount: docsArray.length,
      hasPurpose: Boolean(purpose),
      hasBriefing: Boolean(briefingConversationId),
      hasBriefingEndedAt: Boolean(briefingEndedAt),
      hasPersonaName: Boolean(personaName && personaName.trim()),
    });

    agentId = randomUUID();
    const primaryDoc = docsArray[0];
    const key = randomUUID().replace(/-/g, '').slice(0, 12);
    const nowIso = new Date().toISOString();
    const trimmedPersonaName = typeof personaName === 'string' ? personaName.trim() : '';
    const derivedAgentName =
      trimmedPersonaName ||
      primaryDoc?.agent_name ||
      (key ? `Persona ${key.slice(0, 6)}` : 'Persona');

    const insertPayload: Record<string, unknown> = {
      agent_id: agentId,
      client_id: clientId,
      key,
      agent_name: derivedAgentName,
      created_at: nowIso,
      description: purpose ?? null,
      audience_type: audienceType ?? null,
      briefing_conversation_id: briefingConversationId ?? null,
    };

    if (ownerProfileId) {
      insertPayload.user_id = ownerProfileId;
    }

    const { error: createAgentError } = await supabaseAdmin
      .from('agent_map')
      .insert([
        insertPayload as any,
      ]);

    if (createAgentError) {
      return NextResponse.json({ error: createAgentError.message }, { status: 500 });
    }

    const documentsToInsert: Array<{
      agent_id: string;
      file_name: string;
      storage_path: string | null;
      public_url: string | null;
      mime_type: string | null;
      file_size: number | null;
      source: string | null;
    }> = [];

    for (const doc of docsArray) {
      if (!doc) continue;
      const isExternalUrl = doc.fileType === 'text/url' && /^https?:\/\//i.test(doc.dataUrl);
      if (isExternalUrl) {
        documentsToInsert.push({
          agent_id: agentId,
          file_name: doc.fileName,
          storage_path: null,
          public_url: doc.dataUrl,
          mime_type: doc.fileType ?? null,
          file_size: doc.fileSize ?? null,
          source: 'external',
        });
        continue;
      }

      if (!doc.dataUrl?.startsWith('data:')) {
        throw new Error(`Document ${doc.fileName} missing data URL payload`);
      }

      const { buffer, mimeType } = decodeDataUrl(doc.dataUrl);
    const fileName = safeFileName(doc.fileName || `file-${randomUUID()}`);
    const storagePath = `clients/${clientId}/${agentId}/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('docs')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = await supabaseAdmin.storage
        .from('docs')
        .getPublicUrl(storagePath);
      const publicUrl =
        (publicUrlData as any)?.publicUrl ??
        (publicUrlData as any)?.publicURL ??
        buildPublicUrl(storagePath);

      documentsToInsert.push({
        agent_id: agentId,
        file_name: fileName,
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: mimeType,
        file_size: doc.fileSize ?? buffer.byteLength,
        source: 'storage',
      });
    }

    if (documentsToInsert.length > 0) {
      const preparedDocs = documentsToInsert.map((doc) => ({
        ...doc,
      }));
      const { error: docsError } = await supabaseAdmin.from('agent_documents').insert(preparedDocs);
      if (docsError) {
        throw new Error(docsError.message);
      }
    }

    return NextResponse.json({ agentId });
  } catch (error: any) {
    const message = error?.message ?? 'Unexpected error';
    if (agentId) {
      await supabaseAdmin.from('agent_map').delete().eq('agent_id', agentId);
      await supabaseAdmin.from('agent_documents').delete().eq('agent_id', agentId);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
