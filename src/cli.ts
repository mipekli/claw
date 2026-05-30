import { Provider } from "./providers/index.js";
import { Message } from "./types.js";

export async function startCLIChat(provider: Provider, systemPrompt?: string): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\n╰─> ",
  });

  const history: Message[] = [];
  const ask = (q: string): Promise<string> => new Promise((r) => rl.question(q, r));

  console.log(`\n🧠 ewpo AI (${provider.name})`);
  console.log("Type 'exit' to quit, 'clear' to reset history.\n");

  while (true) {
    const input = await ask("╭─ You\n");
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === "exit") break;
    if (trimmed === "clear") {
      history.length = 0;
      console.log("┃ 🧹 History cleared.\n");
      continue;
    }

    history.push({ role: "user", content: trimmed });
    process.stdout.write("╭─ ewpo\n");

    let full = "";
    try {
      for await (const chunk of provider.sendMessage(history, systemPrompt)) {
        full += chunk;
        process.stdout.write(chunk);
      }
    } catch (err: any) {
      console.log(`\n┃ ❌ ${err.message}`);
      continue;
    }

    history.push({ role: "assistant", content: full });
    console.log("\n╰─ End\n");
  }

  rl.close();
}
