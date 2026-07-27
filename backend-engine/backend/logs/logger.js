import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const { format } = winston;
const { combine, timestamp, printf, colorize, simple } = format;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});

const logLevel = process.env.LOG_LEVEL || 'debug';

export const logger = winston.createLogger({
    level: logLevel,
    format: combine(
        timestamp({format: 'hh:mm:ss'}),
        logFormat
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(__dirname, 'error.log'),
            level: logLevel,
        }),
        new winston.transports.Console()
    ]
});

// Test on startup:
logger.info('Logger initialized');
