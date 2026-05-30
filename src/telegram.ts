import { Telegraf } from "telegraf";
import { Config, Message } from "./types.js";
import { Provider } from "./providers/index.js";
import { loadTelegramHistory, saveTelegramHistory } from "./history.js";
import { updateConfig } from "./config.js";
import { trackUsage } from "./metrics.js";

const TELEGRAM_MAX_MESSAGE_LENGTH = 3900;

function parseUserIds(raw: string): number[] {
  return raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
}

function getCommandText(message: unknown): string {
  if (typeof message === "object" && message !== null && "text" in message) {
    const value = (message as { text?: unknown }).text;
    return typeof value === "string" ? value : "";
  }
  return "";
}

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

  const isAdmin = (userId: number): boolean => {
    return !!config.telegram?.adminUserIds?.includes(userId);
  };

  bot.start(async (ctx) => {
    if (!isAllowed(ctx.from.id)) {
      return ctx.reply("⛔ Unauthorized.");
    }
    const persisted = config.telegram?.historyEnabled ? await loadTelegramHistory(ctx.from.id) : [];
    conversationHistory.set(ctx.from.id, persisted);
    return ctx.reply(
      "👋 Hello! I'm ewpo AI.\n\nSend me a message and I'll reply.\n/clear - Reset conversation\n/help - Show commands"
    );
  });

  bot.help((ctx) => {
    ctx.reply(
      "Commands:\n/start - Start fresh conversation\n/clear - Reset history\n/status - Show settings\n/admin_allow <id1,id2>\n/admin_deny <id1,id2>\nAny text - Chat with AI"
    );
  });

  bot.command("status", (ctx) => {
    const allowed = config.telegram?.allowedUserIds?.join(", ") ?? "all";
    const admins = config.telegram?.adminUserIds?.join(", ") ?? "none";
    ctx.reply(`Provider: ${config.provider}\nAllowed: ${allowed}\nAdmins: ${admins}`);
  });

  bot.command("admin_allow", async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return ctx.reply("⛔ Admin only.");
    }
    const text = getCommandText(ctx.message);
    const ids = parseUserIds(text.replace("/admin_allow", "").trim());
    const current = new Set(config.telegram?.allowedUserIds ?? []);
    ids.forEach((id) => current.add(id));
    const allowedUserIds = [...current];
    updateConfig({ telegram: { ...(config.telegram ?? { token: "" }), allowedUserIds } });
    if (config.telegram) config.telegram.allowedUserIds = allowedUserIds;
    return ctx.reply(`✅ Allowed users updated: ${allowedUserIds.join(", ")}`);
  });

  bot.command("admin_deny", async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
      return ctx.reply("⛔ Admin only.");
    }
    const text = getCommandText(ctx.message);
    const denyIds = new Set(parseUserIds(text.replace("/admin_deny", "").trim()));
    const allowedUserIds = (config.telegram?.allowedUserIds ?? []).filter((id) => !denyIds.has(id));
    updateConfig({ telegram: { ...(config.telegram ?? { token: "" }), allowedUserIds } });
    if (config.telegram) config.telegram.allowedUserIds = allowedUserIds;
    return ctx.reply(`✅ Allowed users updated: ${allowedUserIds.join(", ") || "none"}`);
  });

  bot.command("clear", async (ctx) => {
    conversationHistory.delete(ctx.from.id);
    if (config.telegram?.historyEnabled) {
      await saveTelegramHistory(ctx.from.id, []);
    }
    await ctx.reply("🧹 Conversation reset.");
  });

  bot.on("text", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return;

    const userId = ctx.from.id;
    const userMessage = ctx.message.text;

    if (!conversationHistory.has(userId)) {
      const persisted = config.telegram?.historyEnabled ? await loadTelegramHistory(userId) : [];
      conversationHistory.set(userId, persisted);
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
      if (config.telegram?.historyEnabled) {
        await saveTelegramHistory(userId, history);
      }

      await trackUsage(config);
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      if (!fullResponse.trim()) {
        await ctx.reply("⚠️ Empty response from provider.");
        return;
      }
      if (fullResponse.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
        await ctx.reply(fullResponse);
      } else {
        for (let i = 0; i < fullResponse.length; i += TELEGRAM_MAX_MESSAGE_LENGTH) {
          await ctx.reply(fullResponse.slice(i, i + TELEGRAM_MAX_MESSAGE_LENGTH));
        }
      }
    } catch (err: any) {
      const message = `❌ Error: ${err?.message ?? "Unknown error"}`;
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          undefined,
          message
        );
      } catch {
        await ctx.reply(message);
      }
    }
  });

  bot.launch();
  console.log("🤖 Telegram bot is running...");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
