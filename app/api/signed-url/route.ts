import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const path = body?.path;
    const expires = Number(body?.expires ?? 120);
    if (!path) return NextResponse.json({ error: 'missing path' }, { status: 400 });

    const { data, error } = await supabaseAdmin.storage.from('docs').createSignedUrl(path, expires);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ signedUrl: (data as any).signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
