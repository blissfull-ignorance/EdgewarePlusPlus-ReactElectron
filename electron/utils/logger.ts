import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

let currentLevel: LogLevel = "info";
let logStream: fs.WriteStream | null = null;

function getLogPath(): string {
  const logDir = path.join(app.getPath("userData"), "logs");
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch {
    // In test environments, fs.mkdirSync may be mocked
  }
  const date = new Date().toISOString().slice(0, 10);
  return path.join(logDir, `edgeware-${date}.log`);
}

function ensureStream(): fs.WriteStream | null {
  try {
    if (!logStream) {
      logStream = fs.createWriteStream(getLogPath(), { flags: "a" });
    }
  } catch {
    // In test environments, fs.createWriteStream may be mocked
    return null;
  }
  return logStream;
}

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const extra = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${extra ? " " + extra : ""}`;
}

function write(level: LogLevel, message: string, ...args: unknown[]): void {
  if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel]) return;
  const formatted = formatMessage(level, message, ...args);
  const stream = ensureStream();
  if (stream) {
    stream.write(formatted + "\n");
  }
}

export const logger = {
  setLevel(level: LogLevel) {
    currentLevel = level;
  },

  error(message: string, ...args: unknown[]) {
    console.error(message, ...args);
    write("error", message, ...args);
  },

  warn(message: string, ...args: unknown[]) {
    console.warn(message, ...args);
    write("warn", message, ...args);
  },

  info(message: string, ...args: unknown[]) {
    console.log(message, ...args);
    write("info", message, ...args);
  },

  debug(message: string, ...args: unknown[]) {
    console.debug(message, ...args);
    write("debug", message, ...args);
  },

  close() {
    if (logStream) {
      logStream.end();
      logStream = null;
    }
  },
};
