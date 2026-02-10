export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: number;
  private logs: string[] = [];

  constructor(level: LogLevel = "info") {
    this.level = LOG_LEVELS[level];
  }

  private format(level: string, msg: string): string {
    const ts = new Date().toISOString();
    return `[${ts}] [${level.toUpperCase()}] ${msg}`;
  }

  debug(msg: string): void {
    if (this.level <= LOG_LEVELS.debug) {
      const formatted = this.format("debug", msg);
      console.log(formatted);
      this.logs.push(formatted);
    }
  }

  info(msg: string): void {
    if (this.level <= LOG_LEVELS.info) {
      const formatted = this.format("info", msg);
      console.log(formatted);
      this.logs.push(formatted);
    }
  }

  warn(msg: string): void {
    if (this.level <= LOG_LEVELS.warn) {
      const formatted = this.format("warn", msg);
      console.warn(formatted);
      this.logs.push(formatted);
    }
  }

  error(msg: string): void {
    if (this.level <= LOG_LEVELS.error) {
      const formatted = this.format("error", msg);
      console.error(formatted);
      this.logs.push(formatted);
    }
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}
