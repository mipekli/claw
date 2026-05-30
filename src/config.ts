import Conf from "conf";
import { Config, ProviderConfig } from "./types.js";
import { DEFAULT_MODELS, SUPPORTED_PROVIDERS } from "./constants.js";
import { AppError } from "./errors.js";
import { isSupportedProvider } from "./validation.js";

const configStore = new Conf<Config>({
  projectName: "ewpo",
  defaults: {
    provider: "anthropic",
    systemPrompt: "You are a helpful, concise AI assistant. Reply in the user's language.",
    debug: false,
  },
});

export function getConfig(): Config {
  return configStore.store;
}

export function updateConfig(partial: Partial<Config>): void {
  configStore.set(partial);
}

export async function setupInteractive(): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (q: string): Promise<string> =>
    new Promise((r) => rl.question(q, r));

  console.log("\n🔧 ewpo setup\n");

  const providerInput = ((await ask("AI provider (anthropic/openai/openrouter): ")) || "anthropic").trim();
  if (!isSupportedProvider(providerInput)) {
    throw new AppError(`Unsupported provider: ${providerInput}`);
  }
  const provider = providerInput as Config["provider"];
  const apiKey = await ask(`API key for ${provider}: `);
  if (!apiKey.trim()) {
    throw new AppError("API key cannot be empty.");
  }

  const model = (await ask(`Model (default: ${DEFAULT_MODELS[provider]}): `)) || DEFAULT_MODELS[provider];
  const maxTokensInput = await ask("Max tokens (default: 4096): ");
  const timeoutInput = await ask("Timeout ms (default: 120000): ");
  const retryInput = await ask("Retry count (default: 1): ");

  let baseUrl: string | undefined;
  if (provider === "openrouter") {
    baseUrl = "https://openrouter.ai/api/v1";
  }

  const hasTelegram = (await ask("Setup Telegram bot? (y/N): ")).toLowerCase() === "y";
  let telegramToken: string | undefined;
  if (hasTelegram) {
    telegramToken = await ask("Telegram bot token: ");
  }

  const debug = (await ask("Enable debug logs? (y/N): ")).toLowerCase() === "y";

  const providerCfg: ProviderConfig = {
    apiKey,
    model,
    maxTokens: maxTokensInput ? Number(maxTokensInput) : 4096,
    timeoutMs: timeoutInput ? Number(timeoutInput) : 120000,
    retryCount: retryInput ? Number(retryInput) : 1,
    ...(baseUrl ? { baseUrl } : {}),
  };
  const update: Partial<Config> = {
    provider,
    debug,
    [provider]: providerCfg,
  };
  if (telegramToken) {
    const adminUsersInput = await ask("Admin user IDs (comma separated, optional): ");
    const adminUserIds = adminUsersInput
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
    update.telegram = { token: telegramToken, adminUserIds, historyEnabled: true };
  }

  configStore.set(update);

  rl.close();
  console.log("\n✅ Configuration saved.\n");
}

export function setProvider(provider: Config["provider"]): void {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new AppError(`Unsupported provider: ${provider}`);
  }
  const current = getConfig();
  const update: Partial<Config> = { provider };
  if (!current[provider]) {
    update[provider] = {
      apiKey: "",
      model: DEFAULT_MODELS[provider],
    };
  }
  configStore.set(update);
}

export function setModel(model: string): void {
  const cfg = getConfig();
  const provider = cfg.provider;
  const current = cfg[provider];
  if (!current) {
    throw new AppError(`Provider '${provider}' is not configured yet.`);
  }
  configStore.set({
    [provider]: {
      ...current,
      model,
    },
  } as Partial<Config>);
}
