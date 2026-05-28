/**
 * Centralized frontend logger.
 *
 * Mirrors the contract laid out in the project constitution (Principle IV):
 *
 * - Every record carries a severity prefix and is written to the browser console
 *   with a CSS-styled color (the browser analog of ANSI colors).
 * - `WARNING`, `ERROR`, and `CRITICAL` records are additionally forwarded to the
 *   backend via `POST /api/log`, where the Python logger persists them to
 *   `logs/app.log` — preserving the single canonical log file.
 * - The forwarder is fire-and-forget: failures never propagate to the caller and
 *   never crash the UI.
 *
 * Direct `console.log` / `console.error` calls outside this module are
 * prohibited by the constitution.
 */

import type { LogPayload } from "../graph/types";

type Level = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

const LEVEL_STYLE: Record<Level, string> = {
  DEBUG: "color: #94a3b8",
  INFO: "color: #38bdf8",
  WARNING: "color: #facc15",
  ERROR: "color: #f87171",
  CRITICAL: "color: #f87171; font-weight: bold",
};

const FORWARDED: ReadonlySet<Level> = new Set<Level>(["WARNING", "ERROR", "CRITICAL"]);

const consoleFor = (level: Level): ((...args: unknown[]) => void) => {
  /* eslint-disable no-console */
  switch (level) {
    case "DEBUG":
      return console.debug.bind(console);
    case "INFO":
      return console.info.bind(console);
    case "WARNING":
      return console.warn.bind(console);
    case "ERROR":
    case "CRITICAL":
      return console.error.bind(console);
  }
  /* eslint-enable no-console */
};

const writeConsole = (
  level: Level,
  moduleName: string,
  message: string,
  context: Record<string, unknown> | undefined,
  timestamp: string,
): void => {
  const prefix = `%c[${level}]%c ${timestamp} ${moduleName} :: ${message}`;
  const styled = consoleFor(level);
  if (context !== undefined) {
    styled(prefix, LEVEL_STYLE[level], "color: inherit", context);
  } else {
    styled(prefix, LEVEL_STYLE[level], "color: inherit");
  }
};

const forwardRemote = (payload: LogPayload): void => {
  // Fire-and-forget. Never throws into caller code.
  void fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Swallow: a logger that brings down the page is worse than a silent miss.
  });
};

const emit = (
  level: Level,
  moduleName: string,
  message: string,
  context?: Record<string, unknown>,
): void => {
  const timestamp = new Date().toISOString();
  writeConsole(level, moduleName, message, context, timestamp);
  if (FORWARDED.has(level)) {
    const payload: LogPayload = context !== undefined
      ? { level: level as "WARNING" | "ERROR" | "CRITICAL", module: moduleName, message, timestamp, context }
      : { level: level as "WARNING" | "ERROR" | "CRITICAL", module: moduleName, message, timestamp };
    forwardRemote(payload);
  }
};

/** Emit a DEBUG record (console only). */
export const debug = (
  moduleName: string,
  message: string,
  context?: Record<string, unknown>,
): void => emit("DEBUG", moduleName, message, context);

/** Emit an INFO record (console only). */
export const info = (
  moduleName: string,
  message: string,
  context?: Record<string, unknown>,
): void => emit("INFO", moduleName, message, context);

/** Emit a WARNING record (console + forwarded). */
export const warn = (
  moduleName: string,
  message: string,
  context?: Record<string, unknown>,
): void => emit("WARNING", moduleName, message, context);

/** Emit an ERROR record (console + forwarded). */
export const error = (
  moduleName: string,
  message: string,
  context?: Record<string, unknown>,
): void => emit("ERROR", moduleName, message, context);

/** Emit a CRITICAL record (console + forwarded). */
export const critical = (
  moduleName: string,
  message: string,
  context?: Record<string, unknown>,
): void => emit("CRITICAL", moduleName, message, context);
