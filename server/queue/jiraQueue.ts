import { PokerSessionService } from '@pokerSessions/services/PokerSession';
import * as Sentry from '@sentry/node';
import { io } from '@socket';
import Queue from 'bull';

import { log } from '@core/lib/logger';
import { QUEUE, QUEUE_JOB_NAME, TJiraSetFieldIssue } from '@core/types';

const redisConfig: any = {
  port: Number.parseInt(process.env.REDIS_PORT as string, 10),
  host: process.env.REDIS_HOST,
};

// Add password if provided (for Upstash or other managed Redis)
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
  redisConfig.tls = {}; // Upstash requires TLS
}

const jiraQueue = new Queue(QUEUE.JIRA, {
  redis: redisConfig,
});

jiraQueue.process(QUEUE_JOB_NAME.JIRA_SET_FIELD_ISSUE, async (job, done) => {
  const {
    story,
    pokerSession,
    jiraIntegrations,
  }: TJiraSetFieldIssue = job.data;

  const pokerSessionService = new PokerSessionService(pokerSession);
  const err: string | undefined = await pokerSessionService.saveScoreInFieldJira(story, jiraIntegrations);

  const eventName = 'jiraReverseError';

  if (err) {
    Sentry.captureMessage(eventName);
    io.emit(eventName, err);
  }

  done();
});

log.info('BULL -> JIRA_QUEUE initial');

export { jiraQueue };
