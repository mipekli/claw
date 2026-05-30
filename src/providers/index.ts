import { Config, ProviderConfig } from "../types.js";
import { Provider } from "./interface.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";

export type { Provider } from "./interface.js";

export function createProvider(config: Config): Provider {
  const providerName = config.provider;
  const providerConfig = config[providerName] as ProviderConfig | undefined;

  if (!providerConfig?.apiKey) {
    throw new Error(
      `Missing API key for provider '${providerName}'. Run 'ewpo setup' to configure.`
    );
  }

  switch (providerName) {
    case "anthropic":
      return new AnthropicProvider(providerConfig);
    case "openai":
    case "openrouter":
      return new OpenAIProvider(providerConfig);
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }
}
