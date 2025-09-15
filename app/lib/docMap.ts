// app/lib/docMap.ts
export type DocEntry = {
  pdfPath: string;        // path under /public
  agentId: string;        // ElevenLabs Agent ID
  region?: "us" | "eu-residency" | "in-residency" | "global";
  auth?: "signed" | "public";
};

export const docMap: Record<string, DocEntry> = {
  "genai-adoption-he-students": {
    pdfPath: "/papers/genai-adoption-he-students.pdf",
    agentId: "agent_0201k5721624eje83256ywmc5g9v",    // <- fill in
    region: "eu-residency",
    auth: "signed",
  },
  "intro-linear-optimisation": {
    pdfPath: "/papers/intro-linear-optimisation.pdf",
    agentId: "agent_4901k57bjnnkefr8pvnbpsjgkx6t",
    region: "eu-residency",
    auth: "signed",
  },
  // add more...
};