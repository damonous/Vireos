import winston from 'winston';

// Determine log level: allow env override, default by NODE_ENV
const level = process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug');
const serviceName = process.env['LOG_SERVICE_NAME'] ?? 'vireos-backend';

// ---------------------------------------------------------------------------
// Custom formats
// ---------------------------------------------------------------------------

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ level, message, timestamp, traceId, ...meta }) => {
    const trace = traceId ? ` [${traceId}]` : '';
    const metaStr = Object.keys(meta).length
      ? `\n${JSON.stringify(meta, null, 2)}`
      : '';
    return `${timestamp}${trace} ${level}: ${message}${metaStr}`;
  })
);

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

const transports: winston.transport[] = [
  new winston.transports.Console({
    format:
      process.env['NODE_ENV'] === 'production' ? jsonFormat : prettyFormat,
  }),
];

// ---------------------------------------------------------------------------
// Logger instance
// ---------------------------------------------------------------------------

export const logger = winston.createLogger({
  level,
  defaultMeta: { service: serviceName },
  transports,
  // Do not exit on unhandled error events from the logger itself
  exitOnError: false,
});

/**
 * Create a child logger with extra metadata bound to every log line.
 * Useful for attaching traceId, userId, orgId, etc.
 */
export function createChildLogger(
  meta: Record<string, unknown>
): winston.Logger {
  return logger.child(meta);
}

export default logger;
