#!/usr/bin/env node

import "dotenv/config";
import { getConfig, setupInteractive, setModel, setProvider } from "./config.js";
import { createProvider } from "./providers/index.js";
import { startTelegramBot } from "./telegram.js";
import { loadAskInput, parseAskArgs, startCLIChat } from "./cli.js";
import { AppError } from "./errors.js";
import { EXIT_CODES, KNOWN_MODELS, SUPPORTED_PROVIDERS } from "./constants.js";
import { validateConfig } from "./validation.js";

const command = process.argv[2];

function printHelp(): void {
  console.log(`
ewpo - AI CLI & Telegram Bot

Usage:
  ewpo [--help]                          Start interactive chat
  ewpo ask <question> [--file <path>]    Ask a question
  ewpo telegram                          Start Telegram bot mode
  ewpo setup | init                      Configure API keys and settings
  ewpo config                            Show current configuration
  ewpo provider list | set <provider>    Manage provider
  ewpo model list | set <model>          Manage model
`);
}

async function handleAsk(): Promise<void> {
  const parsed = parseAskArgs(process.argv.slice(3));
  const question = await loadAskInput(parsed);
  const config = getConfig();
  validateConfig(config);
  const provider = createProvider(config);
  let response = "";
  for await (const chunk of provider.sendMessage(
    [{ role: "user", content: question }],
    config.systemPrompt
  )) {
    response += chunk;
    process.stdout.write(chunk);
  }
  if (response) console.log();
}

async function handleProviderCommand(): Promise<void> {
  const action = process.argv[3];
  if (action === "list") {
    console.log(SUPPORTED_PROVIDERS.join("\n"));
    return;
  }
  if (action === "set") {
    const provider = process.argv[4] as any;
    if (!provider) {
      throw new AppError("Usage: ewpo provider set <provider>", EXIT_CODES.INVALID_INPUT);
    }
    setProvider(provider);
    console.log(`Provider set to: ${provider}`);
    return;
  }
  throw new AppError("Usage: ewpo provider list | set <provider>", EXIT_CODES.INVALID_INPUT);
}

async function handleModelCommand(): Promise<void> {
  const action = process.argv[3];
  const cfg = getConfig();
  if (action === "list") {
    const models = KNOWN_MODELS[cfg.provider] ?? [];
    console.log(models.join("\n"));
    return;
  }
  if (action === "set") {
    const model = process.argv[4];
    if (!model) {
      throw new AppError("Usage: ewpo model set <model>", EXIT_CODES.INVALID_INPUT);
    }
    setModel(model);
    console.log(`Model set to: ${model}`);
    return;
  }
  throw new AppError("Usage: ewpo model list | set <model>", EXIT_CODES.INVALID_INPUT);
}

async function main(): Promise<number> {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return EXIT_CODES.SUCCESS;
  }

  switch (command) {
    case "setup":
    case "init": {
      await setupInteractive();
      return EXIT_CODES.SUCCESS;
    }
    case "config": {
      const cfg = getConfig();
      console.log(JSON.stringify(cfg, null, 2));
      return EXIT_CODES.SUCCESS;
    }
    case "ask": {
      await handleAsk();
      return EXIT_CODES.SUCCESS;
    }
    case "telegram": {
      const config = getConfig();
      validateConfig(config);
      const provider = createProvider(config);
      startTelegramBot(config, provider);
      return EXIT_CODES.SUCCESS;
    }
    case "provider": {
      await handleProviderCommand();
      return EXIT_CODES.SUCCESS;
    }
    case "model": {
      await handleModelCommand();
      return EXIT_CODES.SUCCESS;
    }
    default: {
      const config = getConfig();
      validateConfig(config);
      const provider = createProvider(config);
      await startCLIChat(provider, config.systemPrompt);
      return EXIT_CODES.SUCCESS;
    }
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    if (err instanceof AppError) {
      console.error(`❌ ${err.message}`);
      process.exit(err.exitCode);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`❌ ${message}`);
    process.exit(EXIT_CODES.RUNTIME_ERROR);
  });
