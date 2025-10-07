// app/lib/docMap.ts
export type DocEntry = {
  pdfPath: string;        // legacy path under /public (kept for backwards compatibility)
  agentId: string;        // ElevenLabs Agent ID
  region?: "us" | "eu-residency" | "in-residency" | "global";
  auth?: "signed" | "public";
  url?: string;           // optional external URL to load in widget view
  talkLabel?: string;     // optional label for the talk button
  screenshotPath?: string; // optional static image backdrop under /public
  author?: string;        // optional author name used in contact form copy
};

export const docMap: Record<string, DocEntry> = {
  "genai-adoption-he-students": {
    pdfPath: "/papers/genai-adoption-he-students.pdf",
    agentId: "agent_0201k5721624eje83256ywmc5g9v",    // <- fill in
    region: "eu-residency",
    auth: "signed",
    talkLabel: "Start Dialogue",
    screenshotPath: "/screenshots/default.png",
  },
  "intro-linear-optimisation": {
    pdfPath: "/papers/intro-linear-optimisation.pdf",
    agentId: "agent_4901k57bjnnkefr8pvnbpsjgkx6t",
    region: "eu-residency",
    auth: "signed",
    talkLabel: "Begin Lecture",
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
    talkLabel: "Summary",
    url: "https://www.cliffordchance.com/content/dam/cliffordchance/Thought_Leadership/convergence-of-ai-and-dlt-final-v2-interactive-compressed.pdf",
    author: "Diego Ballon Ossio",
  },
  "english-gcse-revision": {
  pdfPath: "/papers/Edexcel Anthology Conflict.130684367.pdf",
  agentId: "agent_7701k5tkhf04evvbsacthtwc890q",
  region: "eu-residency",
  auth: "signed",
  },
    "teacher-english-gcse": {
  pdfPath: "/papers/June-24-Examiner-Report.pdf",
  agentId: "agent_5001k6qh9mz3edk836s4v5yysayd",
  region: "eu-residency",
  auth: "signed",
  },
  "srm-all": {
    pdfPath: "/papers/srm-field-experiments.pdf",
    agentId: "agent_5901k6svv6z8fr9s87fk9rqrf1kp",
    region: "eu-residency",
    auth: "signed",
    url: "https://srm360.org/",
    talkLabel: "SRM360 Learn",
    screenshotPath: "/screenshots/default.png",
  },
    "srm-september-update": {
    pdfPath: "/papers/srm-field-experiments.pdf",
    agentId: "agent_2501k5ydzc8retbr2t1ntqphynhf",
    region: "eu-residency",
    auth: "signed",
    url: "https://news.srm360.org/index.php?action=social&chash=8f85517967795eeef66c225f7883bdcb.313&s=5b65f7b95b41d7073fc93cf81f44f763&_gl=1*1a8idy0*_ga*NDg3Mjg3NzY0LjE3NTcwMTgwNzg.*_ga_4G9JPHNFGF*czE3NTk3NDA1MDYkbzM1JGcxJHQxNzU5NzQxMzQzJGoxNiRsMCRoMA..",
    talkLabel: "SRM360 Update",
  },
    "srm-live-discussion": {
    pdfPath: "/papers/srm-field-experiments.pdf",
    agentId: "agent_5901k5y39g61eckahbpx06479dv8",
    region: "eu-residency",
    auth: "signed",
    url: "https://srm360.org/video/live-discussion-srm-and-africa-perspectives-from-the-continent/",
    talkLabel: "SRM360 Discuss",
  },
  "uk-vein-clinic-lead-form-agent": {
    pdfPath: "",
    agentId: "agent_8001k6awq7g0ert91rvgv1yx69hj",
    region: "eu-residency",
    auth: "signed",
    url: "https://www.ukveinclinic.com/thank-you",
    talkLabel: "Prepare for call",
  },
  "uk-vein-clinic-knowledge-centre-agent": {
    pdfPath: "",
    agentId: "agent_0401k6bc69vqfk8t1vp96f1xyym2",
    region: "eu-residency",
    auth: "signed",
    url: "https://www.ukveinclinic.com/diseases-conditions/varicose-veins",
    talkLabel: "Learn",
  },
      "history-seminar": {
   pdfPath: "/papers/Week 2 (2).pdf",
   agentId: "agent_7801k6smvwp1e7q9kqs8x7bq5p3s",
   region: "eu-residency",
   auth: "signed",
 },
    "dialogue-website-agent": {
   pdfPath: "/papers/Week 2 (2).pdf",
   agentId: "agent_2301k6ajjgh3fvntarvd2a4g13t8",
   region: "eu-residency",
   auth: "signed",
  talkLabel: "Try Dialogue",
  screenshotPath: "/screenshots/default.png",
 },
    "timeout-october-demo": {
   pdfPath: "/papers/Week 2 (2).pdf",
   agentId: "agent_1401k6wz63r0fpk8akgwcd8vkt2g",
   region: "eu-residency",
    auth: "signed",
  talkLabel: "Talk to Time Out",
  screenshotPath: "/screenshots/timeout.jpg",
 },
     "savills-2025-european-real-estate-logistics-consensus": {
   pdfPath: "/papers/Week 2 (2).pdf",
   agentId: "agent_5501k6z36t98e4f9qh0nt92g15zy",
   region: "eu-residency",
    auth: "signed",
  talkLabel: "Summary",
    url: "https://pdf.euro.savills.co.uk/european/european-commercial-markets/european-logistics-census-2025.pdf",
  screenshotPath: "/screenshots/timeout.jpg",
 },
};
