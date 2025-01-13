import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
const logDir = 'logs';
const logFormat = winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level}]: ${message}`;
});
export class Logger {
    logger;
    constructor(service) {
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            defaultMeta: { service },
            transports: [
                new DailyRotateFile({
                    filename: path.join(logDir, 'error-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    level: 'error',
                    maxFiles: '14d'
                }),
                new winston.transports.DailyRotateFile({
                    filename: path.join(logDir, 'combined-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    maxFiles: '14d'
                }),
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.timestamp(), logFormat)
                })
            ]
        });
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    error(message, meta) {
        this.logger.error(message, meta);
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
}
export const logger = new Logger('default');
