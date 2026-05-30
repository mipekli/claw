import fs from "node:fs/promises";
import { createProvider, Provider } from "./providers/index.js";
import { Message } from "./types.js";
import { getConfig, setModel, setProvider } from "./config.js";
import { AppError } from "./errors.js";
import { EXIT_CODES, SUPPORTED_PROVIDERS } from "./constants.js";
import { loadCliHistory, saveCliHistory, listCliHistories } from "./history.js";
import { trackUsage } from "./metrics.js";
import { debugLog } from "./logger.js";
import { isSupportedProvider } from "./validation.js";

export async function startCLIChat(provider: Provider, systemPrompt?: string): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\n╰─> ",
  });

  let history: Message[] = [];
  let activeProvider = provider;
  const ask = (q: string): Promise<string> => new Promise((r) => rl.question(q, r));

  console.log(`\n🧠 ewpo AI (${activeProvider.name})`);
  console.log("Type 'exit' to quit.");
  console.log("Commands: /clear /save <name> /load <name> /model <name> /provider <name> /history /help");
  console.log("Multiline: enter \"\"\" and finish with another \"\"\".");
  console.log("File prompt: use @/absolute/path/to/file.txt\n");

  while (true) {
    let input = await ask("╭─ You\n");
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === "exit") break;
    if (trimmed === "/help") {
      console.log("Commands: /clear /save <name> /load <name> /model <name> /provider <name> /history");
      continue;
    }
    if (trimmed === "/clear") {
      history = [];
      console.log("┃ 🧹 History cleared.\n");
      continue;
    }
    if (trimmed === "/history") {
      const saved = await listCliHistories();
      console.log(saved.length ? `┃ Saved sessions: ${saved.join(", ")}` : "┃ No saved sessions.");
      continue;
    }
    if (trimmed.startsWith("/save ")) {
      const name = trimmed.slice(6).trim();
      if (!name) {
        console.log("┃ ❌ Usage: /save <name>");
        continue;
      }
      const file = await saveCliHistory(name, history);
      console.log(`┃ 💾 Saved: ${file}`);
      continue;
    }
    if (trimmed.startsWith("/load ")) {
      const name = trimmed.slice(6).trim();
      if (!name) {
        console.log("┃ ❌ Usage: /load <name>");
        continue;
      }
      try {
        history = await loadCliHistory(name);
        console.log(`┃ 📂 Loaded '${name}' (${history.length} messages).`);
      } catch {
        console.log("┃ ❌ Could not load session.");
      }
      continue;
    }
    if (trimmed.startsWith("/model ")) {
      const model = trimmed.slice(7).trim();
      if (!model) {
        console.log("┃ ❌ Usage: /model <name>");
        continue;
      }
      try {
        setModel(model);
        const cfg = getConfig();
        activeProvider = createProvider(cfg);
        console.log(`┃ ✅ Model set to '${model}'.`);
      } catch (err: any) {
        console.log(`┃ ❌ ${err.message}`);
      }
      continue;
    }
    if (trimmed.startsWith("/provider ")) {
      const next = trimmed.slice(10).trim();
      if (!isSupportedProvider(next)) {
        console.log(`┃ ❌ Unsupported provider. Use: ${SUPPORTED_PROVIDERS.join(", ")}`);
        continue;
      }
      try {
        setProvider(next);
        const cfg = getConfig();
        activeProvider = createProvider(cfg);
        console.log(`┃ ✅ Provider set to '${next}'.`);
      } catch (err: any) {
        console.log(`┃ ❌ ${err.message}`);
      }
      continue;
    }

    if (trimmed === `"""`) {
      const lines: string[] = [];
      while (true) {
        const line = await ask("");
        if (line.trim() === `"""`) break;
        lines.push(line);
      }
      input = lines.join("\n");
    }

    const normalizedInput = input.trim();
    if (normalizedInput.startsWith("@")) {
      const filePath = normalizedInput.slice(1).trim();
      try {
        input = await fs.readFile(filePath, "utf8");
      } catch {
        console.log("┃ ❌ File could not be read.");
        continue;
      }
    }

    const userText = input.trim();
    history.push({ role: "user", content: userText });
    process.stdout.write("╭─ ewpo\n");

    let full = "";
    try {
      const cfg = getConfig();
      debugLog(cfg, "Sending message with", { provider: cfg.provider, model: cfg[cfg.provider]?.model });
      for await (const chunk of activeProvider.sendMessage(history, systemPrompt)) {
        full += chunk;
        process.stdout.write(chunk);
      }
      await trackUsage(cfg);
    } catch (err: any) {
      console.log(`\n┃ ❌ ${err.message}`);
      continue;
    }

    history.push({ role: "assistant", content: full });
    console.log("\n╰─ End\n");
  }

  rl.close();
}

export function parseAskArgs(argv: string[]): { question?: string; filePath?: string } {
  if (!argv.length) return {};
  const fileIdx = argv.findIndex((v) => v === "--file" || v === "-f");
  if (fileIdx >= 0) {
    const filePath = argv[fileIdx + 1];
    const rest = argv.filter((_, idx) => idx !== fileIdx && idx !== fileIdx + 1).join(" ");
    return { question: rest || undefined, filePath };
  }
  return { question: argv.join(" ") };
}

export async function loadAskInput(
  parsed: { question?: string; filePath?: string }
): Promise<string> {
  const chunks: string[] = [];
  if (parsed.question) chunks.push(parsed.question);
  if (parsed.filePath) {
    try {
      chunks.push(await fs.readFile(parsed.filePath, "utf8"));
    } catch {
      throw new AppError(`Cannot read file: ${parsed.filePath}`, EXIT_CODES.INVALID_INPUT);
    }
  }
  const result = chunks.join("\n").trim();
  if (!result) {
    throw new AppError("Usage: ewpo ask <question> [--file <absolute-path>]", EXIT_CODES.INVALID_INPUT);
  }
  return result;
}
