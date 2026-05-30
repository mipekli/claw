import { Config, ProviderConfig } from "../types.js";
import { Provider } from "./interface.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { AppError } from "../errors.js";
import { EXIT_CODES } from "../constants.js";

export type { Provider } from "./interface.js";

export function createProvider(config: Config): Provider {
  const providerName = config.provider;
  const providerConfig = config[providerName] as ProviderConfig | undefined;

  if (!providerConfig?.apiKey) {
    throw new AppError(
      `Missing API key for provider '${providerName}'. Run 'ewpo setup' to configure.`,
      EXIT_CODES.CONFIG_ERROR
    );
  }

  switch (providerName) {
    case "anthropic":
      return new AnthropicProvider(providerConfig);
    case "openai":
    case "openrouter":
      return new OpenAIProvider(providerConfig);
    default:
      throw new AppError(`Unsupported provider: ${providerName}`, EXIT_CODES.INVALID_INPUT);
  }
}
