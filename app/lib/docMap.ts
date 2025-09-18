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
 "spending-review-june": {
   pdfPath: "/papers/spending-review-june.pdf",
   agentId: "agent_1601k522np07ey0bx6shfs65wvnk",
   region: "eu-residency",
   auth: "signed",
 },
 "klr-h1-25": {
   pdfPath: "/papers/klr-h1-25.pdf",
   agentId: "agent_6501k59ek962ekft13ah41dedzkq",
   region: "eu-residency",
   auth: "signed",
 },
  "srm-field-experiments": {
   pdfPath: "/papers/srm-field-experiments.pdf",
   agentId: "agent_6101k4d1wak5erk80jsmk1nfcjdc",
   region: "eu-residency",
   auth: "signed",
 }
};