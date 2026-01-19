import Redis from 'ioredis';

import { log } from '@core/lib/logger';

const redisConfig: any = {
  host: process.env.REDIS_HOST as string,
  port: Number.parseInt(process.env.REDIS_PORT as string, 10),
};

// Add password if provided (for Upstash or other managed Redis)
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
  redisConfig.tls = {}; // Upstash requires TLS
}

const redis = new Redis(redisConfig);

log.info({ methodName: 'redis.connect' }, 'redis connected');

export { redis };
