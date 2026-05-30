import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function getAppDataDir(): string {
  const dir = path.join(os.homedir(), ".config", "ewpo-nodejs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getHistoryDir(): string {
  const dir = path.join(getAppDataDir(), "history");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getTelegramHistoryDir(): string {
  const dir = path.join(getAppDataDir(), "telegram-history");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getMetricsFilePath(): string {
  return path.join(getAppDataDir(), "metrics.json");
}
