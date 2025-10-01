export type ButtonTheme = {
  background: string;
  text: string;
};

// Override button styling per slug. Any slug missing here will use the defaults.
export const defaultButtonTheme: ButtonTheme = {
  background: "#525fe1",
  text: "#ffffff",
};

export const buttonThemeMap: Record<string, ButtonTheme> = {
  "uk-spending-review-2025": { background: "#525fe1", text: "#ffffff" },
  "genai-adoption-he-students": { background: "#525fe1", text: "#ffffff" },
  "intro-linear-optimisation": { background: "#525fe1", text: "#ffffff" },
  "klr-h1-25": { background: "#525fe1", text: "#ffffff" },
  "srm-field-experiments": { background: "#525fe1", text: "#ffffff" },
  "conflict-economy-sesame": { background: "#525fe1", text: "#ffffff" },
  "convergence-ai-dlt-cc": { background: "#525fe1", text: "#ffffff" },
  "english-gcse-revision": { background: "#525fe1", text: "#ffffff" },
  "srm-live-wildfires": { background: "#525fe1", text: "#ffffff" },
  "dialogue-website-agent": { background: "#525fe1", text: "#ffffff" },
  "manual-agent": { background: "#525fe1", text: "#ffffff" },
  "uk-vein-clinic-lead-form-agent": { background: "#29f0de", text: "#004545" },
  "uk-vein-clinic-knowledge-centre-agent": { background: "#29f0de", text: "#004545" },
  "fit-for-work-demo": { background: "#66ffcb", text: "#22223b" },
};
