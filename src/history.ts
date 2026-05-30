import fs from "node:fs/promises";
import path from "node:path";
import { Message } from "./types.js";
import { getHistoryDir, getTelegramHistoryDir } from "./runtime.js";

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function saveCliHistory(name: string, history: Message[]): Promise<string> {
  const file = path.join(getHistoryDir(), `${sanitizeName(name)}.json`);
  await fs.writeFile(file, JSON.stringify(history, null, 2), "utf8");
  return file;
}

export async function loadCliHistory(name: string): Promise<Message[]> {
  const file = path.join(getHistoryDir(), `${sanitizeName(name)}.json`);
  const content = await fs.readFile(file, "utf8");
  return JSON.parse(content) as Message[];
}

export async function listCliHistories(): Promise<string[]> {
  const items = await fs.readdir(getHistoryDir());
  return items.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}

export async function saveTelegramHistory(userId: number, history: Message[]): Promise<void> {
  const file = path.join(getTelegramHistoryDir(), `${userId}.json`);
  await fs.writeFile(file, JSON.stringify(history, null, 2), "utf8");
}

export async function loadTelegramHistory(userId: number): Promise<Message[]> {
  const file = path.join(getTelegramHistoryDir(), `${userId}.json`);
  try {
    const content = await fs.readFile(file, "utf8");
    return JSON.parse(content) as Message[];
  } catch {
    return [];
  }
}
