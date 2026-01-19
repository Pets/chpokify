import { LogLevelString, Serializer, LoggerOptions } from 'bunyan';

import { TAppRequest } from '@core/types';

const reqSerializer: Serializer = (req: TAppRequest) => ({
  url: req.url,
  method: req.method,
  headers: req.headers,
  cookies: req.cookies,
  body: req.body,
  params: req.params,
  query: req.query,
});

const errSerializer: Serializer = (err: Error) => ({
  name: err.name,
  stack: err.stack,
  message: err.message,
});

const options: LoggerOptions = {
  env: process.env.NODE_ENV || 'production',
  name: process.env.LOGGER_NAME || 'chpokify-server',
  project: process.env.LOGGER_PROJECT || 'chpokify',
  streams: [
    {
      level: (process.env.LOGGER_LEVEL as LogLevelString) || 'info',
      stream: process.stdout,
    },
  ],
  serializers: {
    req: reqSerializer,
    err: errSerializer,
  },
};

export { options };
