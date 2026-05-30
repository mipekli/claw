import { Telegraf } from "telegraf";
import { Config, Message } from "./types.js";
import { Provider } from "./providers/index.js";

export function startTelegramBot(config: Config, provider: Provider): void {
  if (!config.telegram?.token) {
    console.error("❌ No Telegram token configured. Run 'ewpo setup' first.");
    process.exit(1);
  }

  const bot = new Telegraf(config.telegram.token);
  const conversationHistory = new Map<number, Message[]>();

  const isAllowed = (userId: number): boolean => {
    if (!config.telegram?.allowedUserIds?.length) return true;
    return config.telegram.allowedUserIds.includes(userId);
  };

  bot.start((ctx) => {
    if (!isAllowed(ctx.from.id)) {
      return ctx.reply("⛔ Unauthorized.");
    }
    conversationHistory.delete(ctx.from.id);
    ctx.reply(
      "👋 Hello! I'm ewpo AI.\n\nSend me a message and I'll reply.\n/clear - Reset conversation\n/help - Show commands"
    );
  });

  bot.help((ctx) => {
    ctx.reply(
      "Commands:\n/start - Start fresh conversation\n/clear - Reset history\nAny text - Chat with AI"
    );
  });

  bot.command("clear", (ctx) => {
    conversationHistory.delete(ctx.from.id);
    ctx.reply("🧹 Conversation reset.");
  });

  bot.on("text", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return;

    const userId = ctx.from.id;
    const userMessage = ctx.message.text;

    if (!conversationHistory.has(userId)) {
      conversationHistory.set(userId, []);
    }
    const history = conversationHistory.get(userId)!;
    history.push({ role: "user", content: userMessage });

    const loadingMsg = await ctx.reply("⏳ Thinking...");

    try {
      let fullResponse = "";
      for await (const chunk of provider.sendMessage(history, config.systemPrompt)) {
        fullResponse += chunk;
      }

      history.push({ role: "assistant", content: fullResponse });
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

      const maxLen = 4000;
      if (fullResponse.length <= maxLen) {
        await ctx.reply(fullResponse);
      } else {
        for (let i = 0; i < fullResponse.length; i += maxLen) {
          await ctx.reply(fullResponse.slice(i, i + maxLen));
        }
      }
    } catch (err: any) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        undefined,
        `❌ Error: ${err.message}`
      );
    }
  });

  bot.launch();
  console.log("🤖 Telegram bot is running...");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
