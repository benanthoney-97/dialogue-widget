import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

type FinalizeRequest = {
  clientSlug: string;
  tempId: string;
  agentIds: string[];
  // optional: whether to delete temp objects after moving
  deleteTemp?: boolean;
};

function makeFinalPath(clientSlug: string, agentId: string, filename: string) {
  // final path pattern: clients/{clientSlug}/{agentId}/{filename}
  return `clients/${clientSlug}/${agentId}/${filename}`;
}

export async function POST(req: Request) {
  try {
    const body: FinalizeRequest = await req.json();
  const { clientSlug, tempId, agentIds, deleteTemp } = body || ({} as FinalizeRequest);
  // Default to deleting temp objects after successful finalize unless explicitly overridden
  const shouldDeleteTemp = typeof deleteTemp === 'boolean' ? deleteTemp : true;

    if (!clientSlug || !tempId || !agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // List objects under the temp prefix
    const prefix = `clients/${clientSlug}/temp/${tempId}/`;
    const { data: listed, error: listErr } = await supabaseAdmin.storage.from('docs').list(prefix, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } });
    if (listErr) return NextResponse.json({ error: `Failed to list temp objects: ${listErr.message}` }, { status: 500 });

    // Build mapping from filename -> full path
    const files = (listed ?? []).filter(f => f.name).map(f => ({ name: f.name, path: `${prefix}${f.name}` }));

    if (files.length === 0) {
      // No files to move, but still mark rows Ready
      const { error: updErr } = await supabaseAdmin
        .from('agent_map')
        .update({ status: 'Ready', dialogue_created_date: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in('agent_id', agentIds);
      if (updErr) return NextResponse.json({ error: `Failed to mark agent_map rows Ready: ${updErr.message}` }, { status: 500 });
      return NextResponse.json({ success: true, moved: 0 });
    }

    // Expectation: number of files matches number of agentIds OR single file per agent.
    // We'll map files to agentIds by index order. If mismatch, use filename->agentId naive mapping by exact match of filename to agent key.
    const moves: Array<{ from: string; to: string; agentId: string; filename: string }> = [];

    if (files.length === agentIds.length) {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const agentId = agentIds[i];
        const final = makeFinalPath(clientSlug, agentId, f.name);
        moves.push({ from: f.path, to: final, agentId, filename: f.name });
      }
    } else {
      // attempt to match by filename to agent key stored previously as 'key' in agent_map
      const { data: agentRows, error: agentErr } = await supabaseAdmin
        .from('agent_map')
        .select('agent_id,key')
        .in('agent_id', agentIds);
      if (agentErr) return NextResponse.json({ error: `Failed to fetch agent rows for mapping: ${agentErr.message}` }, { status: 500 });

      const keyMap = new Map<string, string>();
      (agentRows ?? []).forEach((r: any) => {
        if (r.key) keyMap.set(r.key, r.agent_id);
      });

      for (const f of files) {
        const agentId = keyMap.get(f.name) ?? agentIds[0];
        const final = makeFinalPath(clientSlug, agentId, f.name);
        moves.push({ from: f.path, to: final, agentId, filename: f.name });
      }
    }

    // Perform copies using supabaseAdmin.storage.from('docs').copy
    const moved: Array<{ agentId: string; filename: string; to: string }> = [];
    for (const m of moves) {
      const { data: copyData, error: copyErr } = await supabaseAdmin.storage.from('docs').copy(m.from, m.to);
      if (copyErr) {
        return NextResponse.json({ error: `Failed to copy ${m.from} -> ${m.to}: ${copyErr.message}` }, { status: 500 });
      }
      moved.push({ agentId: m.agentId, filename: m.filename, to: m.to });
    }

    // Update agent_map rows with final document_url and mark Ready
    // Construct public URLs for the new paths (assuming bucket is public)
    const updates = moved.map((r) => ({ agent_id: r.agentId, document_url: `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/storage/v1/object/public/docs/${encodeURIComponent(r.to)}` }));

    // Update rows individually (to set document_url per agent)
    for (const u of updates) {
      const { error: rowErr } = await supabaseAdmin
        .from('agent_map')
        .update({ document_url: u.document_url, status: 'Ready', dialogue_created_date: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('agent_id', u.agent_id);
      if (rowErr) {
        return NextResponse.json({ error: `Failed to update agent_map for ${u.agent_id}: ${rowErr.message}` }, { status: 500 });
      }
    }

    // Optionally delete temp objects
    if (shouldDeleteTemp) {
      const keysToDelete = files.map(f => f.path);
      const { error: delErr } = await supabaseAdmin.storage.from('docs').remove(keysToDelete);
      if (delErr) {
        // non-fatal: warn but continue
        console.warn('Failed to delete temp objects', delErr.message);
      }
    }

    return NextResponse.json({ success: true, moved: moved.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
