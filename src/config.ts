import Conf from "conf";
import { Config, ProviderConfig } from "./types.js";

const configStore = new Conf<Config>({
  projectName: "ewpo",
  defaults: {
    provider: "anthropic",
    systemPrompt: "You are a helpful, concise AI assistant. Reply in the user's language.",
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

  const providerInput = (await ask("AI provider (anthropic/openai/openrouter): ")) || "anthropic";
  const provider = providerInput as Config["provider"];
  const apiKey = await ask(`API key for ${provider}: `);

  const defaultModels: Record<string, string> = {
    anthropic: "claude-sonnet-4-20250514",
    openai: "gpt-4o",
    openrouter: "openai/gpt-4o",
  };
  const model = (await ask(`Model (default: ${defaultModels[provider] || "gpt-4o"}): `)) || defaultModels[provider] || "gpt-4o";

  let baseUrl: string | undefined;
  if (provider === "openrouter") {
    baseUrl = "https://openrouter.ai/api/v1";
  }

  const hasTelegram = (await ask("Setup Telegram bot? (y/N): ")).toLowerCase() === "y";
  let telegramToken: string | undefined;
  if (hasTelegram) {
    telegramToken = await ask("Telegram bot token: ");
  }

  const providerCfg: ProviderConfig = baseUrl ? { apiKey, model, baseUrl } : { apiKey, model };
  const update: Partial<Config> = {
    provider,
    [provider]: providerCfg,
  };
  if (telegramToken) {
    update.telegram = { token: telegramToken };
  }
  configStore.set(update);

  rl.close();
  console.log("\n✅ Configuration saved.\n");
}
