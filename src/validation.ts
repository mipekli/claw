import { DEFAULT_MODELS, SUPPORTED_PROVIDERS } from "./constants.js";
import { AppError } from "./errors.js";
import { Config } from "./types.js";

export function isSupportedProvider(provider: string): provider is Config["provider"] {
  return SUPPORTED_PROVIDERS.includes(provider as Config["provider"]);
}

export function getDefaultModel(provider: Config["provider"]): string {
  return DEFAULT_MODELS[provider];
}

export function validateConfig(config: Config): void {
  if (!isSupportedProvider(config.provider)) {
    throw new AppError(`Unsupported provider: ${config.provider}`);
  }
  if (!config[config.provider]?.apiKey) {
    throw new AppError(`Missing API key for provider '${config.provider}'.`);
  }
  if (!config[config.provider]?.model) {
    throw new AppError(`Missing model for provider '${config.provider}'.`);
  }
}
