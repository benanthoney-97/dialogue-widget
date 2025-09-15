import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

export const runtime = "nodejs"; // ensure Node runtime

const EMBED_MODEL = "text-embedding-3-large";
const INDEX_NAME = "ib-research-demo";
const DEFAULT_NAMESPACE = "uk_spending";
const TOP_K = 5;

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const query = body?.query as string;
    const top_k = Number(body?.top_k ?? TOP_K);
    const namespace = (body?.namespace as string) || DEFAULT_NAMESPACE;

    const missing: string[] = [];
    if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
    if (!process.env.PINECONE_API_KEY) missing.push("PINECONE_API_KEY");
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing env vars: ${missing.join(", ")}` },
        { status: 500 }
      );
    }
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    const index = pc.Index(INDEX_NAME);

    // Embed the user query
    let vector: number[];
    try {
      const emb = await openai.embeddings.create({ model: EMBED_MODEL, input: query });
      vector = emb.data[0].embedding as unknown as number[];
    } catch (e: any) {
      return NextResponse.json(
        { error: `Embedding failed: ${e?.message || String(e)}` },
        { status: 500 }
      );
    }

    // Query Pinecone (namespace-scoped)
    try {
      const ns = index.namespace(namespace);
      const res = await ns.query({
        vector,
        topK: top_k,
        includeMetadata: true
      });

      const matches = (res.matches || []).map((m: any) => ({
        id: m.id,
        score: m.score,
        title: m.metadata?.title,
        report: m.metadata?.report,
        section: m.metadata?.section,
        provenance: m.metadata?.provenance,
        snippet: m.metadata?.snippet,
        path: m.metadata?.path
      }));

      return NextResponse.json({
        query,
        namespace,
        took_ms: Date.now() - started,
        matches
      });
    } catch (e: any) {
      return NextResponse.json(
        { error: `Pinecone query failed: ${e?.message || String(e)}` },
        { status: 500 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: `Server error: ${e?.message || String(e)}` },
      { status: 500 }
    );
  }
}