import { Telegraf } from "telegraf";
import { Config, Message } from "./types.js";
import { Provider } from "./providers/index.js";
import { loadTelegramHistory, saveTelegramHistory } from "./history.js";
import { updateConfig } from "./config.js";
import { trackUsage } from "./metrics.js";
import { parseDateTime } from "./timeParser.js";
import {
  addTask,
  completeTask,
  assignTask,
  getTasks,
  addReminder,
  checkAndSendReminders,
} from "./taskManager.js";

// Telegram hard limit is 4096, keep small buffer for safety around formatting/encoding.
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
      "👋 Merhaba! Günlük görev ve hatırlatıcı asistanına hoş geldiniz.\n\nYapabileceğiniz bazı şeyler:\n" +
        "• Doğal dilde görev veya hatırlatıcı oluşturmak için benimle sohbet edin.\n" +
        "• Komutları kullanarak hızlıca işlem yapın.\n\n" +
        "/help - Tüm komutları gösterir\n" +
        "/clear - Sohbet geçmişini sıfırlar"
    );
  });

  bot.help((ctx) => {
    ctx.reply(
      "📋 **Komut Listesi:**\n\n" +
        "/todo <görev başlığı> - Yeni bir görev ekler\n" +
        "/tasks - Aktif/bekleyen görevleri listeler\n" +
        "/done <görev_id> - Görevi tamamlandı olarak işaretler\n" +
        "/assign <görev_id> <kişi> - Görevi birine atar\n" +
        "/remind <görev_id> <süre/zaman> - Göreve hatırlatıcı ekler (Örn: `/remind 1 10m`)\n" +
        "/remind <metin> <süre/zaman> - Serbest hatırlatıcı ekler (Örn: `/remind Süt al 1h`)\n" +
        "/status - Bot durumunu gösterir\n" +
        "/clear - Sohbet geçmişini temizler\n\n" +
        "**Zaman Formatları:** `10s` (saniye), `5m` (dakika), `2h` (saat), `1d` (gün), `15:30` (saat), `YYYY-MM-DD HH:MM` (tarih ve saat)",
      { parse_mode: "Markdown" }
    );
  });

  bot.command("status", (ctx) => {
    if (!isAllowed(ctx.from.id)) return ctx.reply("⛔ Unauthorized.");
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
    if (!isAllowed(ctx.from.id)) return ctx.reply("⛔ Unauthorized.");
    conversationHistory.delete(ctx.from.id);
    if (config.telegram?.historyEnabled) {
      await saveTelegramHistory(ctx.from.id, []);
    }
    await ctx.reply("🧹 Conversation reset.");
  });

  // Hızlı Görev / Hatırlatıcı Komut İşleyicileri
  bot.command("todo", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return ctx.reply("⛔ Unauthorized.");
    const text = getCommandText(ctx.message).replace(/^\/todo\s*/i, "").trim();
    if (!text) {
      return ctx.reply("Lütfen görev başlığını girin. Örnek: `/todo Raporu hazırla`", { parse_mode: "Markdown" });
    }
    const task = addTask(ctx.chat.id, text, ctx.from.first_name || ctx.from.username || "Kullanıcı");
    return ctx.reply(`✅ Görev oluşturuldu (ID: ${task.id}):\n**${task.title}**`, { parse_mode: "Markdown" });
  });

  bot.command("tasks", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return ctx.reply("⛔ Unauthorized.");
    const tasks = getTasks(ctx.chat.id);
    const pending = tasks.filter((t) => t.status === "pending");
    if (pending.length === 0) {
      return ctx.reply("Sürecinizde aktif bir görev bulunmamaktadır. 🎉");
    }
    const listText = pending
      .map((t) => {
        const assigned = t.assignedTo ? ` (Atanan: ${t.assignedTo})` : "";
        return `- **[ID: ${t.id}]** ${t.title}${assigned}`;
      })
      .join("\n");
    return ctx.reply(`📋 **Aktif Görevler:**\n\n${listText}`, { parse_mode: "Markdown" });
  });

  bot.command("done", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return ctx.reply("⛔ Unauthorized.");
    const text = getCommandText(ctx.message).replace(/^\/done\s*/i, "").trim();
    const taskId = parseInt(text, 10);
    if (isNaN(taskId)) {
      return ctx.reply("Lütfen tamamlamak istediğiniz görevin ID'sini girin. Örnek: `/done 1`", { parse_mode: "Markdown" });
    }
    const completed = completeTask(ctx.chat.id, taskId);
    if (!completed) {
      return ctx.reply(`ID'si ${taskId} olan aktif bir görev bulunamadı.`);
    }
    return ctx.reply(`✅ Görev tamamlandı olarak işaretlendi (ID: ${completed.id}):\n**${completed.title}**`, {
      parse_mode: "Markdown",
    });
  });

  bot.command("assign", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return ctx.reply("⛔ Unauthorized.");
    const text = getCommandText(ctx.message).replace(/^\/assign\s*/i, "").trim();
    const match = text.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      return ctx.reply("Lütfen doğru formatta girin. Örnek: `/assign 1 Ahmet` veya `/assign 1 @ahmet`", {
        parse_mode: "Markdown",
      });
    }
    const taskId = parseInt(match[1], 10);
    const assignedTo = match[2].trim();
    const updated = assignTask(ctx.chat.id, taskId, assignedTo);
    if (!updated) {
      return ctx.reply(`ID'si ${taskId} olan aktif bir görev bulunamadı.`);
    }
    return ctx.reply(`✅ Görev ${assignedTo} kişisine atandı (ID: ${updated.id}):\n**${updated.title}**`, {
      parse_mode: "Markdown",
    });
  });

  bot.command("remind", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return ctx.reply("⛔ Unauthorized.");
    const text = getCommandText(ctx.message).replace(/^\/remind\s*/i, "").trim();

    // 1. Durum: /remind <id> <zaman>
    const matchTaskId = text.match(/^(\d+)\s+(.+)$/);
    if (matchTaskId) {
      const taskId = parseInt(matchTaskId[1], 10);
      const timeStr = matchTaskId[2].trim();
      const tasks = getTasks(ctx.chat.id);
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        const date = parseDateTime(timeStr);
        if (!date) {
          return ctx.reply(
            "Zaman formatı anlaşılamadı. Örnekler: `10m`, `2h`, `1d`, `15:30`, `2026-06-04 15:30` veya ISO string."
          );
        }
        addReminder(ctx.chat.id, task.id, `Görev hatırlatması: ${task.title}`, date, ctx.from.id);
        return ctx.reply(
          `✅ Görev ${task.id} için hatırlatıcı kuruldu:\n📅 **${date.toLocaleString("tr-TR")}**`,
          { parse_mode: "Markdown" }
        );
      }
    }

    // 2. Durum: /remind <metin> <zaman> (Metin ve son kelime olarak süre)
    const lastSpaceIndex = text.lastIndexOf(" ");
    if (lastSpaceIndex !== -1) {
      const reminderText = text.slice(0, lastSpaceIndex).trim();
      const timeStr = text.slice(lastSpaceIndex + 1).trim();
      const date = parseDateTime(timeStr);
      if (date) {
        addReminder(ctx.chat.id, null, reminderText, date, ctx.from.id);
        return ctx.reply(`✅ Hatırlatıcı kuruldu: "${reminderText}"\n📅 **${date.toLocaleString("tr-TR")}**`, {
          parse_mode: "Markdown",
        });
      }
    }

    return ctx.reply(
      "Lütfen doğru formatta girin.\nÖrnekler:\n" +
        "- `/remind 1 10m` (ID'si 1 olan görev için 10 dk sonraya)\n" +
        "- `/remind Süt al 1h` (Süt al uyarısı için 1 saat sonraya)\n" +
        "- `/remind Toplantı var 15:30` (Bugün/Yarın 15:30'a)",
      { parse_mode: "Markdown" }
    );
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

    const loadingMsg = await ctx.reply("⏳ Düşünüyorum...");

    try {
      const currentDateTime = new Date().toLocaleString("tr-TR");
      const enrichedSystemPrompt = `${config.systemPrompt || "You are a helpful, concise AI assistant. Reply in the user's language."}

[TASK MANAGER SYSTEM INSTRUCTIONS]
Görev ve hatırlatıcı ekleme/güncelleme/listeleme istekleri alırsan, normal doğal dil cevabına ek olarak mutlaka aşağıdaki formatta :::action JSON bloğu ekle. Birden fazla aksiyon varsa alt alta ekleyebilirsin.
Şu anki yerel zaman: ${currentDateTime}

Desteklenen Aksiyonlar:
1. Görev Ekleme:
:::action
{
  "type": "add_task",
  "params": {
    "title": "Görev başlığı",
    "assignedTo": "atanan_kisi_opsiyonel"
  }
}
:::

2. Görevi Tamamlama:
:::action
{
  "type": "complete_task",
  "params": {
    "id": 123
  }
}
:::

3. Görevi Atama:
:::action
{
  "type": "assign_task",
  "params": {
    "id": 123,
    "assignedTo": "Ahmet"
  }
}
:::

4. Hatırlatıcı Ekleme:
(Zaman parametresini (remindAt) mutlaka yukarıdaki güncel yerel zamana göre hesaplayıp ISO 8601 formatında ver (Örn: '2026-06-04T15:30:00+03:00'). Eğer görev ile ilişkili ise taskId ekle, değilse taskId null olsun.)
:::action
{
  "type": "add_reminder",
  "params": {
    "taskId": 123,
    "text": "Hatırlatıcı metni",
    "remindAt": "2026-06-04T15:30:00+03:00"
  }
}
:::

Yanıtında :::action bloğunu en sonda veya metin içinde herhangi bir yerde belirtebilirsin. Kullanıcı bu JSON bloklarını doğrudan görmeyecektir, sistem bunları ayrıştırıp çalıştıracak ve temizleyecektir.
`;

      let fullResponse = "";
      for await (const chunk of provider.sendMessage(history, enrichedSystemPrompt)) {
        fullResponse += chunk;
      }

      // Aksiyon bloklarını ayıkla ve çalıştır
      const actionRegex = /:::action\s*(\{[\s\S]*?\})\s*:::/g;
      let cleanResponse = fullResponse;
      let match;
      const actions: any[] = [];

      actionRegex.lastIndex = 0;
      while ((match = actionRegex.exec(fullResponse)) !== null) {
        try {
          const actionJson = JSON.parse(match[1]);
          actions.push(actionJson);
        } catch (e) {
          console.error("Action JSON parse error:", e, match[1]);
        }
      }

      // JSON bloklarını sohbet mesajından temizle
      cleanResponse = cleanResponse.replace(actionRegex, "").trim();

      const actionStatusMessages: string[] = [];
      for (const action of actions) {
        try {
          switch (action.type) {
            case "add_task": {
              const { title, assignedTo } = action.params;
              const task = addTask(ctx.chat.id, title, ctx.from.first_name || ctx.from.username || "Kullanıcı", assignedTo);
              actionStatusMessages.push(`📝 Görev oluşturuldu (ID: ${task.id}): "${task.title}"${task.assignedTo ? ` -> Atanan: ${task.assignedTo}` : ""}`);
              break;
            }
            case "complete_task": {
              const id = Number(action.params.id);
              const completed = completeTask(ctx.chat.id, id);
              if (completed) {
                actionStatusMessages.push(`✅ Görev tamamlandı (ID: ${completed.id}): "${completed.title}"`);
              } else {
                actionStatusMessages.push(`❌ Görev bulunamadı (ID: ${id})`);
              }
              break;
            }
            case "assign_task": {
              const id = Number(action.params.id);
              const { assignedTo } = action.params;
              const updated = assignTask(ctx.chat.id, id, assignedTo);
              if (updated) {
                actionStatusMessages.push(`👥 Görev atandı (ID: ${updated.id}): "${updated.title}" -> ${assignedTo}`);
              } else {
                actionStatusMessages.push(`❌ Görev bulunamadı (ID: ${id})`);
              }
              break;
            }
            case "add_reminder": {
              const { taskId, text: reminderText, remindAt } = action.params;
              const date = new Date(remindAt);
              if (isNaN(date.getTime())) {
                actionStatusMessages.push(`❌ Geçersiz tarih/saat: ${remindAt}`);
              } else {
                addReminder(ctx.chat.id, taskId ? Number(taskId) : null, reminderText, date, ctx.from.id);
                actionStatusMessages.push(`🔔 Hatırlatıcı kuruldu: "${reminderText}"\n📅 Tarih: ${date.toLocaleString("tr-TR")}`);
              }
              break;
            }
            default:
              console.warn("Unknown action type:", action.type);
          }
        } catch (err: any) {
          actionStatusMessages.push(`⚠️ Aksiyon hatası (${action.type}): ${err?.message || "Bilinmeyen hata"}`);
        }
      }

      // Aksiyon bildirimlerini mesaja ekle
      if (actionStatusMessages.length > 0) {
        if (cleanResponse) {
          cleanResponse += "\n\n" + actionStatusMessages.map((m) => `_ ${m} _`).join("\n");
        } else {
          cleanResponse = actionStatusMessages.map((m) => `_ ${m} _`).join("\n");
        }
      }

      history.push({ role: "assistant", content: cleanResponse });
      if (config.telegram?.historyEnabled) {
        await saveTelegramHistory(userId, history);
      }

      await trackUsage(config);
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      if (!cleanResponse.trim()) {
        await ctx.reply("⚠️ Boş yanıt veya tüm aksiyonlar tamamlandı.");
        return;
      }
      if (cleanResponse.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
        await ctx.reply(cleanResponse, { parse_mode: "Markdown" });
      } else {
        for (let i = 0; i < cleanResponse.length; i += TELEGRAM_MAX_MESSAGE_LENGTH) {
          await ctx.reply(cleanResponse.slice(i, i + TELEGRAM_MAX_MESSAGE_LENGTH), { parse_mode: "Markdown" });
        }
      }
    } catch (err: any) {
      const message = `❌ Hata: ${err?.message ?? "Bilinmeyen bir hata oluştu"}`;
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, message);
      } catch {
        await ctx.reply(message);
      }
    }
  });

  bot.launch();
  console.log("🤖 Telegram bot is running...");

  // Arka planda her 30 saniyede bir hatırlatıcıları tara
  const reminderInterval = setInterval(async () => {
    try {
      await checkAndSendReminders(bot);
    } catch (err) {
      console.error("Error checking reminders:", err);
    }
  }, 30000);

  process.once("SIGINT", () => {
    clearInterval(reminderInterval);
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    clearInterval(reminderInterval);
    bot.stop("SIGTERM");
  });
}
