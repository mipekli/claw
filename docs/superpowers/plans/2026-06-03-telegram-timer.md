# Telegram Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) for syntax tracking.

**Goal:** Add persistent timer/reminder/scheduler to the ewpo Telegram bot

**Architecture:** A `TimerManager` class in `src/timer.ts` handles CRUD, 1s-interval worker loop, and JSON file persist. Six new Telegram commands register the timer operations. The `Timer` interface is added to `src/types.ts` and a `getTimerDataDir()` helper in `src/runtime.ts`.

**Tech Stack:** TypeScript, Telegraf, Node.js `fs/promises`, `crypto.randomUUID`

---

### Task 1: Add Timer type to types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add Timer interface**

Add to `src/types.ts` after the existing types:

```typescript
export interface Timer {
  id: string;
  userId: number;
  chatId: number;
  type: "remind" | "every" | "schedule";
  message: string;
  createdAt: number;
  nextRun: number;
  interval: number;
  recurring: boolean;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean exit, no errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Timer interface to types"
```

---

### Task 2: Add getTimerDataDir to runtime.ts

**Files:**
- Modify: `src/runtime.ts`

- [ ] **Step 1: Add getTimerDataDir function**

Add before the closing of the file:

```typescript
export function getTimerDataDir(): string {
  const dir = path.join(getAppDataDir(), "timers");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean exit

- [ ] **Step 3: Commit**

```bash
git add src/runtime.ts
git commit -m "feat: add getTimerDataDir to runtime"
```

---

### Task 3: Implement TimerManager in src/timer.ts

**Files:**
- Create: `src/timer.ts`
- Create: `src/__tests__/timer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/timer.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { TimerManager } from "../timer.js";

const testDir = path.join(os.tmpdir(), "ewpo-timer-test-" + Date.now());

function createManager() {
  return new TimerManager(testDir);
}

describe("TimerManager", () => {
  let manager: TimerManager;

  beforeEach(() => {
    manager = createManager();
  });

  afterEach(async () => {
    manager.stop();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should add a remind timer", async () => {
    const t = await manager.addTimer({
      userId: 1,
      chatId: 100,
      type: "remind",
      message: "test",
      interval: 60000,
      recurring: false,
    });
    expect(t.id).toBeTruthy();
    expect(t.userId).toBe(1);
    expect(t.type).toBe("remind");
  });

  it("should list timers for a user", async () => {
    await manager.addTimer({ userId: 1, chatId: 100, type: "remind", message: "a", interval: 60000, recurring: false });
    await manager.addTimer({ userId: 1, chatId: 100, type: "every", message: "b", interval: 3600000, recurring: true });
    await manager.addTimer({ userId: 2, chatId: 200, type: "remind", message: "c", interval: 60000, recurring: false });
    const list = manager.listTimers(1);
    expect(list).toHaveLength(2);
  });

  it("should remove a timer by id", async () => {
    const t = await manager.addTimer({ userId: 1, chatId: 100, type: "remind", message: "x", interval: 60000, recurring: false });
    const removed = manager.removeTimer(t.id);
    expect(removed).toBe(true);
    expect(manager.listTimers(1)).toHaveLength(0);
  });

  it("should clear all for a user", async () => {
    await manager.addTimer({ userId: 1, chatId: 100, type: "remind", message: "a", interval: 60000, recurring: false });
    await manager.addTimer({ userId: 1, chatId: 100, type: "every", message: "b", interval: 3600000, recurring: true });
    manager.clearAll(1);
    expect(manager.listTimers(1)).toHaveLength(0);
  });

  it("should return null for unknown id", () => {
    expect(manager.getTimer("nonexistent")).toBeNull();
  });

  it("should load saved timers from disk", async () => {
    const t = await manager.addTimer({ userId: 1, chatId: 100, type: "remind", message: "persist", interval: 60000, recurring: false });
    const manager2 = new TimerManager(testDir);
    await manager2.load();
    const loaded = manager2.getTimer(t.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.message).toBe("persist");
    manager2.stop();
  });

  it("should fire due timers via onFire callback", async () => {
    const fired: string[] = [];
    manager.onFire = (timer) => { fired.push(timer.id); };
    const t = await manager.addTimer({ userId: 1, chatId: 100, type: "remind", message: "instant", interval: 1, recurring: false });
    // Set nextRun in the past so it fires on next tick
    manager.updateNextRun(t.id, Date.now() - 1000);
    await new Promise((r) => setTimeout(r, 50));
    expect(fired).toContain(t.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/timer.test.ts`
Expected: FAIL - module not found for "../timer.js"

- [ ] **Step 3: Write TimerManager implementation**

Create `src/timer.ts`:

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Timer } from "./types.js";

const SAVE_FILE = "timers.json";

interface TimerInput {
  userId: number;
  chatId: number;
  type: Timer["type"];
  message: string;
  interval: number;
  recurring: boolean;
}

export class TimerManager {
  private timers: Map<string, Timer> = new Map();
  private worker: ReturnType<typeof setInterval> | null = null;
  private dataDir: string;
  private savePath: string;
  private dirty = false;
  private saveTimer: ReturnType<typeof setInterval> | null = null;

  onFire: ((timer: Timer) => void) | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.savePath = path.join(dataDir, SAVE_FILE);
  }

  async addTimer(input: TimerInput): Promise<Timer> {
    const timer: Timer = {
      id: crypto.randomUUID().slice(0, 8),
      userId: input.userId,
      chatId: input.chatId,
      type: input.type,
      message: input.message,
      createdAt: Date.now(),
      nextRun: Date.now() + input.interval,
      interval: input.interval,
      recurring: input.recurring,
    };
    this.timers.set(timer.id, timer);
    await this.save();
    return timer;
  }

  removeTimer(id: string): boolean {
    const removed = this.timers.delete(id);
    if (removed) this.save();
    return removed;
  }

  getTimer(id: string): Timer | null {
    return this.timers.get(id) ?? null;
  }

  listTimers(userId: number): Timer[] {
    return [...this.timers.values()].filter((t) => t.userId === userId);
  }

  listAll(): Timer[] {
    return [...this.timers.values()];
  }

  clearAll(userId: number): void {
    for (const [id, t] of this.timers) {
      if (t.userId === userId) this.timers.delete(id);
    }
    this.save();
  }

  updateNextRun(id: string, nextRun: number): void {
    const t = this.timers.get(id);
    if (t) {
      t.nextRun = nextRun;
    }
  }

  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.savePath, "utf8");
      const arr: Timer[] = JSON.parse(content);
      this.timers.clear();
      for (const t of arr) {
        this.timers.set(t.id, t);
      }
    } catch {
      this.timers.clear();
    }
  }

  async save(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    const arr = [...this.timers.values()];
    await fs.writeFile(this.savePath, JSON.stringify(arr, null, 2), "utf8");
  }

  start(): void {
    if (this.worker) return;
    this.worker = setInterval(() => {
      const now = Date.now();
      for (const timer of this.timers.values()) {
        if (timer.nextRun <= now) {
          this.onFire?.(timer);
          if (timer.recurring) {
            timer.nextRun = now + timer.interval;
          } else {
            this.timers.delete(timer.id);
          }
          this.dirty = true;
        }
      }
      if (this.dirty) {
        this.save();
        this.dirty = false;
      }
    }, 1000);
  }

  stop(): void {
    if (this.worker) {
      clearInterval(this.worker);
      this.worker = null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/timer.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add src/timer.ts src/__tests__/timer.test.ts
git commit -m "feat: implement TimerManager with persist and worker"
```

---

### Task 4: Add telegram timer command handlers

**Files:**
- Modify: `src/telegram.ts`

- [ ] **Step 1: Write the updated telegram.ts**

Modify `src/telegram.ts` to import TimerManager, add the helper, wire commands, and start the worker. The full file after changes:

Changes to `src/telegram.ts`:

1. Add imports at top:
```typescript
import { TimerManager } from "./timer.js";
import { getTimerDataDir } from "./runtime.js";
```

2. Add duration parse helper before `startTelegramBot`:
```typescript
function parseDuration(input: string): number | null {
  const match = input.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return null;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000;
  return ms > 0 ? ms : null;
}
```

3. Inside `startTelegramBot`, after bot creation and before `bot.start`, add:
```typescript
const timerManager = new TimerManager(getTimerDataDir());
await timerManager.load();
timerManager.onFire = async (timer) => {
  try {
    await bot.telegram.sendMessage(timer.chatId, `⏰ **${timer.type}:** ${timer.message}`);
  } catch (err) {
    console.error("Failed to send timer fire message:", err);
  }
};
timerManager.start();
```

4. Add command handlers after the existing `bot.command("clear", ...)` block:

```typescript
  bot.command("remind", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return;
    const text = ctx.message.text.replace("/remind", "").trim();
    const match = text.match(/^(\S+)\s+(.+)$/s);
    if (!match) {
      return ctx.reply("Usage: /remind <duration> <message>\nExamples: /remind 30m selam, /remind 1h30m toplantı");
    }
    const durStr = match[1];
    const msg = match[2];
    const ms = parseDuration(durStr);
    if (!ms) {
      return ctx.reply("Invalid duration. Use format like: 30m, 1h, 1h30m, 30s");
    }
    const timer = await timerManager.addTimer({
      userId: ctx.from.id,
      chatId: ctx.chat.id,
      type: "remind",
      message: msg,
      interval: ms,
      recurring: false,
    });
    await ctx.reply(`✅ Reminder set (#${timer.id}). I'll remind you in ${durStr}.`);
  });

  bot.command("every", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return;
    const text = ctx.message.text.replace("/every", "").trim();
    const match = text.match(/^(\S+)\s+(.+)$/s);
    if (!match) {
      return ctx.reply("Usage: /every <interval> <message>\nExample: /every 1h sunucu kontrol");
    }
    const durStr = match[1];
    const msg = match[2];
    const ms = parseDuration(durStr);
    if (!ms) {
      return ctx.reply("Invalid interval. Use format like: 30m, 1h, 1h30m");
    }
    const timer = await timerManager.addTimer({
      userId: ctx.from.id,
      chatId: ctx.chat.id,
      type: "every",
      message: msg,
      interval: ms,
      recurring: true,
    });
    await ctx.reply(`✅ Repeating timer set (#${timer.id}). I'll remind you every ${durStr}.`);
  });

  bot.command("schedule", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return;
    const text = ctx.message.text.replace("/schedule", "").trim();
    const match = text.match(/^(\d+)\s+(.+)$/s);
    if (!match) {
      return ctx.reply("Usage: /schedule <unix_timestamp> <message>\nExample: /schedule 1717500000 doğum günü");
    }
    const ts = parseInt(match[1], 10);
    const msg = match[2];
    if (!Number.isFinite(ts) || ts < Math.floor(Date.now() / 1000)) {
      return ctx.reply("Invalid or past timestamp. Provide a future Unix timestamp in seconds.");
    }
    const timer = await timerManager.addTimer({
      userId: ctx.from.id,
      chatId: ctx.chat.id,
      type: "schedule",
      message: msg,
      interval: (ts * 1000) - Date.now(),
      recurring: false,
    });
    const dateStr = new Date(ts * 1000).toLocaleString();
    await ctx.reply(`✅ Scheduled (#${timer.id}). I'll message you at ${dateStr}.`);
  });

  bot.command("list", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return;
    const timers = timerManager.listTimers(ctx.from.id);
    if (timers.length === 0) {
      return ctx.reply("No active timers.");
    }
    const lines = timers.map((t) => {
      const due = new Date(t.nextRun).toLocaleString();
      return `#${t.id} [${t.type}] "${t.message}" → ${due}`;
    });
    await ctx.reply(`📋 **Your Timers:**\n${lines.join("\n")}`);
  });

  bot.command("cancel", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return;
    const id = ctx.message.text.replace("/cancel", "").trim();
    if (!id) {
      return ctx.reply("Usage: /cancel <timer_id>\nUse /list to see IDs.");
    }
    const timer = timerManager.getTimer(id);
    if (!timer || timer.userId !== ctx.from.id) {
      return ctx.reply("Timer not found.");
    }
    timerManager.removeTimer(id);
    await ctx.reply(`✅ Timer #${id} cancelled.`);
  });

  bot.command("cancelall", async (ctx) => {
    if (!isAllowed(ctx.from.id)) return;
    timerManager.clearAll(ctx.from.id);
    await ctx.reply("✅ All your timers cancelled.");
  });
```

5. In the `process.once("SIGINT")` and `process.once("SIGTERM")` handlers, add `timerManager.stop()` before `bot.stop(...)`:

```typescript
  process.once("SIGINT", () => {
    timerManager.stop();
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    timerManager.stop();
    bot.stop("SIGTERM");
  });
```

- [ ] **Step 2: Build and check for errors**

Run: `npx tsc --noEmit`
Expected: clean exit, no errors

- [ ] **Step 3: Commit**

```bash
git add src/telegram.ts
git commit -m "feat: add telegram timer command handlers"
```

---

### Task 5: Verify full build and existing tests

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: PASS (all tests, including timer tests)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean exit, `dist/` updated

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: final build and verify"
```
