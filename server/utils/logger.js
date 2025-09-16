import pino from 'pino';
import config from '../config/config.js';

let logger;

if (config.logging?.pretty) {
  logger = pino({
    level: config.logging.level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        singleLine: true,
        ignore: 'pid,hostname',
      },
    },
  });
} else {
  logger = pino({
    level: config.logging?.level || 'info',
  });
}

export default logger;


