export type VoiceOption = {
  voice_id: string;
  name: string;
  accent?: string | null;
  gender?: string | null;
  age?: string | null;
  description?: string | null;
  preview_url?: string | null;
};

export type ElevenLabsVoiceResponse = {
  voice_id: string;
  name?: string | null;
  accent?: string | null;
  description?: string | null;
  gender?: string | null;
  age?: string | null;
  preview_url?: string | null;
};

const VOICE_CATALOG: ReadonlyArray<VoiceOption> = [
  {
    voice_id: "Tx7VLgfksXHVnoY6jDGU",
    name: "Conversational Joe",
    accent: "General American",
    gender: "Female",
    age: "Mid 30s",
    description:
      "Warm and confident with a thoughtful cadence suited for executive interviews.",
    preview_url: "https://storage.googleapis.com/dialogue-widget/voices/aria-preview.mp3",
  },
  {
    voice_id: "56bWURjYFHyYyVf490Dp",
    name: "Conversational Alexandra",
    accent: "Gulf Arabic (English)",
    gender: "Female",
    age: "Late 20s",
    description:
      "Clear and energetic tone that keeps rapid-fire Q&A sessions engaging.",
    preview_url: "https://storage.googleapis.com/dialogue-widget/voices/noor-preview.mp3",
  },
  {
    voice_id: "0lp4RIz96WD1RUtvEu3Q",
    name: "Casual Mark",
    accent: null,
    gender: null,
    age: null,
    description: null,
    preview_url: null,
  },
  {
    voice_id: "kdmDKE6EkgrWrrykO9Qt",
    name: "Conversational Lucy",
    accent: null,
    gender: null,
    age: null,
    description: null,
    preview_url: null,
  },
  {
    voice_id: "lUTamkMw7gOzZbFIwmq4",
    name: "Professional James",
    accent: "Southern British",
    gender: "Male",
    age: "Early 40s",
    description:
      "Measured and articulate delivery ideal for strategic discussions and workshops.",
    preview_url: "https://storage.googleapis.com/dialogue-widget/voices/jasper-preview.mp3",
  },
  {
    voice_id: "1SM7GgM6IMuvQlz2BwM3",
    name: "Conversational Mark",
    accent: null,
    gender: null,
    age: null,
    description: null,
    preview_url: null,
  },
  {
    voice_id: "lcMyyd2HUfFzxdCaC4Ta",
    name: "Casual Nina",
    accent: null,
    gender: null,
    age: null,
    description: null,
    preview_url: null,
  },
] as const;

export const ALLOWED_VOICE_IDS = VOICE_CATALOG.map((voice) => voice.voice_id);
export const ALLOWED_VOICE_ID_SET = new Set(ALLOWED_VOICE_IDS);
export const VOICE_NAME_OVERRIDES = new Map(
  VOICE_CATALOG.map((voice) => [voice.voice_id, voice.name] as const)
);
export const VOICE_FALLBACK_BY_ID = new Map(
  VOICE_CATALOG.map((voice) => [voice.voice_id, voice] as const)
);

function normalizeVoiceField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatAttribute(value: unknown): string | null {
  const normalized = normalizeVoiceField(value);
  if (!normalized) return null;
  return normalized
    .toLowerCase()
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function normalizeSingleVoice(voice: ElevenLabsVoiceResponse): VoiceOption | null {
  if (!voice || typeof voice.voice_id !== "string" || voice.voice_id.length === 0) return null;
  if (!ALLOWED_VOICE_ID_SET.has(voice.voice_id)) return null;

  const fallback = VOICE_FALLBACK_BY_ID.get(voice.voice_id) ?? null;
  const overrideName = VOICE_NAME_OVERRIDES.get(voice.voice_id) ?? null;
  const apiName = normalizeVoiceField(voice.name);
  const name = overrideName ?? fallback?.name ?? apiName ?? voice.voice_id;

  return {
    voice_id: voice.voice_id,
    name,
    accent: formatAttribute(voice.accent) ?? fallback?.accent ?? null,
    gender: formatAttribute(voice.gender) ?? fallback?.gender ?? null,
    age: formatAttribute(voice.age) ?? fallback?.age ?? null,
    description: normalizeVoiceField(voice.description) ?? fallback?.description ?? null,
    preview_url: normalizeVoiceField(voice.preview_url) ?? fallback?.preview_url ?? null,
  };
}

export function normalizeVoiceOptions(
  rawVoices: ReadonlyArray<ElevenLabsVoiceResponse>
): VoiceOption[] {
  const normalizedById = new Map<string, VoiceOption>();
  rawVoices.forEach((voice) => {
    const normalized = normalizeSingleVoice(voice);
    if (normalized) {
      normalizedById.set(normalized.voice_id, normalized);
    }
  });

  return ALLOWED_VOICE_IDS.map((voiceId) => normalizedById.get(voiceId))
    .filter((voice): voice is VoiceOption => Boolean(voice));
}
