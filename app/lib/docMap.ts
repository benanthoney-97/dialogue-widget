// app/lib/docMap.ts
export type DocEntry = {
  pdfPath: string;        // legacy path under /public (kept for backwards compatibility)
  agentId: string;        // ElevenLabs Agent ID
  region?: "us" | "eu-residency" | "in-residency" | "global";
  auth?: "signed" | "public";
  url?: string;           // optional external URL to load in widget view
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
 },
   "conflict-economy-sesame": {
   pdfPath: "/papers/Abel-Abate-Demissie.pdf",
   agentId: "agent_2701k5r3zyn1f7wbh5wx7c2wpr7v",
   region: "eu-residency",
   auth: "signed",
 }, 
    "convergence-ai-dlt-cc": {
   pdfPath: "/papers/convergence-ai-dlt.pdf",
   agentId: "agent_5501k5rqdhq7f789s213t7e7b60a",
   region: "eu-residency",
   auth: "signed",
 },
  "english-gcse-revision": {
  pdfPath: "/papers/Edexcel Anthology Conflict.130684367.pdf",
  agentId: "agent_7701k5tkhf04evvbsacthtwc890q",
  region: "eu-residency",
  auth: "signed",
  },
  "srm-all": {
    pdfPath: "/papers/srm-field-experiments.pdf",
    agentId: "agent_5901k6svv6z8fr9s87fk9rqrf1kp",
    region: "eu-residency",
    auth: "signed",
    url: "https://srm360.org/",
},
  "uk-vein-clinic-lead-form-agent": {
    pdfPath: "",
    agentId: "agent_8001k6awq7g0ert91rvgv1yx69hj",
    region: "eu-residency",
    auth: "signed",
    url: "https://www.ukveinclinic.com/thank-you",
  },
  "uk-vein-clinic-knowledge-centre-agent": {
    pdfPath: "",
    agentId: "agent_0401k6bc69vqfk8t1vp96f1xyym2",
    region: "eu-residency",
    auth: "signed",
    url: "https://www.ukveinclinic.com/diseases-conditions/varicose-veins",
  },
      "history-seminar": {
   pdfPath: "/papers/Week 2 (2).pdf",
   agentId: "agent_7801k6smvwp1e7q9kqs8x7bq5p3s",
   region: "eu-residency",
   auth: "signed",
 },
};
