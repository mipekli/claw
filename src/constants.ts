export const SUPPORTED_PROVIDERS = ["anthropic", "openai", "openrouter"] as const;

export const DEFAULT_MODELS: Record<(typeof SUPPORTED_PROVIDERS)[number], string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  openrouter: "openai/gpt-4o",
};

export const KNOWN_MODELS: Record<(typeof SUPPORTED_PROVIDERS)[number], string[]> = {
  anthropic: ["claude-3-5-haiku-latest", "claude-sonnet-4-20250514"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  openrouter: ["openai/gpt-4o-mini", "openai/gpt-4o", "anthropic/claude-3.5-sonnet"],
};

export const EXIT_CODES = {
  SUCCESS: 0,
  INVALID_INPUT: 2,
  CONFIG_ERROR: 3,
  PROVIDER_ERROR: 4,
  RUNTIME_ERROR: 10,
} as const;
