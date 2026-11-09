const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

let currentLevel: LogLevel = "info";

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const extra = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${extra ? " " + extra : ""}`;
}

export const logger = {
  setLevel(level: LogLevel) {
    currentLevel = level;
  },

  error(message: string, ...args: unknown[]) {
    if (LOG_LEVELS["error"] <= LOG_LEVELS[currentLevel]) {
      const formatted = formatMessage("error", message, ...args);
      console.error(formatted);
    }
  },

  warn(message: string, ...args: unknown[]) {
    if (LOG_LEVELS["warn"] <= LOG_LEVELS[currentLevel]) {
      const formatted = formatMessage("warn", message, ...args);
      console.warn(formatted);
    }
  },

  info(message: string, ...args: unknown[]) {
    if (LOG_LEVELS["info"] <= LOG_LEVELS[currentLevel]) {
      const formatted = formatMessage("info", message, ...args);
      console.log(formatted);
    }
  },

  debug(message: string, ...args: unknown[]) {
    if (LOG_LEVELS["debug"] <= LOG_LEVELS[currentLevel]) {
      const formatted = formatMessage("debug", message, ...args);
      console.debug(formatted);
    }
  },
};
