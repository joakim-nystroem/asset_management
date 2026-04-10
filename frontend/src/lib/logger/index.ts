import pino from 'pino';
import { dev } from '$app/environment';

const LOG_DIR = '/var/log/asset-management';

export const logger = pino(
  { level: dev ? 'debug' : 'info' },
  pino.transport({
    target: 'pino-roll',
    options: {
      file: `${LOG_DIR}/sveltekit.log`,
      size: '100m',
      limit: { count: 5 },
    },
  }),
);
