import fs from "node:fs/promises";
import { Config } from "./types.js";
import { getMetricsFilePath } from "./runtime.js";

interface MetricsData {
  totalMessages: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

const INITIAL: MetricsData = {
  totalMessages: 0,
  byProvider: {},
  byModel: {},
};

export async function trackUsage(config: Config): Promise<void> {
  const file = getMetricsFilePath();
  let data = INITIAL;
  try {
    data = JSON.parse(await fs.readFile(file, "utf8")) as MetricsData;
  } catch {
    data = { ...INITIAL };
  }

  data.totalMessages += 1;
  data.byProvider[config.provider] = (data.byProvider[config.provider] ?? 0) + 1;
  const model = config[config.provider]?.model ?? "unknown";
  data.byModel[model] = (data.byModel[model] ?? 0) + 1;

  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}
