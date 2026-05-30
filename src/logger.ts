import { Config } from "./types.js";

export function debugLog(config: Config, ...args: unknown[]): void {
  if (!config.debug) return;
  console.log("[debug]", ...args);
}
