import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getAppDataDir } from "../src/runtime";
import {
  addTask,
  completeTask,
  assignTask,
  getTasks,
  addReminder,
  loadTasks,
  loadReminders,
} from "../src/taskManager";

describe("TaskManager", () => {
  const chatId = 99999;
  const userId = 88888;

  beforeEach(() => {
    // Clear files before each test to have clean state
    const tasksFile = path.join(getAppDataDir(), "tasks.json");
    const remindersFile = path.join(getAppDataDir(), "reminders.json");
    if (fs.existsSync(tasksFile)) fs.unlinkSync(tasksFile);
    if (fs.existsSync(remindersFile)) fs.unlinkSync(remindersFile);
  });

  it("adds and retrieves tasks", () => {
    const task1 = addTask(chatId, "Task One", "Alice", "Bob");
    expect(task1.id).toBe(1);
    expect(task1.title).toBe("Task One");
    expect(task1.status).toBe("pending");

    const task2 = addTask(chatId, "Task Two", "Alice");
    expect(task2.id).toBe(2);

    const tasks = getTasks(chatId);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe("Task One");
    expect(tasks[1].title).toBe("Task Two");
  });

  it("completes a task", () => {
    const task = addTask(chatId, "Task One", "Alice");
    expect(task.status).toBe("pending");

    const completed = completeTask(chatId, task.id);
    expect(completed).not.toBeNull();
    expect(completed?.status).toBe("completed");
    expect(completed?.completedAt).toBeDefined();

    const tasks = getTasks(chatId);
    expect(tasks[0].status).toBe("completed");
  });

  it("assigns a task", () => {
    const task = addTask(chatId, "Task One", "Alice");
    expect(task.assignedTo).toBeUndefined();

    const assigned = assignTask(chatId, task.id, "Charlie");
    expect(assigned).not.toBeNull();
    expect(assigned?.assignedTo).toBe("Charlie");

    const tasks = getTasks(chatId);
    expect(tasks[0].assignedTo).toBe("Charlie");
  });

  it("adds reminders", () => {
    const remindAt = new Date(Date.now() + 60000);
    const reminder = addReminder(chatId, 1, "Süt al", remindAt, userId);
    expect(reminder.id).toBe(1);
    expect(reminder.text).toBe("Süt al");
    expect(reminder.sent).toBe(false);

    const reminders = loadReminders();
    expect(reminders).toHaveLength(1);
    expect(reminders[0].text).toBe("Süt al");
  });
});
