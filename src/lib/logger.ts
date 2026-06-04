import { invoke } from "@tauri-apps/api/core";

type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string) {
  invoke("write_log", { level, message }).catch(() => {});
}

export const logger = {
  debug: (msg: string) => log("debug", msg),
  info: (msg: string) => log("info", msg),
  warn: (msg: string) => log("warn", msg),
  error: (msg: string) => log("error", msg),
};
