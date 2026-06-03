# Telegram Bot Timer / Scheduler

## Overview
Add timer, reminder, and scheduling capabilities to the ewpo Telegram bot with persistent storage.

## Commands
| Command | Description |
|---|---|
| `/remind <duration> <message>` | Single reminder after duration (e.g., `30m`, `1h`, `2d`, `1h30m`) |
| `/every <duration> <message>` | Repeating timer at the given interval |
| `/schedule <timestamp> <message>` | One-time message at a specific Unix timestamp |
| `/list` | List all active timers with their IDs |
| `/cancel <id>` | Cancel a specific timer by ID |
| `/cancelall` | Cancel all timers for the current user |

## Architecture

### `src/timer.ts` - Timer Engine
- **TimerManager class:**
  - `addTimer(userId, type, interval, message, recurring)` → returns timer ID
  - `removeTimer(id)` → removes timer
  - `listTimers(userId)` → returns user's timers
  - `getTimer(id)` → returns single timer
  - `clearAll(userId)` → removes all for user
  - `start()` / `stop()` → start/stop the worker loop
  - `load()` / `save()` → JSON file persist

### Data Model
```typescript
interface Timer {
  id: string;          // 8-char unique ID
  userId: number;      // Telegram user ID
  type: "remind" | "every" | "schedule";
  message: string;
  createdAt: number;   // Unix ms
  nextRun: number;     // Unix ms
  interval: number;    // ms, 0 for schedule
  recurring: boolean;
  chatId: number;      // Telegram chat ID
}
```

### Persistence
- File: `~/.config/ewpo-nodejs/timers.json`
- Load on bot start, save on every mutation
- TimerWorker (setInterval every 1s) checks `nextRun` and fires when due

### Integration with `src/telegram.ts`
- Register new command handlers in `startTelegramBot()`
- Pass `bot` instance to fire messages via `ctx.telegram.sendMessage()`
- Start `TimerManager` on bot launch

## Timer Worker
- `setInterval` at 1000ms
- Compares `Date.now()` against `nextRun`
- For recurring timers: update `nextRun` = `nextRun + interval`
- For one-time: remove after firing
- Save after each mutation

## Error Handling
- Invalid duration format → reply with usage help
- Invalid timestamp → reply with error
- Timer not found on cancel → "Timer not found"
- Persistence errors → log and continue
