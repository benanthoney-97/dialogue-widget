export type ButtonTheme = {
  background: string;
  text: string;
  border: string;
};

// Override button styling per slug. Any slug missing here will use the defaults.
export const defaultButtonTheme: ButtonTheme = {
  background: "#525fe1",
  text: "#ffffff",
  border: "#525fe1",
};

export const buttonThemeMap: Record<string, ButtonTheme> = {
  "uk-spending-review-2025": {
    background: "#525fe1",
    text: "#ffffff",
    border: "#525fe1",
  },
  "genai-adoption-he-students": {
    background: "#b01c2e",
    text: "#ffffff",
    border: "#b01c2e",
  },
  "intro-linear-optimisation": {
    background: "#b01c2e",
    text: "#ffffff",
    border: "#b01c2e",
  },
  "klr-h1-25": {
    background: "#525fe1",
    text: "#ffffff",
    border: "#525fe1",
  },
  "srm-field-experiments": {
    background: "#525fe1",
    text: "#ffffff",
    border: "#525fe1",
  },
  "conflict-economy-sesame": {
    background: "#525fe1",
    text: "#ffffff",
    border: "#525fe1",
  },
  "convergence-ai-dlt-cc": {
    background: "#4453f4",
    text: "#ffffff",
    border: "#4453f4",
  },
  "english-gcse-revision": {
    background: "#525fe1",
    text: "#ffffff",
    border: "#525fe1",
  },
  "srm-live-wildfires": {
    background: "#525fe1",
    text: "#ffffff",
    border: "#525fe1",
  },
  "srm-all": {
    background: "#f6d217",
    text: "#000000ff",
    border: "#f6d217",
  },
    "srm-september-update": {
    background: "#f6d217",
    text: "#000000ff",
    border: "#f6d217",
  },
    "srm-live-discussion": {
    background: "#f6d217",
    text: "#000000ff",
    border: "#f6d217",
  },
  "dialogue-website-agent": {
    background: "#525fe1",
    text: "#ffffff",
    border: "#525fe1",
  },
  "manual-agent": {
    background: "#525fe1",
    text: "#ffffff",
    border: "#525fe1",
  },
  "uk-vein-clinic-lead-form-agent": {
    background: "#29f0de",
    text: "#004545",
    border: "#29f0de",
  },
  "uk-vein-clinic-knowledge-centre-agent": {
    background: "#29f0de",
    text: "#004545",
    border: "#29f0de",
  },
    "timeout-october-demo": {
    background: "#e1192c",
    text: "#ffffffff",
    border: "#e1192c",
  },
};
