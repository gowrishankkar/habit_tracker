/**
 * Winston Logger
 * ──────────────
 * Single shared logger instance used across the entire API.
 *
 * Transports:
 *   development  → console with colorized, human-readable output
 *   production   → console with JSON (structured for log aggregators)
 *                  + error.log file for persistent error traces
 *   test         → silent (no noise during test runs)
 *
 * Log levels (lowest → highest priority):
 *   error (0) > warn (1) > info (2) > http (3) > debug (4)
 *
 * Usage:
 *   import { logger } from './utils/logger.js';
 *   logger.info('Server started', { port: 4000 });
 *   logger.error('DB connection failed', { err: error.message });
 */

import winston from "winston";
import { env } from "../config/env.js";

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// ── Pretty format for development console ────────────────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? " " + JSON.stringify(meta)
      : "";
    return `${ts} [${level}] ${stack ?? message}${metaStr}`;
  }),
);

// ── Structured JSON format for production / log shippers ─────────────────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

// ── Build transports based on environment ────────────────────────────────────
function buildTransports() {
  if (env.NODE_ENV === "test") {
    // Suppress all output during test runs
    return [new winston.transports.Console({ silent: true })];
  }

  if (env.NODE_ENV === "production") {
    return [
      new winston.transports.Console({ format: prodFormat }),
      new winston.transports.File({
        filename: "logs/error.log",
        level: "error",
        format: prodFormat,
        maxsize: 5 * 1024 * 1024, // 5 MB
        maxFiles: 5,
        tailable: true,
      }),
      new winston.transports.File({
        filename: "logs/combined.log",
        format: prodFormat,
        maxsize: 10 * 1024 * 1024, // 10 MB
        maxFiles: 10,
        tailable: true,
      }),
    ];
  }

  // development
  return [new winston.transports.Console({ format: devFormat })];
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transports: buildTransports(),
  // Never crash the process due to a logging error
  exitOnError: false,
});

/**
 * Morgan-compatible stream so HTTP request logs feed into Winston.
 * Assign as: morgan('combined', { stream: morganStream })
 */
export const morganStream = {
  write(message) {
    logger.http(message.trimEnd());
  },
};
