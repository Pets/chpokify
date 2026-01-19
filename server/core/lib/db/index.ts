import mongoose from 'mongoose';

import { softDeletePlugin } from '@core/lib/db/plugins';
import { log } from '@core/lib/logger';

mongoose.plugin(softDeletePlugin);

const connect = async () => {
  // Support both MongoDB Atlas (SRV) and local MongoDB
  let mongoUrl: string;
  
  if (process.env.MONGO_CONNECTION_STRING) {
    // Use MongoDB Atlas SRV connection string
    mongoUrl = process.env.MONGO_CONNECTION_STRING;
  } else {
    // Use local MongoDB connection
    const MONGODB_PASS = encodeURIComponent(process.env.MONGO_ROOT_PASSWORD as string);
    mongoUrl = `mongodb://root:${MONGODB_PASS}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DB_NAME}`;
  }

  await mongoose.connect(mongoUrl, {
    autoIndex: true,
    autoCreate: true,
    authSource: process.env.MONGO_CONNECTION_STRING ? undefined : 'admin',
  });

  log.info({ methodName: 'db.connect' }, 'mongoose db connected');

  mongoose.connection.on('error', (err) => {
    log.error({
      err,
      methodName: 'mongoose connect',
    });
  });

  if (process.env.NODE_ENV === 'development') {
    mongoose.set('debug', true);
  }
};

const db = {
  mongoose,
  connect,
};

export {
  db,
};
