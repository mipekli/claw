import fs from "node:fs";
import path from "node:path";
import { Telegraf } from "telegraf";
import { getAppDataDir } from "./runtime.js";

export interface Task {
  id: number;
  chatId: number;
  title: string;
  creator: string;
  assignedTo?: string;
  status: "pending" | "completed";
  createdAt: string;
  completedAt?: string;
}

export interface Reminder {
  id: number;
  chatId: number;
  taskId: number | null;
  text: string;
  remindAt: string; // ISO string
  userId: number;
  sent: boolean;
  createdAt: string;
}

const getTasksFilePath = (): string => path.join(getAppDataDir(), "tasks.json");
const getRemindersFilePath = (): string => path.join(getAppDataDir(), "reminders.json");

function readJsonFile<T>(filePath: string, defaultData: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultData;
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return defaultData;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
  }
}

export function loadTasks(): Task[] {
  return readJsonFile<Task[]>(getTasksFilePath(), []);
}

export function saveTasks(tasks: Task[]): void {
  writeJsonFile<Task[]>(getTasksFilePath(), tasks);
}

export function loadReminders(): Reminder[] {
  return readJsonFile<Reminder[]>(getRemindersFilePath(), []);
}

export function saveReminders(reminders: Reminder[]): void {
  writeJsonFile<Reminder[]>(getRemindersFilePath(), reminders);
}

export function addTask(chatId: number, title: string, creator: string, assignedTo?: string): Task {
  const tasks = loadTasks();
  const nextId = tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
  const newTask: Task = {
    id: nextId,
    chatId,
    title,
    creator,
    assignedTo,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  tasks.push(newTask);
  saveTasks(tasks);
  return newTask;
}

export function completeTask(chatId: number, taskId: number): Task | null {
  const tasks = loadTasks();
  const task = tasks.find((t) => t.id === taskId && t.chatId === chatId);
  if (!task) return null;

  task.status = "completed";
  task.completedAt = new Date().toISOString();
  saveTasks(tasks);
  return task;
}

export function assignTask(chatId: number, taskId: number, assignedTo: string): Task | null {
  const tasks = loadTasks();
  const task = tasks.find((t) => t.id === taskId && t.chatId === chatId);
  if (!task) return null;

  task.assignedTo = assignedTo;
  saveTasks(tasks);
  return task;
}

export function getTasks(chatId: number): Task[] {
  const tasks = loadTasks();
  return tasks.filter((t) => t.chatId === chatId);
}

export function addReminder(
  chatId: number,
  taskId: number | null,
  text: string,
  remindAt: Date,
  userId: number
): Reminder {
  const reminders = loadReminders();
  const nextId = reminders.length > 0 ? Math.max(...reminders.map((r) => r.id)) + 1 : 1;
  const newReminder: Reminder = {
    id: nextId,
    chatId,
    taskId,
    text,
    remindAt: remindAt.toISOString(),
    userId,
    sent: false,
    createdAt: new Date().toISOString(),
  };
  reminders.push(newReminder);
  saveReminders(reminders);
  return newReminder;
}

export async function checkAndSendReminders(bot: Telegraf<any>): Promise<void> {
  const reminders = loadReminders();
  const now = new Date();
  let updated = false;

  for (const reminder of reminders) {
    if (!reminder.sent && new Date(reminder.remindAt) <= now) {
      try {
        const mention = `[User](tg://user?id=${reminder.userId})`;
        let message = `⏰ **HATIRLATICI**\n\n${reminder.text}`;
        if (reminder.taskId) {
          message += `\n\n(İlgili Görev ID: ${reminder.taskId})`;
        }
        
        await bot.telegram.sendMessage(reminder.chatId, message, {
          parse_mode: "Markdown",
        });
        
        reminder.sent = true;
        updated = true;
      } catch (error) {
        console.error(`Failed to send reminder ${reminder.id} to chat ${reminder.chatId}:`, error);
      }
    }
  }

  if (updated) {
    saveReminders(reminders);
  }
}
