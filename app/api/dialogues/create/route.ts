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
};

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
    const { clientSlug, docs, purpose, audienceType } = body;

    if (!clientSlug) {
      return NextResponse.json({ error: 'Missing client slug' }, { status: 400 });
    }
    if (!Array.isArray(docs) || docs.length === 0) {
      return NextResponse.json({ error: 'No documents provided' }, { status: 400 });
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('name', clientSlug)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    agentId = randomUUID();
    const primaryDoc = docs[0];
    const key = safeFileName(primaryDoc?.fileName || `dialogue-${agentId}`);
    const nowIso = new Date().toISOString();

    const { error: createAgentError } = await supabaseAdmin
      .from('agent_map')
      .insert([
        {
          agent_id: agentId,
          client_id: client.id,
          key,
          agent_name: primaryDoc?.agent_name ?? key,
          created_at: nowIso,
          description: purpose ?? null,
          audience_type: audienceType ?? null,
        } as any,
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

    for (const doc of docs) {
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
      const storagePath = `clients/${clientSlug}/${agentId}/${fileName}`;

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
        added_stage: doc.added_stage ?? 'seed',
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
