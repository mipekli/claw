#!/usr/bin/env node

import { getConfig, updateConfig, setupInteractive } from "./config.js";
import { createProvider } from "./providers/index.js";
import { startTelegramBot } from "./telegram.js";
import { startCLIChat } from "./cli.js";
import { Message } from "./types.js";

const command = process.argv[2];

async function main() {
  if (!command || command === "help") {
    console.log(`
ewpo - AI CLI & Telegram Bot

Usage:
  ewpo                     Start interactive chat
  ewpo ask <question>      Ask a single question
  ewpo telegram            Start Telegram bot mode
  ewpo setup               Configure API keys and settings
  ewpo config              Show current configuration
`);
    return;
  }

  switch (command) {
    case "setup": {
      await setupInteractive();
      break;
    }

    case "config": {
      const cfg = getConfig();
      console.log(JSON.stringify(cfg, null, 2));
      break;
    }

    case "ask": {
      const question = process.argv.slice(3).join(" ");
      if (!question) {
        console.error("Usage: ewpo ask <question>");
        process.exit(1);
      }
      const config = getConfig();
      const provider = createProvider(config);
      let response = "";
      for await (const chunk of provider.sendMessage(
        [{ role: "user", content: question }],
        config.systemPrompt
      )) {
        response += chunk;
        process.stdout.write(chunk);
      }
      console.log();
      break;
    }

    case "telegram": {
      const config = getConfig();
      const provider = createProvider(config);
      startTelegramBot(config, provider);
      break;
    }

    default: {
      const config = getConfig();
      const provider = createProvider(config);
      await startCLIChat(provider, config.systemPrompt);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
